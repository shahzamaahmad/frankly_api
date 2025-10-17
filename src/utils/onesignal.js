const axios = require('axios');

const sendNotification = async (title, message, userIds = null) => {
  try {
    const payload = {
      app_id: process.env.ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message },
    };

    if (userIds && userIds.length > 0) {
      payload.include_external_user_ids = userIds;
    } else {
      payload.included_segments = ['All'];
    }

    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('OneSignal error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { sendNotification };
