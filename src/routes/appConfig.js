const express = require('express');
const { fetchMany, insertRow } = require('../lib/db');

const router = express.Router();

function defaultAppConfig() {
  return {
    companyName: 'Frankly Built Contracting LLC',
    companyDescription: '',
    companyAddress: 'Dubai, UAE',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: '',
    companyLogo: '',
    headOfficeLocation: '',
    warehouseLocation: '',
    established: '',
    ownerName: '',
    companyFacebook: '',
    companyInstagram: '',
    companyLinkedIn: '',
    companyTwitter: '',
    companyTikTok: '',
    appVersion: '1.0.0',
    appName: 'Frankly',
    appDescription: '',
    aboutPageContent: '',
    features: [],
    privacyPolicy: '',
    termsAndConditions: '',
    faqs: [],
    supportEmail: '',
    supportPhone: '',
    supportWhatsapp: '',
    developerName: '',
    developerEmail: '',
    developerPhone: '',
    developerLinkedIn: '',
    developerGithub: '',
    developerTwitter: '',
    isSingleton: true,
  };
}

router.get('/', async (req, res) => {
  try {
    const configs = await fetchMany('appConfig', {
      filters: [{ column: 'isSingleton', operator: 'eq', value: true }],
      limit: 1,
    });

    let config = configs[0];
    if (!config) {
      config = await insertRow('appConfig', defaultAppConfig());
    }

    res.json(config);
  } catch (err) {
    console.error('Get app config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
