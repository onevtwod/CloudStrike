#!/usr/bin/env node

/**
 * Create DynamoDB table for tracking sent notifications to prevent duplicates
 */

const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function createNotificationsTrackingTable() {
    console.log('🗄️  Creating notifications tracking table...\n');

    try {
        const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

        // Check if table already exists
        console.log('🔍 Checking if table already exists...');
        const listCommand = new ListTablesCommand({});
        const listResponse = await client.send(listCommand);

        if (listResponse.TableNames && listResponse.TableNames.includes('disaster-notifications-sent')) {
            console.log('✅ Table "disaster-notifications-sent" already exists');
            return;
        }

        // Create the table
        console.log('📝 Creating table: disaster-notifications-sent');
        const createCommand = new CreateTableCommand({
            TableName: 'disaster-notifications-sent',
            KeySchema: [
                {
                    AttributeName: 'alertId',
                    KeyType: 'HASH' // Partition key
                },
                {
                    AttributeName: 'notificationType',
                    KeyType: 'RANGE' // Sort key
                }
            ],
            AttributeDefinitions: [
                {
                    AttributeName: 'alertId',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'notificationType',
                    AttributeType: 'S'
                }
            ],
            BillingMode: 'PAY_PER_REQUEST',
            TimeToLiveSpecification: {
                AttributeName: 'ttl',
                Enabled: true
            }
        });

        const response = await client.send(createCommand);
        console.log('✅ Table creation initiated');
        console.log(`   Table ARN: ${response.TableDescription.TableArn}`);
        console.log(`   Status: ${response.TableDescription.TableStatus}`);

        // Wait for table to be active
        console.log('\n⏳ Waiting for table to become active...');
        await waitForTableActive(client, 'disaster-notifications-sent');

        console.log('✅ Table "disaster-notifications-sent" is now active and ready to use!');

        console.log('\n📋 Table Details:');
        console.log('   Name: disaster-notifications-sent');
        console.log('   Purpose: Track sent notifications to prevent duplicates');
        console.log('   Primary Key: alertId (String) + notificationType (String)');
        console.log('   TTL: 30 days (automatic cleanup)');
        console.log('   Billing: Pay per request');

    } catch (error) {
        console.error('❌ Error creating notifications tracking table:', error.message);

        if (error.name === 'ResourceInUseException') {
            console.log('✅ Table already exists');
        } else {
            console.log('\n💡 Troubleshooting:');
            console.log('   1. Check your AWS credentials');
            console.log('   2. Verify AWS region is correct');
            console.log('   3. Ensure you have DynamoDB permissions');
        }
    }
}

async function waitForTableActive(client, tableName) {
    const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max wait

    while (attempts < maxAttempts) {
        try {
            const command = new DescribeTableCommand({ TableName: tableName });
            const response = await client.send(command);

            if (response.Table.TableStatus === 'ACTIVE') {
                return;
            }

            console.log(`   Status: ${response.Table.TableStatus} (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
        } catch (error) {
            console.log(`   Error checking table status: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            attempts++;
        }
    }

    console.log('⚠️  Table creation is taking longer than expected. Please check AWS console.');
}

// Run the script
if (require.main === module) {
    createNotificationsTrackingTable().then(() => {
        console.log('\n🏁 Script completed');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

module.exports = createNotificationsTrackingTable;
