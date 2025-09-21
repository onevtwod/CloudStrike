#!/usr/bin/env node

/**
 * Create Test DynamoDB Table
 * This script creates the disaster-events-test table with the correct structure for testing
 */

// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

class TestTableCreator {
    constructor() {
        // Use AWS profile from environment or default credential chain
        this.client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1'
            // Let AWS SDK use default credential chain (AWS profile, IAM roles, etc.)
        });

        this.tableName = process.env.EVENTS_TABLE || 'disaster-events-test';
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

    async createTestTable() {
        const tableConfig = {
            TableName: this.tableName,
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' },
                { AttributeName: 'verified', AttributeType: 'N' },
                { AttributeName: 'eventType', AttributeType: 'S' },
                { AttributeName: 'createdAt', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'verified-index',
                    KeySchema: [
                        { AttributeName: 'verified', KeyType: 'HASH' }
                    ],
                    Projection: { ProjectionType: 'ALL' },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                },
                {
                    IndexName: 'eventType-createdAt-index',
                    KeySchema: [
                        { AttributeName: 'eventType', KeyType: 'HASH' },
                        { AttributeName: 'createdAt', KeyType: 'RANGE' }
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
        };

        try {
            const exists = await this.tableExists(this.tableName);
            if (exists) {
                console.log(`✅ Table ${this.tableName} already exists`);
                return true;
            }

            console.log(`🔨 Creating test table ${this.tableName}...`);
            const command = new CreateTableCommand(tableConfig);
            await this.client.send(command);
            console.log(`✅ Table ${this.tableName} created successfully`);

            // Wait for table to be active
            console.log('⏳ Waiting for table to become active...');
            await this.waitForTableActive();

            return true;
        } catch (error) {
            console.error(`❌ Error creating table ${this.tableName}:`, error.message);
            return false;
        }
    }

    async waitForTableActive() {
        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const command = new DescribeTableCommand({ TableName: this.tableName });
                const response = await this.client.send(command);

                if (response.Table.TableStatus === 'ACTIVE') {
                    console.log('✅ Table is now active and ready for testing');
                    return true;
                }

                console.log(`⏳ Table status: ${response.Table.TableStatus}, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                attempts++;
            } catch (error) {
                console.log('⏳ Waiting for table to be available...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;
            }
        }

        console.log('⚠️  Table creation timeout - it may still be initializing');
        return false;
    }
}

// Run the table creation
async function main() {
    console.log('🏗️  Creating Test DynamoDB Table\n');

    // Check AWS credentials
    console.log('🔑 Checking AWS Credentials:');
    console.log(`   AWS_PROFILE: ${process.env.AWS_PROFILE || 'default'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}\n`);

    // Test AWS credentials by calling get-caller-identity
    try {
        const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
        const stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        console.log(`   ✅ AWS credentials valid for account: ${identity.Account}`);
    } catch (error) {
        console.log('❌ AWS credentials not valid or expired.');
        console.log('   Please run: aws sso login --profile awsisb_IsbUsersPS-843976229055');
        process.exit(1);
    }

    const creator = new TestTableCreator();
    const success = await creator.createTestTable();

    if (success) {
        console.log('\n🎉 Test table is ready!');
        console.log('\n🚀 Next Steps:');
        console.log('   1. Run: node test-dynamodb-operations.js');
        console.log('   2. The test should now work without "Requested resource not found" errors');
    } else {
        console.log('\n❌ Failed to create test table. Please check the errors above.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TestTableCreator;
