#!/usr/bin/env node

const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

class SubscribersTableManager {
    constructor() {
        // Use AWS SDK default credential chain
        const config = {
            region: process.env.AWS_REGION || 'us-east-1'
        };

        // Only set explicit credentials if environment variables are provided
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };

            // Add session token if present (for temporary credentials)
            if (process.env.AWS_SESSION_TOKEN) {
                config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
            }
        }

        this.client = new DynamoDBClient(config);
        this.docClient = DynamoDBDocumentClient.from(this.client);

        this.tableName = 'disaster-subscribers';

        console.log('🗄️  Subscribers Table Manager initialized');
    }

    // Check if table exists
    async tableExists() {
        try {
            const command = new ListTablesCommand({});
            const response = await this.client.send(command);
            return response.TableNames?.includes(this.tableName) || false;
        } catch (error) {
            console.error('❌ Error checking if table exists:', error.message);
            return false;
        }
    }

    // Create the subscribers table
    async createTable() {
        try {
            console.log(`🔧 Creating DynamoDB table: ${this.tableName}`);

            const command = new CreateTableCommand({
                TableName: this.tableName,
                KeySchema: [
                    {
                        AttributeName: 'id',
                        KeyType: 'HASH' // Partition key
                    }
                ],
                AttributeDefinitions: [
                    {
                        AttributeName: 'id',
                        AttributeType: 'S'
                    },
                    {
                        AttributeName: 'location',
                        AttributeType: 'S'
                    },
                    {
                        AttributeName: 'subscribedAt',
                        AttributeType: 'S'
                    }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'location-subscribed-index',
                        KeySchema: [
                            {
                                AttributeName: 'location',
                                KeyType: 'HASH'
                            },
                            {
                                AttributeName: 'subscribedAt',
                                KeyType: 'RANGE'
                            }
                        ],
                        Projection: {
                            ProjectionType: 'ALL'
                        },
                        BillingMode: 'PAY_PER_REQUEST'
                    }
                ],
                BillingMode: 'PAY_PER_REQUEST',
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            });

            const response = await this.client.send(command);
            console.log(`   ✅ Table ${this.tableName} created successfully`);
            console.log(`   📊 Table ARN: ${response.TableDescription?.TableArn}`);

            // Wait for table to be active
            console.log('   ⏳ Waiting for table to become active...');
            await this.waitForTableActive();

            // Add additional delay to ensure table is fully ready for writes
            console.log('   ⏳ Waiting additional time for table to be fully ready for writes...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

            return response;

        } catch (error) {
            if (error.name === 'ResourceInUseException') {
                console.log(`   ℹ️  Table ${this.tableName} already exists`);
                return { message: 'Table already exists' };
            } else {
                console.error('❌ Error creating table:', error.message);
                throw error;
            }
        }
    }

    // Wait for table to become active
    async waitForTableActive() {
        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const command = new ListTablesCommand({});
                const response = await this.client.send(command);

                if (response.TableNames?.includes(this.tableName)) {
                    console.log(`   ✅ Table ${this.tableName} is now active`);
                    return true;
                }

                attempts++;
                console.log(`   ⏳ Waiting... (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error('❌ Error waiting for table:', error.message);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('   ⚠️  Timeout waiting for table to become active');
        return false;
    }

    // Create table if it doesn't exist
    async setupTable() {
        try {
            console.log('🔍 Checking if subscribers table exists...');

            const exists = await this.tableExists();

            if (exists) {
                console.log(`   ✅ Table ${this.tableName} already exists`);
                return { message: 'Table already exists' };
            } else {
                console.log(`   📝 Table ${this.tableName} does not exist, creating...`);
                return await this.createTable();
            }

        } catch (error) {
            console.error('❌ Error setting up table:', error.message);
            throw error;
        }
    }

    // Add some sample subscribers for testing
    async addSampleSubscribers() {
        try {
            console.log('📝 Adding sample subscribers...');

            const sampleSubscribers = [
                {
                    id: 'sample_001',
                    email: 'admin@example.com',
                    type: 'email',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: true
                    },
                    location: 'Kuala Lumpur',
                    active: true,
                    subscribedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
                },
                {
                    id: 'sample_002',
                    phone: '+60123456789',
                    type: 'sms',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: false,
                        systemStatus: false
                    },
                    location: 'Global', // Use 'Global' instead of null for GSI compatibility
                    active: true,
                    subscribedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
                },
                {
                    id: 'sample_003',
                    email: 'emergency@example.com',
                    phone: '+60198765432',
                    type: 'both',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: true
                    },
                    location: 'Kuala Lumpur',
                    active: true,
                    subscribedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
                }
            ];

            const { PutCommand } = require('@aws-sdk/lib-dynamodb');

            for (const subscriber of sampleSubscribers) {
                const command = new PutCommand({
                    TableName: this.tableName,
                    Item: subscriber
                });

                await this.docClient.send(command);
                console.log(`   ✅ Added subscriber: ${subscriber.id} (${subscriber.type})`);
            }

            console.log(`   📊 Successfully added ${sampleSubscribers.length} sample subscribers`);
            return sampleSubscribers;

        } catch (error) {
            console.error('❌ Error adding sample subscribers:', error.message);
            console.error('   Error name:', error.name);
            console.error('   Error code:', error.code);

            if (error.name === 'ResourceNotFoundException') {
                console.error('   📋 Troubleshooting:');
                console.error('   - The table might not be fully ready for writes yet');
                console.error('   - Try running the script again in a few seconds');
                console.error('   - Check if you have write permissions to the table');
            }

            throw error;
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Setting up DynamoDB Subscribers Table...\n');

    try {
        const manager = new SubscribersTableManager();

        // Setup the table
        await manager.setupTable();

        // Add sample subscribers
        console.log('\n📝 Adding sample subscribers...');
        await manager.addSampleSubscribers();

        console.log('\n✅ DynamoDB subscribers table setup completed successfully!');
        console.log('\n📋 What was created:');
        console.log('   🗄️  Table: disaster-subscribers');
        console.log('   📊 Primary Key: id (String)');
        console.log('   🔍 GSI: location-subscribed-index');
        console.log('   ⏰ TTL: Enabled (1 year)');
        console.log('   💰 Billing: Pay-per-request');
        console.log('\n📧 Sample subscribers added:');
        console.log('   - admin@example.com (email, all notifications)');
        console.log('   - +60123456789 (SMS, disaster & emergency only)');
        console.log('   - emergency@example.com & +60198765432 (both, all notifications)');

        console.log('\n🧪 You can now run the test script:');
        console.log('   node scripts/test-subscriber-notifications.js');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    main().then(() => {
        console.log('\n🏁 Setup completed');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
}

module.exports = SubscribersTableManager;
