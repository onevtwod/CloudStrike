#!/usr/bin/env node

/**
 * DynamoDB Setup and Configuration Test
 * This test creates and configures DynamoDB tables for the disaster alert system
 * 
 * Data Flow Position: 2 - Data storage foundation
 * Dependencies: AWS Credentials (test-aws-credentials.js)
 * Tests: Table creation, GSI setup, TTL configuration, permissions
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDBSetupTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.tableName = process.env.EVENTS_TABLE || 'disaster-events-test';
        this.client = new DynamoDBClient({ region: this.region });
        this.docClient = DynamoDBDocumentClient.from(this.client);
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            info: '\x1b[34m',
            bold: '\x1b[1m',
            reset: '\x1b[0m'
        };

        const color = colors[type] || colors.info;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async checkTableExists(tableName) {
        try {
            const command = new DescribeTableCommand({ TableName: tableName });
            const response = await this.client.send(command);
            return response.Table;
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                return null;
            }
            throw error;
        }
    }

    async createMainTable() {
        this.log('🗄️ Creating main disaster events table...', 'bold');

        try {
            const existingTable = await this.checkTableExists(this.tableName);
            if (existingTable) {
                this.log(`⚠️ Table ${this.tableName} already exists`, 'warning');
                this.results.push({
                    test: 'Main Table Creation',
                    status: 'EXISTS',
                    details: {
                        tableName: this.tableName,
                        status: existingTable.TableStatus,
                        itemCount: existingTable.ItemCount || 0
                    }
                });
                return true;
            }

            const command = new CreateTableCommand({
                TableName: this.tableName,
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' },
                    { AttributeName: 'verified', AttributeType: 'N' },
                    { AttributeName: 'createdAt', AttributeType: 'S' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'verified-index',
                        KeySchema: [
                            { AttributeName: 'verified', KeyType: 'HASH' },
                            { AttributeName: 'createdAt', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                ],
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TimeToLiveSpecification: {
                    AttributeName: 'ttl',
                    Enabled: true
                },
                Tags: [
                    { Key: 'Project', Value: 'DisasterAlertSystem' },
                    { Key: 'Environment', Value: 'Test' },
                    { Key: 'Purpose', Value: 'DisasterEvents' }
                ]
            });

            const response = await this.client.send(command);

            this.results.push({
                test: 'Main Table Creation',
                status: 'SUCCESS',
                details: {
                    tableName: this.tableName,
                    status: response.TableDescription.TableStatus,
                    arn: response.TableDescription.TableArn
                }
            });

            this.log(`✅ Table ${this.tableName} created successfully`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Main Table Creation',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Failed to create table: ${error.message}`, 'error');
            return false;
        }
    }

    async waitForTableActive(tableName, maxWaitTime = 300000) {
        this.log(`⏳ Waiting for table ${tableName} to become active...`, 'info');

        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const table = await this.checkTableExists(tableName);
                if (table && table.TableStatus === 'ACTIVE') {
                    this.log(`✅ Table ${tableName} is now active`, 'success');
                    return true;
                }

                this.log(`   Status: ${table?.TableStatus || 'Unknown'}`, 'info');
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                this.log(`   Error checking status: ${error.message}`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        this.log(`⚠️ Timeout waiting for table ${tableName} to become active`, 'warning');
        return false;
    }

    async testTableOperations() {
        this.log('🧪 Testing table operations...', 'bold');

        try {
            // Test basic put operation
            const testItem = {
                id: 'test-item-' + Date.now(),
                text: 'Test disaster event',
                location: 'Test Location',
                eventType: 'Test Event',
                verified: 1,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 3600 // 1 hour TTL
            };

            const putCommand = new PutCommand({
                TableName: this.tableName,
                Item: testItem
            });

            await this.docClient.send(putCommand);
            this.log('✅ Put operation successful', 'success');

            // Test GSI query
            const queryCommand = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'verified-index',
                KeyConditionExpression: '#v = :v',
                ExpressionAttributeNames: { '#v': 'verified' },
                ExpressionAttributeValues: { ':v': 1 }
            });

            const queryResponse = await this.docClient.send(queryCommand);
            this.log(`✅ GSI query successful - Found ${queryResponse.Items?.length || 0} items`, 'success');

            // Test scan operation
            const scanCommand = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: '#v = :v',
                ExpressionAttributeNames: { '#v': 'verified' },
                ExpressionAttributeValues: { ':v': 1 }
            });

            const scanResponse = await this.docClient.send(scanCommand);
            this.log(`✅ Scan operation successful - Found ${scanResponse.Items?.length || 0} items`, 'success');

            this.results.push({
                test: 'Table Operations',
                status: 'SUCCESS',
                details: {
                    putOperation: true,
                    gsiQuery: true,
                    scanOperation: true,
                    testItemId: testItem.id
                }
            });

            return true;

        } catch (error) {
            this.results.push({
                test: 'Table Operations',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Table operations failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testGSIFunctionality() {
        this.log('🔍 Testing GSI functionality...', 'bold');

        try {
            // Insert test data with different verification statuses
            const testItems = [
                {
                    id: 'verified-item-1',
                    text: 'Verified disaster event 1',
                    location: 'Location A',
                    eventType: 'Flood',
                    verified: 1,
                    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                    ttl: Math.floor(Date.now() / 1000) + 3600
                },
                {
                    id: 'verified-item-2',
                    text: 'Verified disaster event 2',
                    location: 'Location B',
                    eventType: 'Fire',
                    verified: 1,
                    createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
                    ttl: Math.floor(Date.now() / 1000) + 3600
                },
                {
                    id: 'unverified-item-1',
                    text: 'Unverified event',
                    location: 'Location C',
                    eventType: 'Earthquake',
                    verified: 0,
                    createdAt: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + 3600
                }
            ];

            // Insert all test items
            for (const item of testItems) {
                const putCommand = new PutCommand({
                    TableName: this.tableName,
                    Item: item
                });
                await this.docClient.send(putCommand);
            }

            // Query verified items only
            const verifiedQuery = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'verified-index',
                KeyConditionExpression: '#v = :v',
                ExpressionAttributeNames: { '#v': 'verified' },
                ExpressionAttributeValues: { ':v': 1 },
                ScanIndexForward: false // Sort by createdAt descending
            });

            const verifiedResponse = await this.docClient.send(verifiedQuery);
            const verifiedCount = verifiedResponse.Items?.length || 0;

            // Query unverified items
            const unverifiedQuery = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'verified-index',
                KeyConditionExpression: '#v = :v',
                ExpressionAttributeNames: { '#v': 'verified' },
                ExpressionAttributeValues: { ':v': 0 }
            });

            const unverifiedResponse = await this.docClient.send(unverifiedQuery);
            const unverifiedCount = unverifiedResponse.Items?.length || 0;

            this.results.push({
                test: 'GSI Functionality',
                status: 'SUCCESS',
                details: {
                    verifiedItems: verifiedCount,
                    unverifiedItems: unverifiedCount,
                    totalTestItems: testItems.length
                }
            });

            this.log(`✅ GSI test successful - Verified: ${verifiedCount}, Unverified: ${unverifiedCount}`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'GSI Functionality',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ GSI test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testTTLConfiguration() {
        this.log('⏰ Testing TTL configuration...', 'bold');

        try {
            // Check if TTL is enabled
            const describeCommand = new DescribeTableCommand({ TableName: this.tableName });
            const response = await this.client.send(describeCommand);

            const ttlSpec = response.Table.TimeToLiveSpecification;
            const ttlEnabled = ttlSpec?.Enabled || false;
            const ttlAttribute = ttlSpec?.AttributeName || 'N/A';

            this.results.push({
                test: 'TTL Configuration',
                status: ttlEnabled ? 'SUCCESS' : 'WARNING',
                details: {
                    enabled: ttlEnabled,
                    attributeName: ttlAttribute
                }
            });

            if (ttlEnabled) {
                this.log(`✅ TTL is enabled with attribute: ${ttlAttribute}`, 'success');
            } else {
                this.log(`⚠️ TTL is not enabled`, 'warning');
            }

            return ttlEnabled;

        } catch (error) {
            this.results.push({
                test: 'TTL Configuration',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ TTL test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testTablePermissions() {
        this.log('🔒 Testing table permissions...', 'bold');

        try {
            // Test read permissions
            const scanCommand = new ScanCommand({
                TableName: this.tableName,
                Limit: 1
            });
            await this.docClient.send(scanCommand);

            // Test write permissions
            const testItem = {
                id: 'permission-test-' + Date.now(),
                text: 'Permission test',
                verified: 0,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 3600
            };

            const putCommand = new PutCommand({
                TableName: this.tableName,
                Item: testItem
            });
            await this.docClient.send(putCommand);

            this.results.push({
                test: 'Table Permissions',
                status: 'SUCCESS',
                details: {
                    readPermission: true,
                    writePermission: true
                }
            });

            this.log('✅ Table permissions are correct', 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Table Permissions',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Permission test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async cleanupTestData() {
        this.log('🧹 Cleaning up test data...', 'info');

        try {
            // Scan for test items and delete them
            const scanCommand = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: 'begins_with(id, :prefix)',
                ExpressionAttributeValues: {
                    ':prefix': 'test-'
                }
            });

            const response = await this.docClient.send(scanCommand);
            const testItems = response.Items || [];

            for (const item of testItems) {
                const deleteCommand = new PutCommand({
                    TableName: this.tableName,
                    Item: {
                        ...item,
                        ttl: Math.floor(Date.now() / 1000) - 1 // Set TTL to past to trigger deletion
                    }
                });
                await this.docClient.send(deleteCommand);
            }

            this.log(`✅ Cleaned up ${testItems.length} test items`, 'success');
            return true;

        } catch (error) {
            this.log(`⚠️ Cleanup failed: ${error.message}`, 'warning');
            return false;
        }
    }

    async runAllTests() {
        this.log('🚀 Starting DynamoDB Setup Test', 'bold');
        this.log('='.repeat(60), 'bold');
        this.log(`Table: ${this.tableName}`, 'info');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Start Time: ${new Date().toISOString()}`, 'info');
        this.log('='.repeat(60), 'bold');

        const tests = [
            () => this.createMainTable(),
            () => this.waitForTableActive(this.tableName),
            () => this.testTableOperations(),
            () => this.testGSIFunctionality(),
            () => this.testTTLConfiguration(),
            () => this.testTablePermissions()
        ];

        let successCount = 0;
        let totalCount = tests.length;

        for (const test of tests) {
            try {
                const success = await test();
                if (success) successCount++;
            } catch (error) {
                this.log(`❌ Test failed with error: ${error.message}`, 'error');
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Cleanup test data
        await this.cleanupTestData();

        this.printSummary(successCount, totalCount);
    }

    printSummary(successCount, totalCount) {
        const totalDuration = Date.now() - this.startTime;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 DYNAMODB SETUP TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        this.log(`\nTotal Tests: ${totalCount}`, 'info');
        this.log(`Successful: ${successCount}`, 'info');
        this.log(`Failed: ${totalCount - successCount}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');
        this.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach((result, index) => {
            const status = result.status === 'SUCCESS' ? '✅' :
                result.status === 'FAILED' ? '❌' :
                    result.status === 'WARNING' ? '⚠️' : 'ℹ️';

            console.log(`\n${index + 1}. ${status} ${result.test}`);
            if (result.details) {
                Object.entries(result.details).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        this.log('\n🎯 NEXT STEPS:', 'bold');
        if (successCount === totalCount) {
            this.log('🎉 DynamoDB setup complete! Ready for data operations.', 'success');
            this.log('   • Run: node test-secrets-manager.js', 'info');
            this.log('   • Set EVENTS_TABLE environment variable', 'info');
        } else {
            this.log('⚠️ Some tests failed. Please check:', 'warning');
            this.log('   • AWS permissions for DynamoDB', 'info');
            this.log('   • Table creation parameters', 'info');
            this.log('   • GSI configuration', 'info');
        }

        this.log('\n' + '='.repeat(60), 'bold');
    }
}

// Run the test
async function main() {
    const tester = new DynamoDBSetupTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DynamoDBSetupTester;
