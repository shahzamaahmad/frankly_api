const Log = require('../models/log');

async function createLog(action, userId, username, details = '') {
  try {
    await Log.create({ action, userId, username, details });
  } catch (err) {
    console.error('Failed to create log:', err);
  }
}

module.exports = { createLog };
