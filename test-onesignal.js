require('dotenv').config();
const axios = require('axios');

const testUserId = process.argv[2];

if (!testUserId) {
  console.log('Usage: node test-onesignal.js <user_mongodb_id>');
  process.exit(1);
}

if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
  console.error('ERROR: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set in .env');
  process.exit(1);
}

console.log('Testing OneSignal notification...');
console.log('App ID:', process.env.ONESIGNAL_APP_ID);
console.log('Target User ID:', testUserId);

axios.post('https://onesignal.com/api/v1/notifications', {
  app_id: process.env.ONESIGNAL_APP_ID,
  include_external_user_ids: [testUserId],
  headings: { en: 'Test Notification' },
  contents: { en: 'This is a test notification from the backend' }
}, {
  headers: { 'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}` }
}).then(response => {
  console.log('SUCCESS! Notification sent:', response.data);
}).catch(error => {
  console.error('ERROR:', error.response?.data || error.message);
});
