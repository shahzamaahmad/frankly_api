const express = require('express');
const { ID_COLUMN, fetchById, fetchMany, deleteRow, insertRow, indexById, uniqueIds, updateRow } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

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

  const userMap = await fetchUserSummaries([site.engineer, site.siteManager, site.safetyOfficer]);

  return {
    ...site,
    engineer: site.engineer ? (userMap.get(String(site.engineer)) || site.engineer) : site.engineer,
    siteManager: site.siteManager ? (userMap.get(String(site.siteManager)) || site.siteManager) : site.siteManager,
    safetyOfficer: site.safetyOfficer ? (userMap.get(String(site.safetyOfficer)) || site.safetyOfficer) : site.safetyOfficer,
  };
}

async function populateSites(sites) {
  const ids = uniqueIds(
    sites.flatMap((site) => [site.engineer, site.siteManager, site.safetyOfficer])
  );

  const userMap = await fetchUserSummaries(ids);

  return sites.map((site) => ({
    ...site,
    engineer: site.engineer ? (userMap.get(String(site.engineer)) || site.engineer) : site.engineer,
    siteManager: site.siteManager ? (userMap.get(String(site.siteManager)) || site.siteManager) : site.siteManager,
    safetyOfficer: site.safetyOfficer ? (userMap.get(String(site.safetyOfficer)) || site.safetyOfficer) : site.safetyOfficer,
  }));
}

router.post('/', checkPermission('addSites'), async (req, res) => {
  try {
    if (!req.body.siteCode || !req.body.siteName) {
      return res.status(400).json({ error: 'Site code and name are required' });
    }

    const now = new Date().toISOString();
    const site = await insertRow('sites', {
      ...req.body,
      createdAt: req.body.createdAt || now,
      updatedAt: now,
    }, { timestamps: false });
    if (global.io) global.io.emit('site:created', site);
    res.status(201).json(site);
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
    const updates = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.createdAt;

    const updated = await updateRow('sites', req.params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { timestamps: false });
    if (!updated) return res.status(404).json({ error: 'Site not found' });

    const populated = await populateSite(updated);
    if (global.io) global.io.emit('site:updated', populated);
    res.json(populated);
  } catch (err) {
    console.error('Update site error:', err);
    res.status(400).json({ error: 'Failed to update site' });
  }
});

router.delete('/:id', checkPermission('deleteSites'), async (req, res) => {
  try {
    const site = await fetchById('sites', req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    await deleteRow('sites', req.params.id);

    if (global.io) global.io.emit('site:deleted', { id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(400).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;
