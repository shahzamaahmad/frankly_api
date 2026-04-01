const express = require('express');
const { fetchMany } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

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

async function runStructuredAiRequest({
  preferredModelEnv,
  instructions,
  input,
  schemaName,
  schema,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('AI assistant is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  const model = process.env[preferredModelEnv] ||
    process.env.OPENAI_ASSISTANT_MODEL ||
    process.env.OPENAI_TRANSACTION_MODEL ||
    process.env.OPENAI_MODEL ||
    'gpt-5';

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
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

async function parseTransactionCommand(command) {
  return runStructuredAiRequest({
    preferredModelEnv: 'OPENAI_TRANSACTION_MODEL',
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
    schemaName: 'transaction_command',
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
  });
}

async function parseAssistantCommand(command) {
  return runStructuredAiRequest({
    preferredModelEnv: 'OPENAI_ASSISTANT_MODEL',
    instructions:
      'Classify a warehouse-app assistant command into exactly one action. ' +
      'Supported actions are CREATE_TRANSACTION, SET_ITEM_STOCK, ' +
      'SET_SITE_STATUS, ASSIGN_SITE_ENGINEER, SET_EMPLOYEE_STATUS, ' +
      'CREATE_ITEM, or UNKNOWN. ' +
      'Choose the single best action for the command. ' +
      'Use empty strings for missing names, sku, category, or notes. ' +
      'If a status is missing or unclear, use UNKNOWN. ' +
      'For employee status, map activate/enable/reopen to ACTIVE and ' +
      'deactivate/disable/block to INACTIVE. ' +
      'For site status, map complete/completed/done/close to COMPLETED and ' +
      'active/open/reopen/ongoing to ACTIVE. ' +
      'For transaction type, map issue/out/give/send to ISSUE, ' +
      'return/in/back/receive back to RETURN, and new/create/add stock/manual stock to NEW. ' +
      'For stock changes, stock_quantity is the final stock number, not a delta. ' +
      'For create item, stock_quantity is the starting stock. ' +
      'Return only the schema fields.',
    input: command,
    schemaName: 'assistant_command',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: [
            'CREATE_TRANSACTION',
            'SET_ITEM_STOCK',
            'SET_SITE_STATUS',
            'ASSIGN_SITE_ENGINEER',
            'SET_EMPLOYEE_STATUS',
            'CREATE_ITEM',
            'UNKNOWN',
          ],
        },
        transaction_type: {
          type: 'string',
          enum: ['ISSUE', 'RETURN', 'NEW', 'UNKNOWN'],
        },
        item_name: { type: 'string' },
        item_sku: { type: 'string' },
        category: { type: 'string' },
        site_name: { type: 'string' },
        transaction_employee_name: { type: 'string' },
        target_employee_name: { type: 'string' },
        engineer_name: { type: 'string' },
        quantity: { type: 'integer', minimum: 1 },
        stock_quantity: { type: 'integer', minimum: 0 },
        condition: {
          type: 'string',
          enum: ['Good', 'Damaged', 'Broken', 'Not Working'],
        },
        notes: { type: 'string' },
        site_status: {
          type: 'string',
          enum: ['ACTIVE', 'COMPLETED', 'UNKNOWN'],
        },
        employee_status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'UNKNOWN'],
        },
      },
      required: [
        'action',
        'transaction_type',
        'item_name',
        'item_sku',
        'category',
        'site_name',
        'transaction_employee_name',
        'target_employee_name',
        'engineer_name',
        'quantity',
        'stock_quantity',
        'condition',
        'notes',
        'site_status',
        'employee_status',
      ],
    },
  });
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

function exactInventorySkuMatch(sku, items) {
  const normalizedSku = normalizeText(sku).replace(/\s+/g, '');
  if (!normalizedSku) {
    return null;
  }
  return items.find((item) => (
    normalizeText(item.sku).replace(/\s+/g, '') === normalizedSku
  )) || null;
}

function normalizeSiteStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') {
    return 'active';
  }
  if (normalized === 'COMPLETED') {
    return 'completed';
  }
  return '';
}

function normalizeEmployeeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') {
    return true;
  }
  if (normalized === 'INACTIVE') {
    return false;
  }
  return null;
}

