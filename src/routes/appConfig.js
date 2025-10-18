
const express = require('express');
const router = express.Router();
const AppConfig = require('../models/appConfig');
const checkPermission = require('../middlewares/checkPermission');

router.get('/', async (req, res) => {
  try {
    let config = await AppConfig.findOne({ isSingleton: true });
    if (!config) {
      config = new AppConfig();
      await config.save();
    }
    res.json(config);
  } catch (err) {
    console.error('Get app config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
