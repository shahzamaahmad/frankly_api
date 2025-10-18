
const mongoose = require('mongoose');

const AppConfigSchema = new mongoose.Schema({
  companyName: { type: String, default: 'Frankly Built Contracting LLC' },
  companyDescription: { type: String, default: '' },
  companyAddress: { type: String, default: 'Dubai, UAE' },
  companyPhone: { type: String, default: '' },
  companyEmail: { type: String, default: '' },
  companyWebsite: { type: String, default: '' },
  companyLogo: { type: String, default: '' },
  headOfficeLocation: { type: String, default: '' },
  warehouseLocation: { type: String, default: '' },
  established: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  companyFacebook: { type: String, default: '' },
  companyInstagram: { type: String, default: '' },
  companyLinkedIn: { type: String, default: '' },
  companyTwitter: { type: String, default: '' },
  companyTikTok: { type: String, default: '' },
  
  appVersion: { type: String, default: '1.0.0' },
  appName: { type: String, default: 'Frankly' },
  appDescription: { type: String, default: '' },
  aboutPageContent: { type: String, default: '' },
  features: [{ type: String }],
  
  privacyPolicy: { type: String, default: '' },
  termsAndConditions: { type: String, default: '' },
  
  faqs: [{
    question: { type: String, required: true },
    answer: { type: String, required: true }
  }],
  
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  supportWhatsapp: { type: String, default: '' },
  
  developerName: { type: String, default: '' },
  developerEmail: { type: String, default: '' },
  developerPhone: { type: String, default: '' },
  developerLinkedIn: { type: String, default: '' },
  developerGithub: { type: String, default: '' },
  developerTwitter: { type: String, default: '' },
  
  isSingleton: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AppConfig', AppConfigSchema);
