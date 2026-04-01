const express = require('express');
const { fetchMany } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.OPENAI_TRANSACTION_MODEL ||
  process.env.OPENAI_MODEL ||
  'gpt-5';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(queryTokens, candidateTokens) {
  if (!queryTokens.length || !candidateTokens.length) {
    return 0;
  }
  const candidateSet = new Set(candidateTokens);
  const querySet = new Set(queryTokens);
  let matches = 0;
  for (const token of querySet) {
    if (candidateSet.has(token)) {
      matches += 1;
    }
  }
  return matches / Math.max(querySet.size, candidateSet.size);
}

function scoreCandidate(query, fields) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = tokenize(normalizedQuery);
  let best = 0;

  for (const field of fields) {
    const normalizedField = normalizeText(field);
    if (!normalizedField) {
      continue;
    }

    if (normalizedField === normalizedQuery) {
      return 1;
    }

    if (normalizedField.startsWith(normalizedQuery) ||
        normalizedQuery.startsWith(normalizedField)) {
      best = Math.max(best, 0.92);
    } else if (normalizedField.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedField)) {
      best = Math.max(best, 0.82);
    }

    best = Math.max(best, overlapScore(queryTokens, tokenize(normalizedField)));
  }

  return best;
}

function findBestMatch(query, candidates, getFields) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return null;
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(normalizedQuery, getFields(candidate)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return null;
  }

  const [best, second] = scored;
  if (best.score < 0.45) {
    return null;
  }
  if (second && second.score >= best.score - 0.05) {
    return null;
  }

  return best;
}

function extractOutputText(responseBody) {
  if (typeof responseBody.output_text === 'string' &&
      responseBody.output_text.trim()) {
    return responseBody.output_text.trim();
  }

  const outputs = Array.isArray(responseBody.output) ? responseBody.output : [];
  for (const output of outputs) {
    const contents = Array.isArray(output?.content) ? output.content : [];
    for (const content of contents) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
      if (typeof content?.value === 'string' && content.value.trim()) {
        return content.value.trim();
      }
    }
  }

  return '';
}

async function parseTransactionCommand(command) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('AI assistant is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions:
        'Extract a warehouse transaction command into structured fields. ' +
        'Return only the schema fields. ' +
        'If transaction type is missing, use UNKNOWN. ' +
        'If quantity is missing, use 1. ' +
        'Use empty strings for missing names or notes. ' +
        'Map issue/out/give/send to ISSUE. ' +
        'Map return/in/back/receive back to RETURN. ' +
        'Map new/create/add stock/manual stock to NEW.',
      input: command,
      text: {
        format: {
          type: 'json_schema',
          name: 'transaction_command',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              transaction_type: {
                type: 'string',
                enum: ['ISSUE', 'RETURN', 'NEW', 'UNKNOWN'],
              },
              item_name: { type: 'string' },
              site_name: { type: 'string' },
              employee_name: { type: 'string' },
              quantity: { type: 'integer', minimum: 1 },
              condition: {
                type: 'string',
                enum: ['Good', 'Damaged', 'Broken', 'Not Working'],
              },
              notes: { type: 'string' },
            },
            required: [
              'transaction_type',
              'item_name',
              'site_name',
              'employee_name',
              'quantity',
              'condition',
              'notes',
            ],
          },
        },
      },
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const error = new Error(
      `OpenAI request failed (${response.status}): ${rawBody}`,
    );
    error.statusCode = 502;
    throw error;
  }

  const decoded = JSON.parse(rawBody);
  const outputText = extractOutputText(decoded);
  if (!outputText) {
    const error = new Error('AI assistant returned an empty response.');
    error.statusCode = 502;
    throw error;
  }

  return JSON.parse(outputText);
}

function matchInventoryItem(parsedName, items) {
  return findBestMatch(parsedName, items, (item) => [
    item.name,
    item.itemName,
    item.sku,
    item.category,
    item.size,
  ]);
}

function matchSite(parsedName, sites) {
  return findBestMatch(parsedName, sites, (site) => [
    site.siteName,
    site.siteCode,
    site.name,
  ]);
}

function matchEmployee(parsedName, users) {
  return findBestMatch(parsedName, users, (user) => [
    user.fullName,
    user.firstName,
    user.lastName,
    user.username,
    user.employeeId,
    user.email,
  ]);
}

router.post(
  '/transaction-command',
  checkPermission('addTransactions'),
  async (req, res) => {
    const command = String(req.body?.command || '').trim();
    if (!command) {
      return res.status(400).json({ error: 'Command is required.' });
    }

    try {
      const parsed = await parseTransactionCommand(command);
      const [inventory, sites, users] = await Promise.all([
        fetchMany('inventory'),
        fetchMany('sites'),
        fetchMany('users'),
      ]);

      const activeSites = sites.filter(
        (site) => String(site.status || '').toLowerCase() === 'active',
      );
      const activeUsers = users.filter((user) => user.isActive !== false);
      const activeItems = inventory.filter(
        (item) => String(item.status || 'active').toLowerCase() === 'active',
      );

      const itemMatch = matchInventoryItem(parsed.item_name, activeItems);
      const siteMatch = matchSite(parsed.site_name, activeSites);
      const employeeMatch = matchEmployee(parsed.employee_name, activeUsers);

      const unresolved = [];
      const normalizedType = String(parsed.transaction_type || '').toUpperCase();

      if (!['ISSUE', 'RETURN', 'NEW'].includes(normalizedType)) {
        unresolved.push('transaction type');
      }
      if (!itemMatch) {
        unresolved.push('item');
      }
      if (!employeeMatch) {
        unresolved.push('employee');
      }
      if (normalizedType !== 'NEW' && !siteMatch) {
        unresolved.push('site');
      }

      const suggestion = {
        type: normalizedType,
        quantity: Number(parsed.quantity || 1),
        condition: parsed.condition || 'Good',
        notes: parsed.notes || '',
        itemId: itemMatch?.candidate?.id || itemMatch?.candidate?._id || '',
        itemName: itemMatch?.candidate?.name || itemMatch?.candidate?.itemName || '',
        siteId: siteMatch?.candidate?.id || siteMatch?.candidate?._id || '',
        siteName: siteMatch?.candidate?.siteName || siteMatch?.candidate?.name || '',
        employeeId:
          employeeMatch?.candidate?.id || employeeMatch?.candidate?._id || '',
        employeeName:
          employeeMatch?.candidate?.fullName ||
          employeeMatch?.candidate?.username ||
          '',
      };

      res.json({
        parsed,
        ready: unresolved.length === 0,
        unresolved,
        suggestion,
        matches: {
          itemScore: itemMatch?.score ?? 0,
          siteScore: siteMatch?.score ?? 0,
          employeeScore: employeeMatch?.score ?? 0,
        },
      });
    } catch (error) {
      console.error('AI transaction command error:', error);
      res.status(error.statusCode || 500).json({
        error:
          error.statusCode === 503
            ? error.message
            : 'Unable to process AI transaction command.',
        details: error.message,
      });
    }
  },
);

module.exports = router;
