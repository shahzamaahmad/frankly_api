const express = require('express');
const { ID_COLUMN, fetchById, fetchMany, insertRow, indexById, uniqueIds, updateRow } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

function normalizeSiteIdentity(value) {
  return String(value || '').trim().toUpperCase();
}

function isWarehouseSite(site) {
  return (
    normalizeSiteIdentity(site?.siteCode) === 'WAREHOUSE' ||
    normalizeSiteIdentity(site?.siteName || site?.name) === 'WAREHOUSE'
  );
}

async function fetchUserSummaries(ids) {
  const userIds = uniqueIds(ids);
  if (!userIds.length) {
    return new Map();
  }

  const users = await fetchMany('users', {
    filters: [{ column: ID_COLUMN, operator: 'in', value: userIds }],
  });

  return indexById(users.map((user) => ({
    _id: user._id,
    username: user.username,
    fullName: user.fullName,
  })));
}

async function populateSite(site) {
  if (!site) {
    return null;
  }

  const userMap = await fetchUserSummaries([site.engineerId, site.siteManager]);

  return {
    ...site,
    client: site.clientName ? { name: site.clientName } : null,
    projectValue: site.projectValue !== undefined || site.projectCurrency
      ? { amount: site.projectValue, currency: site.projectCurrency }
      : null,
    workingHours: site.workingHoursStart || site.workingHoursEnd
      ? { start: site.workingHoursStart, end: site.workingHoursEnd }
      : null,
    engineer: site.engineerId ? (userMap.get(String(site.engineerId)) || site.engineerId) : site.engineerId,
    siteManager: site.siteManager ? (userMap.get(String(site.siteManager)) || site.siteManager) : site.siteManager,
    safetyOfficer: null,
  };
}

async function populateSites(sites) {
  const ids = uniqueIds(sites.flatMap((site) => [site.engineerId, site.siteManager]));

  const userMap = await fetchUserSummaries(ids);

  return sites.map((site) => ({
    ...site,
    client: site.clientName ? { name: site.clientName } : null,
    projectValue: site.projectValue !== undefined || site.projectCurrency
      ? { amount: site.projectValue, currency: site.projectCurrency }
      : null,
    workingHours: site.workingHoursStart || site.workingHoursEnd
      ? { start: site.workingHoursStart, end: site.workingHoursEnd }
      : null,
    engineer: site.engineerId ? (userMap.get(String(site.engineerId)) || site.engineerId) : site.engineerId,
    siteManager: site.siteManager ? (userMap.get(String(site.siteManager)) || site.siteManager) : site.siteManager,
    safetyOfficer: null,
  }));
}

function normalizeSitePayload(body) {
  const payload = { ...body };

  if (payload.client && !payload.clientName) {
    payload.clientName = typeof payload.client === 'string' ? payload.client : payload.client.name;
  }

  if (payload.projectValue && typeof payload.projectValue === 'object') {
    if (payload.projectValue.amount !== undefined && payload.projectValue.amount !== null && payload.projectValue.amount !== '') {
      payload.projectValue = Number(payload.projectValue.amount);
    } else {
      delete payload.projectValue;
    }

    if (payload.projectValue?.currency || body.projectValue?.currency) {
      payload.projectCurrency = body.projectValue.currency;
    }
  } else if (payload.projectValue !== undefined && payload.projectValue !== null && payload.projectValue !== '') {
    payload.projectValue = Number(payload.projectValue);
  }

  if (payload.workingHours && typeof payload.workingHours === 'object') {
    payload.workingHoursStart = payload.workingHours.start;
    payload.workingHoursEnd = payload.workingHours.end;
  }

  if (payload.engineer && !payload.engineerId) {
    payload.engineerId = typeof payload.engineer === 'object'
      ? (payload.engineer.id || payload.engineer._id)
      : payload.engineer;
  }

  if (payload.siteManager) {
    payload.siteManager = typeof payload.siteManager === 'object'
      ? (payload.siteManager.id || payload.siteManager._id)
      : payload.siteManager;
  }

  delete payload.client;
  delete payload.workingHours;
  delete payload.engineer;
  delete payload.safetyOfficer;
  delete payload.createdAt;
  delete payload.updatedAt;

  return payload;
}

router.post('/', checkPermission('addSites'), async (req, res) => {
  try {
    if (!req.body.siteCode || !req.body.siteName) {
      return res.status(400).json({ error: 'Site code and name are required' });
    }

    const payload = normalizeSitePayload(req.body);
    if (isWarehouseSite(payload)) {
      payload.siteCode = 'WAREHOUSE';
      payload.siteName = 'Warehouse';
      payload.status = 'active';
    }

    const site = await insertRow('sites', payload);
    const populated = await populateSite(site);
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create site error:', err);
    res.status(400).json({ error: 'Failed to create site' });
  }
});

router.get('/', checkPermission('viewSites'), async (req, res) => {
  try {
    const sites = await fetchMany('sites');
    res.json(await populateSites(sites));
  } catch (err) {
    console.error('Get sites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewSites'), async (req, res) => {
  try {
    const site = await fetchById('sites', req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(await populateSite(site));
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editSites'), async (req, res) => {
  try {
    const existing = await fetchById('sites', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Site not found' });

    const updates = normalizeSitePayload(req.body);
    delete updates._id;
    delete updates.id;

    if (isWarehouseSite(existing) || isWarehouseSite(updates)) {
      updates.siteCode = 'WAREHOUSE';
      updates.siteName = 'Warehouse';
      updates.status = 'active';
    }

    const updated = await updateRow('sites', req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Site not found' });

    const populated = await populateSite(updated);
    res.json(populated);
  } catch (err) {
    console.error('Update site error:', err);
    res.status(400).json({ error: 'Failed to update site' });
  }
});

router.delete('/:id', checkPermission('deleteSites'), async (req, res) => {
  return res.status(403).json({
    error: 'Site deletion is disabled. Sites cannot be deleted.',
  });
});

module.exports = router;
