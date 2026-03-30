const { insertRow } = require('../lib/db');

async function createLog(action, userId, username, details = '') {
  try {
    await insertRow(
      'activities',
      {
        action,
        itemType: 'system',
        itemId: userId || null,
        itemName: username || null,
        details,
        userName: username || null,
        createdAt: new Date().toISOString(),
      },
      { timestamps: false }
    );
  } catch (err) {
    console.error('Failed to create log:', err);
  }
}

module.exports = { createLog };