function buildAssistantProposal(parsed, inventory, sites, users) {
  const activeSites = sites.filter(
    (site) => String(site.status || '').toLowerCase() === 'active',
  );
  const activeUsers = users.filter((user) => user.isActive !== false);
  const activeItems = inventory.filter(
    (item) => String(item.status || 'active').toLowerCase() === 'active',
  );

  const action = String(parsed.action || '').toUpperCase();
  const unresolved = [];
  const matches = {};
  const proposal = {
    action,
    summary: '',
  };

  switch (action) {
    case 'CREATE_TRANSACTION': {
      const normalizedType = String(parsed.transaction_type || '').toUpperCase();
      const itemMatch = matchInventoryItem(parsed.item_name, activeItems);
      const siteMatch = matchSite(parsed.site_name, activeSites);
      const employeeMatch = matchEmployee(
        parsed.transaction_employee_name,
        activeUsers,
      );

      matches.itemScore = itemMatch?.score ?? 0;
      matches.siteScore = siteMatch?.score ?? 0;
      matches.employeeScore = employeeMatch?.score ?? 0;

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

      proposal.type = normalizedType;
      proposal.quantity = Number(parsed.quantity || 1);
      proposal.condition = parsed.condition || 'Good';
      proposal.notes = parsed.notes || '';
      proposal.itemId = itemMatch?.candidate?.id || itemMatch?.candidate?._id || '';
      proposal.itemName = itemMatch?.candidate?.name || itemMatch?.candidate?.itemName || '';
      proposal.siteId = siteMatch?.candidate?.id || siteMatch?.candidate?._id || '';
      proposal.siteName = siteMatch?.candidate?.siteName || siteMatch?.candidate?.name || '';
      proposal.employeeId =
        employeeMatch?.candidate?.id || employeeMatch?.candidate?._id || '';
      proposal.employeeName =
        employeeMatch?.candidate?.fullName ||
        employeeMatch?.candidate?.username ||
        '';
      proposal.summary =
        `${normalizedType || 'Transaction'} ${proposal.quantity || 1} ` +
        `${proposal.itemName || parsed.item_name || 'item'} ` +
        `${normalizedType === 'NEW' ? 'for stock' : `for ${proposal.siteName || parsed.site_name || 'site'}`}` +
        ` by ${proposal.employeeName || parsed.transaction_employee_name || 'employee'}`;
      break;
    }
    case 'SET_ITEM_STOCK': {
      const itemMatch = matchInventoryItem(parsed.item_name, inventory);
      matches.itemScore = itemMatch?.score ?? 0;
      if (!itemMatch) {
        unresolved.push('item');
      }
      if (typeof parsed.stock_quantity !== 'number' || parsed.stock_quantity < 0) {
        unresolved.push('stock quantity');
      }
      proposal.itemId = itemMatch?.candidate?.id || itemMatch?.candidate?._id || '';
      proposal.itemName = itemMatch?.candidate?.name || itemMatch?.candidate?.itemName || '';
      proposal.itemSku = itemMatch?.candidate?.sku || '';
      proposal.stockQuantity = parsed.stock_quantity;
      proposal.summary =
        `Set ${proposal.itemName || parsed.item_name || 'item'} stock to ${parsed.stock_quantity}`;
      break;
    }
    case 'SET_SITE_STATUS': {
      const siteMatch = matchSite(parsed.site_name, sites);
      const siteStatus = normalizeSiteStatus(parsed.site_status);
      matches.siteScore = siteMatch?.score ?? 0;
      if (!siteMatch) {
        unresolved.push('site');
      }
      if (!siteStatus) {
        unresolved.push('site status');
      }
      proposal.siteId = siteMatch?.candidate?.id || siteMatch?.candidate?._id || '';
      proposal.siteName = siteMatch?.candidate?.siteName || siteMatch?.candidate?.name || '';
      proposal.siteStatus = siteStatus;
      proposal.summary =
        `Mark ${proposal.siteName || parsed.site_name || 'site'} as ${siteStatus || 'updated'}`;
      break;
    }
    case 'ASSIGN_SITE_ENGINEER': {
      const siteMatch = matchSite(parsed.site_name, sites);
      const engineerMatch = matchEmployee(parsed.engineer_name, activeUsers);
      matches.siteScore = siteMatch?.score ?? 0;
      matches.engineerScore = engineerMatch?.score ?? 0;
      if (!siteMatch) {
        unresolved.push('site');
      }
      if (!engineerMatch) {
        unresolved.push('engineer');
      }
      proposal.siteId = siteMatch?.candidate?.id || siteMatch?.candidate?._id || '';
      proposal.siteName = siteMatch?.candidate?.siteName || siteMatch?.candidate?.name || '';
      proposal.engineerId =
        engineerMatch?.candidate?.id || engineerMatch?.candidate?._id || '';
      proposal.engineerName =
        engineerMatch?.candidate?.fullName ||
        engineerMatch?.candidate?.username ||
        '';
      proposal.summary =
        `Assign ${proposal.engineerName || parsed.engineer_name || 'engineer'} to ` +
        `${proposal.siteName || parsed.site_name || 'site'}`;
      break;
    }
    case 'SET_EMPLOYEE_STATUS': {
      const employeeMatch = matchEmployee(parsed.target_employee_name, users);
      const employeeStatus = normalizeEmployeeStatus(parsed.employee_status);
      matches.employeeScore = employeeMatch?.score ?? 0;
      if (!employeeMatch) {
        unresolved.push('employee');
      }
      if (employeeStatus === null) {
        unresolved.push('employee status');
      }
      proposal.employeeId =
        employeeMatch?.candidate?.id || employeeMatch?.candidate?._id || '';
      proposal.employeeName =
        employeeMatch?.candidate?.fullName ||
        employeeMatch?.candidate?.username ||
        '';
      proposal.employeeStatus = employeeStatus;
      proposal.summary =
        `${employeeStatus ? 'Activate' : 'Deactivate'} ` +
        `${proposal.employeeName || parsed.target_employee_name || 'employee'}`;
      break;
    }
    case 'CREATE_ITEM': {
      const suggestedName = String(parsed.item_name || '').trim();
      const suggestedSku = String(parsed.item_sku || '').trim();
      const stockQuantity =
        typeof parsed.stock_quantity === 'number' ? parsed.stock_quantity : 0;
      const skuMatch = exactInventorySkuMatch(suggestedSku, inventory);
      const nameMatch = matchInventoryItem(suggestedName, inventory);
      const strongNameMatch = nameMatch && nameMatch.score >= 0.82;

      if (!suggestedName) {
        unresolved.push('item name');
      }
      if (!suggestedSku) {
        unresolved.push('sku');
      }
      if (stockQuantity < 0) {
        unresolved.push('starting stock');
      }
      if (skuMatch) {
        unresolved.push('sku already exists');
      }
      if (strongNameMatch) {
        unresolved.push('similar item already exists');
      }

      proposal.itemName = suggestedName;
      proposal.itemSku = suggestedSku;
      proposal.category = String(parsed.category || '').trim();
      proposal.stockQuantity = stockQuantity;
      proposal.existingItemId = skuMatch?.id || skuMatch?._id || strongNameMatch?.candidate?.id || '';
      proposal.existingItemName =
        skuMatch?.name ||
        skuMatch?.itemName ||
        strongNameMatch?.candidate?.name ||
        strongNameMatch?.candidate?.itemName ||
        '';
      proposal.summary =
        `Create item ${suggestedName || 'item'} (${suggestedSku || 'no sku'}) ` +
        `with stock ${stockQuantity}`;
      matches.itemScore = strongNameMatch?.score ?? 0;
      break;
    }
    default:
      unresolved.push('supported action');
      proposal.summary = 'The assistant could not map that request to a supported action yet.';
      break;
  }

  return {
    action,
    ready: unresolved.length === 0,
    unresolved,
    proposal,
    matches,
  };
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

      const result = buildAssistantProposal(
        {
          action: 'CREATE_TRANSACTION',
          transaction_type: parsed.transaction_type,
          item_name: parsed.item_name,
          site_name: parsed.site_name,
          transaction_employee_name: parsed.employee_name,
          quantity: parsed.quantity,
          condition: parsed.condition,
          notes: parsed.notes,
        },
        inventory,
        sites,
        users,
      );

      res.json({
        parsed,
        ready: result.ready,
        unresolved: result.unresolved,
        suggestion: result.proposal,
        matches: result.matches,
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

router.post(
  '/assistant-command',
  checkPermission('viewInventory'),
  async (req, res) => {
    const command = String(req.body?.command || '').trim();
    if (!command) {
      return res.status(400).json({ error: 'Command is required.' });
    }

    try {
      const parsed = await parseAssistantCommand(command);
      const [inventory, sites, users] = await Promise.all([
        fetchMany('inventory'),
        fetchMany('sites'),
        fetchMany('users'),
      ]);

      const result = buildAssistantProposal(parsed, inventory, sites, users);

      res.json({
        parsed,
        action: result.action,
        ready: result.ready,
        unresolved: result.unresolved,
        proposal: result.proposal,
        matches: result.matches,
      });
    } catch (error) {
      console.error('AI assistant command error:', error);
      res.status(error.statusCode || 500).json({
        error:
          error.statusCode === 503
            ? error.message
            : 'Unable to process AI assistant command.',
        details: error.message,
      });
    }
  },
);

module.exports = router;
