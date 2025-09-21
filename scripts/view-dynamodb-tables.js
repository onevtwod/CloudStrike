#!/usr/bin/env node

// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDBTableViewer {
    constructor() {
        // Use AWS SDK default credential chain (same as test files)
        this.client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1'
        });

        this.docClient = DynamoDBDocumentClient.from(this.client);

        this.disasterTables = {
            rawPosts: 'disaster-raw-posts',
            analyzedPosts: 'disaster-analyzed-posts',
            events: 'disaster-events',
            alerts: 'disaster-alerts',
            verifications: 'disaster-verifications'
        };
    }

    async listAllTables() {
        try {
            console.log('📋 Listing All DynamoDB Tables\n');

            const command = new ListTablesCommand({});
            const response = await this.client.send(command);

            console.log(`Found ${response.TableNames.length} tables in ${process.env.AWS_REGION || 'us-east-1'}:\n`);

            response.TableNames.forEach((tableName, index) => {
                const isDisasterTable = Object.values(this.disasterTables).includes(tableName);
                const icon = isDisasterTable ? '🎯' : '📊';
                console.log(`   ${index + 1}. ${icon} ${tableName} ${isDisasterTable ? '(Disaster System)' : ''}`);
            });

            return response.TableNames;
        } catch (error) {
            console.error('❌ Error listing tables:', error.message);
            return [];
        }
    }

    async viewTableContents(tableName, limit = 5) {
        try {
            console.log(`\n🔍 Viewing contents of table: ${tableName}\n`);

            const command = new ScanCommand({
                TableName: tableName,
                Limit: limit
            });

            const response = await this.docClient.send(command);

            console.log(`Found ${response.Count} items (showing first ${limit}):\n`);

            if (response.Items && response.Items.length > 0) {
                response.Items.forEach((item, index) => {
                    console.log(`📄 Item ${index + 1}:`);
                    console.log(`   ID: ${item.id || 'N/A'}`);

                    if (item.text) {
                        const text = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
                        console.log(`   Text: ${text}`);
                    }

                    if (item.location) console.log(`   Location: ${item.location}`);
                    if (item.timestamp) console.log(`   Timestamp: ${item.timestamp}`);
                    if (item.severity) console.log(`   Severity: ${item.severity}`);
                    if (item.confidence) console.log(`   Confidence: ${item.confidence}`);
                    if (item.type) console.log(`   Type: ${item.type}`);
                    if (item.verified !== undefined) console.log(`   Verified: ${item.verified}`);

                    console.log('');
                });
            } else {
                console.log('   Table is empty');
            }

            return response.Items;
        } catch (error) {
            console.error(`❌ Error viewing table ${tableName}:`, error.message);
            return [];
        }
    }

    async viewDisasterTables() {
        console.log('🎯 Viewing Disaster Detection System Tables\n');

        for (const [tableType, tableName] of Object.entries(this.disasterTables)) {
            await this.viewTableContents(tableName, 3);
        }
    }

    async getTableStats() {
        console.log('📊 Table Statistics\n');

        for (const [tableType, tableName] of Object.entries(this.disasterTables)) {
            try {
                const command = new ScanCommand({
                    TableName: tableName,
                    Select: 'COUNT'
                });

                const response = await this.docClient.send(command);
                console.log(`   ${tableName}: ${response.Count} items`);
            } catch (error) {
                console.log(`   ${tableName}: Table not found or error`);
            }
        }
    }

    async searchInTable(tableName, searchTerm) {
        try {
            console.log(`\n🔍 Searching for "${searchTerm}" in table: ${tableName}\n`);

            const command = new ScanCommand({
                TableName: tableName,
                FilterExpression: 'contains(text, :searchTerm)',
                ExpressionAttributeValues: {
                    ':searchTerm': searchTerm
                },
                Limit: 10
            });

            const response = await this.docClient.send(command);

            console.log(`Found ${response.Count} items containing "${searchTerm}":\n`);

            if (response.Items && response.Items.length > 0) {
                response.Items.forEach((item, index) => {
                    console.log(`📄 Item ${index + 1}:`);
                    console.log(`   ID: ${item.id}`);
                    if (item.text) console.log(`   Text: ${item.text}`);
                    if (item.location) console.log(`   Location: ${item.location}`);
                    console.log('');
                });
            } else {
                console.log('   No items found');
            }

            return response.Items;
        } catch (error) {
            console.error(`❌ Error searching in table ${tableName}:`, error.message);
            return [];
        }
    }
}

async function main() {
    console.log('🗄️  DynamoDB Table Viewer\n');

    // Check credentials
    console.log('🔑 Checking AWS Credentials:');
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}\n`);

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('❌ AWS credentials not found. Please set up your .env file first.');
        return;
    }

    const viewer = new DynamoDBTableViewer();

    try {
        // List all tables
        const tables = await viewer.listAllTables();

        // Show statistics
        await viewer.getTableStats();

        // View disaster system tables
        await viewer.viewDisasterTables();

        console.log('\n✅ Table viewing completed!');
        console.log('\n💡 Tips:');
        console.log('   - Use AWS Console for a visual interface: https://console.aws.amazon.com/dynamodb/');
        console.log('   - Run specific searches: node view-dynamodb-tables.js search "earthquake"');
        console.log('   - View specific table: node view-dynamodb-tables.js table disaster-events');

    } catch (error) {
        console.error('\n❌ Error:', error.message);

        if (error.message.includes('security token')) {
            console.log('\n💡 Your AWS credentials may be expired. Please update them.');
        } else if (error.message.includes('Access Denied')) {
            console.log('\n💡 Your AWS user needs DynamoDB permissions.');
        }
    }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length > 0) {
    const viewer = new DynamoDBTableViewer();

    if (args[0] === 'search' && args[1]) {
        // Search in all tables
        viewer.searchInTable('disaster-raw-posts', args[1]);
        viewer.searchInTable('disaster-events', args[1]);
    } else if (args[0] === 'table' && args[1]) {
        // View specific table
        viewer.viewTableContents(args[1]);
    }
} else {
    // Run main function
    main().catch(console.error);
}

module.exports = DynamoDBTableViewer;
