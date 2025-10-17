const axios = require('axios');

const sendNotification = async (options) => {
  try {
    if (!process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error('ONESIGNAL_REST_API_KEY is not set in environment variables');
    }

    const {
      title,
      message,
      userIds,
      subtitle,
      imageUrl,
      actionButtons,
      launchUrl,
      data,
      priority,
      ttl,
      sendAfter,
    } = options;

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

    if (subtitle) payload.subtitle = { en: subtitle };
    if (imageUrl) payload.big_picture = imageUrl;
    if (actionButtons) payload.buttons = actionButtons;
    if (launchUrl) payload.url = launchUrl;
    if (data) payload.data = data;
    if (priority) payload.priority = priority;
    if (ttl) payload.ttl = ttl;
    if (sendAfter) payload.send_after = sendAfter;

    console.log('Sending OneSignal notification with payload:', JSON.stringify(payload, null, 2));
    console.log('Using API Key (first 20 chars):', process.env.ONESIGNAL_REST_API_KEY.substring(0, 20));

    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    console.log('OneSignal response:', response.data);
    return response.data;
  } catch (error) {
    console.error('OneSignal error:', error.response?.data || error.message);
    if (error.response?.data?.errors) {
      throw new Error(`OneSignal API Error: ${error.response.data.errors.join(', ')}`);
    }
    throw error;
  }
};

module.exports = { sendNotification };
