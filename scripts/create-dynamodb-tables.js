#!/usr/bin/env node

// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

class DynamoDBTableCreator {
    constructor() {
        // Build credentials object
        const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
        };

        // Add session token if present (for temporary credentials)
        if (process.env.AWS_SESSION_TOKEN) {
            credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }

        this.client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: credentials
        });

        this.tables = {
            rawPosts: {
                TableName: 'disaster-raw-posts',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'timestamp', AttributeType: 'S' },
                    { AttributeName: 'location', AttributeType: 'S' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'timestamp-index',
                        KeySchema: [
                            { AttributeName: 'timestamp', KeyType: 'HASH' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'location-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'location', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            },
            analyzedPosts: {
                TableName: 'disaster-analyzed-posts',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'timestamp', AttributeType: 'S' },
                    { AttributeName: 'location', AttributeType: 'S' },
                    { AttributeName: 'isDisasterRelated', AttributeType: 'BOOL' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'timestamp-index',
                        KeySchema: [
                            { AttributeName: 'timestamp', KeyType: 'HASH' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'location-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'location', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'disaster-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'isDisasterRelated', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            },
            events: {
                TableName: 'disaster-events',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'timestamp', AttributeType: 'S' },
                    { AttributeName: 'location', AttributeType: 'S' },
                    { AttributeName: 'type', AttributeType: 'S' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'timestamp-index',
                        KeySchema: [
                            { AttributeName: 'timestamp', KeyType: 'HASH' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'location-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'location', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'type-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'type', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            },
            alerts: {
                TableName: 'disaster-alerts',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'timestamp', AttributeType: 'S' },
                    { AttributeName: 'location', AttributeType: 'S' },
                    { AttributeName: 'severity', AttributeType: 'N' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'timestamp-index',
                        KeySchema: [
                            { AttributeName: 'timestamp', KeyType: 'HASH' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'location-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'location', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'severity-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'severity', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            },
            verifications: {
                TableName: 'disaster-verifications',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'timestamp', AttributeType: 'S' },
                    { AttributeName: 'eventId', AttributeType: 'S' },
                    { AttributeName: 'alertId', AttributeType: 'S' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'timestamp-index',
                        KeySchema: [
                            { AttributeName: 'timestamp', KeyType: 'HASH' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'event-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'eventId', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    },
                    {
                        IndexName: 'alert-timestamp-index',
                        KeySchema: [
                            { AttributeName: 'alertId', KeyType: 'HASH' },
                            { AttributeName: 'timestamp', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                }
            }
        };
    }

    async tableExists(tableName) {
        try {
            const command = new DescribeTableCommand({ TableName: tableName });
            await this.client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                return false;
            }
            throw error;
        }
    }

    async createTable(tableConfig) {
        try {
            const exists = await this.tableExists(tableConfig.TableName);
            if (exists) {
                console.log(`   ✅ Table ${tableConfig.TableName} already exists`);
                return true;
            }

            console.log(`   🔨 Creating table ${tableConfig.TableName}...`);
            const command = new CreateTableCommand(tableConfig);
            await this.client.send(command);
            console.log(`   ✅ Table ${tableConfig.TableName} created successfully`);
            return true;
        } catch (error) {
            console.error(`   ❌ Error creating table ${tableConfig.TableName}:`, error.message);
            return false;
        }
    }

    async createAllTables() {
        console.log('🏗️  Creating DynamoDB Tables for Disaster Detection System\n');

        // Check AWS credentials
        console.log('🔑 Checking AWS Credentials:');
        console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
        console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
        console.log(`   AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? '✅ Set' : '❌ Not set'}`);
        console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}\n`);

        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.log('❌ AWS credentials not found in environment variables.');
            console.log('   Please run: node setup-aws-credentials.js');
            return false;
        }

        let successCount = 0;
        const totalTables = Object.keys(this.tables).length;

        for (const [tableName, tableConfig] of Object.entries(this.tables)) {
            const success = await this.createTable(tableConfig);
            if (success) successCount++;
        }

        console.log(`\n📊 Table Creation Summary: ${successCount}/${totalTables} tables ready`);

        if (successCount === totalTables) {
            console.log('\n✅ All DynamoDB tables are ready!');
            console.log('\n🚀 Next Steps:');
            console.log('   1. Run: node test-dynamodb-with-env.js');
            console.log('   2. Run the full system: npm run enhanced-comprehensive');
        } else {
            console.log('\n⚠️  Some tables failed to create. Please check the errors above.');
        }

        return successCount === totalTables;
    }
}

// Run the table creation
async function main() {
    const creator = new DynamoDBTableCreator();
    await creator.createAllTables();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DynamoDBTableCreator;
