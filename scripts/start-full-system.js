#!/usr/bin/env node

/**
 * Complete Disaster Detection System Startup Script
 * This script starts both the disaster detection system and the API server
 */

const DisasterAPIServer = require('./api-server');

console.log('🚀 Starting Complete Disaster Detection System...');
console.log('='.repeat(60));

// Check environment variables
const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please run: node setup-aws-credentials.js');
    process.exit(1);
}

console.log('✅ Environment variables configured');
console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set'}`);
console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set'}`);
console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1'}`);

// Check if DynamoDB tables exist
console.log('\n🗄️  Checking DynamoDB tables...');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function checkDynamoDBTables() {
    try {
        const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const command = new ListTablesCommand({});
        const response = await client.send(command);

        const requiredTables = [
            'disaster-raw-posts',
            'disaster-analyzed-posts',
            'disaster-events',
            'disaster-alerts',
            'disaster-verifications'
        ];

        const existingTables = response.TableNames || [];
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        if (missingTables.length > 0) {
            console.log('⚠️  Missing DynamoDB tables:');
            missingTables.forEach(table => {
                console.log(`   - ${table}`);
            });
            console.log('\n💡 Please run: node create-dynamodb-tables.js');
            return false;
        }

        console.log('✅ All required DynamoDB tables exist');
        return true;
    } catch (error) {
        console.error('❌ Error checking DynamoDB tables:', error.message);
        return false;
    }
}

// Main startup function
async function startSystem() {
    console.log('\n🔍 Pre-flight checks...');

    // Check DynamoDB tables
    const tablesExist = await checkDynamoDBTables();
    if (!tablesExist) {
        console.log('\n❌ Pre-flight checks failed. Please fix the issues above.');
        process.exit(1);
    }

    console.log('\n✅ All pre-flight checks passed!');
    console.log('\n🚀 Starting system components...');

    // Start the API server (which also starts the disaster detection system)
    const server = new DisasterAPIServer();
    server.start();

    console.log('\n🎉 System started successfully!');
    console.log('\n📋 Available endpoints:');
    console.log(`   GET  http://localhost:${process.env.PORT || 3001}/events`);
    console.log(`   GET  http://localhost:${process.env.PORT || 3001}/events/recent`);
    console.log(`   POST http://localhost:${process.env.PORT || 3001}/subscribe`);
    console.log(`   GET  http://localhost:${process.env.PORT || 3001}/stats`);
    console.log(`   POST http://localhost:${process.env.PORT || 3001}/ingest/twitter`);

    console.log('\n🌐 Web Frontend:');
    console.log(`   Set VITE_API_BASE_URL=http://localhost:${process.env.PORT || 3001} in your web app's .env file`);
    console.log(`   Then run: cd apps/web && npm run dev`);

    console.log('\n🛑 Press Ctrl+C to stop the system');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down disaster detection system...');
    process.exit(0);
});

// Start the system
startSystem().catch(error => {
    console.error('❌ Failed to start system:', error);
    process.exit(1);
});
