#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🌐 Setting up Web Application Environment...');

// Create .env file for web app
const webEnvContent = `# Disaster Detection Web App Environment Variables
# API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Google Maps API (Optional - for embedded maps)
VITE_MAPS_EMBED_API_KEY=

# Development Configuration
VITE_APP_NAME=Disaster Detection System
VITE_APP_VERSION=1.0.0
`;

const webEnvPath = path.join(__dirname, '..', 'apps', 'web', '.env');

try {
    fs.writeFileSync(webEnvPath, webEnvContent);
    console.log('✅ Web app .env file created successfully!');
    console.log(`📁 Location: ${webEnvPath}`);
    console.log('');
    console.log('🔧 Configuration:');
    console.log('   VITE_API_BASE_URL=http://localhost:3001');
    console.log('   VITE_MAPS_EMBED_API_KEY=(optional)');
    console.log('');
    console.log('💡 To add Google Maps integration:');
    console.log('   1. Get API key from: https://console.cloud.google.com/');
    console.log('   2. Add to .env: VITE_MAPS_EMBED_API_KEY=your_key_here');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. cd apps/web');
    console.log('   2. npm run dev');

} catch (error) {
    console.error('❌ Error creating web app .env file:', error.message);
    console.log('');
    console.log('📝 Please create the file manually:');
    console.log(`   File: ${webEnvPath}`);
    console.log('   Content:');
    console.log(webEnvContent);
}

// Also create .env.example for reference
const webEnvExamplePath = path.join(__dirname, '..', 'apps', 'web', '.env.example');
const webEnvExampleContent = `# Disaster Detection Web App Environment Variables
# Copy this file to .env and update with your values

# API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Google Maps API (Optional - for embedded maps)
VITE_MAPS_EMBED_API_KEY=your_google_maps_api_key_here

# Development Configuration
VITE_APP_NAME=Disaster Detection System
VITE_APP_VERSION=1.0.0
`;

try {
    fs.writeFileSync(webEnvExamplePath, webEnvExampleContent);
    console.log('✅ Web app .env.example file created successfully!');
} catch (error) {
    console.error('❌ Error creating .env.example file:', error.message);
}

console.log('');
console.log('🎯 Setup complete! The web app is now configured to connect to the API server.');
