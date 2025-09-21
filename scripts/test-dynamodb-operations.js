#!/usr/bin/env node

/**
 * Test DynamoDB Operations
 * This script tests DynamoDB table creation, basic CRUD operations, and GSI functionality
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class DynamoDBTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.tableName = process.env.EVENTS_TABLE || 'disaster-events-test';
        this.ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: this.region }));
        this.results = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testOperation(operationName, testFunction, description) {
        try {
            this.log(`Testing ${operationName}...`, 'info');
            const startTime = Date.now();
            const result = await testFunction();
            const duration = Date.now() - startTime;

            this.results.push({
                operation: operationName,
                status: 'SUCCESS',
                duration: `${duration}ms`,
                description,
                result
            });

            this.log(`✓ ${operationName} - ${description} (${duration}ms)`, 'success');
            return result;
        } catch (error) {
            this.results.push({
                operation: operationName,
                status: 'FAILED',
                error: error.message,
                description
            });

            this.log(`✗ ${operationName} - ${error.message}`, 'error');
            return null;
        }
    }

    async testDynamoDBOperations() {
        this.log('🗄️  Testing DynamoDB Operations', 'bold');
        this.log(`Table: ${this.tableName}`, 'info');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        // Test 1: Put Item
        const testItem = {
            id: 'test-' + Date.now(),
            text: 'Test disaster event - flooding in Kuala Lumpur',
            location: 'Kuala Lumpur',
            coordinates: { lat: 3.1390, lng: 101.6869 },
            eventType: 'flood',
            verified: 1,
            createdAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
        };

        await this.testOperation(
            'Put Item',
            () => this.ddb.send(new PutCommand({
                TableName: this.tableName,
                Item: testItem
            })),
            'Insert test disaster event'
        );

        // Test 2: Get Item
        await this.testOperation(
            'Get Item',
            () => this.ddb.send(new GetCommand({
                TableName: this.tableName,
                Key: { id: testItem.id }
            })),
            'Retrieve test disaster event by ID'
        );

        // Test 3: Query by GSI (verified index)
        await this.testOperation(
            'Query GSI',
            () => this.ddb.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'verified-index',
                KeyConditionExpression: 'verified = :verified',
                ExpressionAttributeValues: {
                    ':verified': 1
                }
            })),
            'Query verified events using GSI'
        );

        // Test 4: Scan Table
        await this.testOperation(
            'Scan Table',
            () => this.ddb.send(new ScanCommand({
                TableName: this.tableName,
                Limit: 10
            })),
            'Scan table for recent events'
        );

        // Test 5: Batch Operations (Multiple Items)
        const batchItems = [
            {
                id: 'batch-test-1-' + Date.now(),
                text: 'Batch test event 1 - earthquake in Sabah',
                location: 'Sabah',
                coordinates: { lat: 5.9804, lng: 116.0753 },
                eventType: 'earthquake',
                verified: 0,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
            },
            {
                id: 'batch-test-2-' + Date.now(),
                text: 'Batch test event 2 - fire in Penang',
                location: 'Penang',
                coordinates: { lat: 5.4164, lng: 100.3327 },
                eventType: 'fire',
                verified: 1,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
            }
        ];

        for (const item of batchItems) {
            await this.testOperation(
                `Put Item (${item.id})`,
                () => this.ddb.send(new PutCommand({
                    TableName: this.tableName,
                    Item: item
                })),
                `Insert batch test item: ${item.eventType}`
            );
        }

        // Test 6: Complex Query with Filters
        await this.testOperation(
            'Complex Query',
            () => this.ddb.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'verified-index',
                KeyConditionExpression: 'verified = :verified',
                FilterExpression: 'eventType = :eventType',
                ExpressionAttributeValues: {
                    ':verified': 1,
                    ':eventType': 'flood'
                }
            })),
            'Query verified flood events only'
        );

        // Test 7: Update Item (simulate verification)
        await this.testOperation(
            'Update Item',
            () => this.ddb.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    ...testItem,
                    verified: 1,
                    verifiedAt: new Date().toISOString(),
                    severity: 0.8
                }
            })),
            'Update item with verification details'
        );

        // Test 8: Delete Item (cleanup)
        await this.testOperation(
            'Delete Item',
            () => this.ddb.send(new DeleteCommand({
                TableName: this.tableName,
                Key: { id: testItem.id }
            })),
            'Delete test item (cleanup)'
        );

        // Cleanup batch items
        for (const item of batchItems) {
            await this.ddb.send(new DeleteCommand({
                TableName: this.tableName,
                Key: { id: item.id }
            })).catch(() => { }); // Ignore cleanup errors
        }

        this.printSummary();
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 DYNAMODB TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        const successCount = this.results.filter(r => r.status === 'SUCCESS').length;
        const totalCount = this.results.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log(`\nTotal Operations: ${totalCount}`, 'info');
        this.log(`Successful: ${colors.green}${successCount}${colors.reset}`, 'info');
        this.log(`Failed: ${colors.red}${totalCount - successCount}${colors.reset}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach(result => {
            const status = result.status === 'SUCCESS' ?
                `${colors.green}✓${colors.reset}` :
                `${colors.red}✗${colors.reset}`;

            console.log(`${status} ${result.operation}: ${result.description}`);
            if (result.status === 'SUCCESS' && result.duration) {
                console.log(`   Duration: ${result.duration}`);
            }
            if (result.status === 'FAILED' && result.error) {
                console.log(`   Error: ${colors.red}${result.error}${colors.reset}`);
            }
        });

        if (successCount === totalCount) {
            this.log('\n🎉 All DynamoDB operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check table configuration and permissions.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new DynamoDBTester();
    await tester.testDynamoDBOperations();

    // Exit with non-zero code if any tests failed
    const successCount = tester.results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = tester.results.length;

    if (successCount !== totalCount) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DynamoDBTester;
