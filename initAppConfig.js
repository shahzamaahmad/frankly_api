require('dotenv').config();

const { fetchMany, insertRow } = require('./src/lib/db');
const { getSupabaseAdmin } = require('./src/lib/supabase');

async function initAppConfig() {
  try {
    getSupabaseAdmin();

    const existing = await fetchMany('appConfig', {
      filters: [{ column: 'isSingleton', operator: 'eq', value: true }],
      limit: 1,
    });

    if (existing[0]) {
      console.log('AppConfig already exists');
      process.exit(0);
    }

    await insertRow('appConfig', {
      companyName: 'Frankly Built Contracting LLC',
      companyDescription: 'Frankly Built Contracting LLC is a leading construction and contracting company based in Dubai, UAE. We specialize in delivering high-quality construction projects, infrastructure development, and comprehensive contracting solutions.',
      companyAddress: 'Dubai, UAE',
      companyPhone: '+971-XX-XXXXXXX',
      companyEmail: 'info@franklybuilt.com',
      companyWebsite: 'www.franklybuilt.com',
      headOfficeLocation: 'Dubai, UAE',
      warehouseLocation: 'Dubai, UAE',
      established: '2020',
      ownerName: 'Shahzama Ahmad',
      companyFacebook: 'https://facebook.com/franklybuilt',
      companyInstagram: 'https://instagram.com/franklybuilt',
      companyLinkedIn: 'https://linkedin.com/company/franklybuilt',
      companyTwitter: 'https://twitter.com/franklybuilt',
      companyTikTok: 'https://tiktok.com/@franklybuilt',
      appVersion: '1.0.0',
      appName: 'Frankly',
      appDescription: 'A comprehensive warehouse management system designed to streamline construction operations through efficient inventory control, employee management, site monitoring, and GPS-enabled attendance tracking.',
      aboutPageContent: 'Frankly is a full-featured warehouse management system built specifically for construction and contracting operations. The application provides real-time inventory tracking, employee attendance monitoring with GPS verification, site-specific item management, and comprehensive reporting capabilities. With role-based access control and multi-user support, teams can collaborate efficiently while maintaining security and accountability.',
      features: [
        'Dashboard with Real-time Statistics',
        'Inventory Management (Add, Edit, Delete, View)',
        'Transaction Tracking (Issue/Return)',
        'Site Management with Item Tracking',
        'Employee Management with Permissions',
        'GPS-enabled Attendance System',
        'Delivery Management',
        'Contact Management',
        'Document Expiry Notifications',
        'CSV/PDF Export for Reports',
        'Role-based Access Control',
        'Asset Assignment to Employees',
        'Image Upload with CDN Support'
      ],
      privacyPolicy: 'Privacy policy content here...',
      termsAndConditions: 'Terms and conditions content here...',
      faqs: [
        {
          question: 'How do I add inventory items?',
          answer: 'Navigate to Inventory menu and click Add Item button.'
        },
        {
          question: 'How do I track attendance?',
          answer: 'Use the Attendance screen to check-in and check-out with GPS location.'
        },
        {
          question: 'How do I create a delivery?',
          answer: 'Go to Deliveries menu and click Add Delivery, then add items and invoice details.'
        }
      ],
      supportEmail: 'support@franklybuilt.com',
      supportPhone: '+971-XX-XXXXXXX',
      supportWhatsapp: '+971-XX-XXXXXXX',
      developerName: 'Shahzama Ahmad',
      developerEmail: 'shahzama@example.com',
      developerPhone: '+92-XXX-XXXXXXX',
      developerLinkedIn: 'https://linkedin.com/in/shahzama',
      developerGithub: 'https://github.com/shahzama',
      developerTwitter: 'https://twitter.com/shahzama',
      isSingleton: true,
    });

    console.log('AppConfig created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

initAppConfig();
