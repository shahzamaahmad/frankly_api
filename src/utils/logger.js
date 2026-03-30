const { insertRow } = require('../lib/db');

async function createLog(action, userId, username, details = '') {
  try {
    await insertRow(
      'logs',
      {
        action,
        userId,
        username,
        details,
        timestamp: new Date().toISOString(),
      },
      { timestamps: false }
    );
  } catch (err) {
    console.error('Failed to create log:', err);
  }
}

module.exports = { createLog };
