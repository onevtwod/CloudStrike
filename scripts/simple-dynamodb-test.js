#!/usr/bin/env node

// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function simpleDynamoDBTest() {
    console.log('🧪 Simple DynamoDB Credentials Test\n');

    // Check if AWS credentials are loaded
    console.log('🔑 Checking AWS Credentials:');
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}\n`);

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('❌ AWS credentials not found in environment variables.');
        console.log('   Please create a .env file with your AWS credentials:');
        console.log('   AWS_ACCESS_KEY_ID=your_access_key');
        console.log('   AWS_SECRET_ACCESS_KEY=your_secret_key');
        console.log('   AWS_REGION=us-east-1');
        return;
    }

    try {
        // Build credentials object
        const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };

        // Add session token if present (for temporary credentials)
        if (process.env.AWS_SESSION_TOKEN) {
            credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }

        // Create DynamoDB client
        const client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: credentials
        });

        const docClient = DynamoDBDocumentClient.from(client);

        console.log('🔗 Testing AWS Connection...');

        // Test 1: List tables to verify credentials
        const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
        const listCommand = new ListTablesCommand({});
        const tablesResponse = await client.send(listCommand);

        console.log('   ✅ AWS credentials are valid!');
        console.log(`   📊 Found ${tablesResponse.TableNames.length} DynamoDB tables`);

        if (tablesResponse.TableNames.length > 0) {
            console.log('   📋 Existing tables:');
            tablesResponse.TableNames.forEach((tableName, index) => {
                console.log(`      ${index + 1}. ${tableName}`);
            });
        }

        // Test 2: Try to create a simple test table if it doesn't exist
        const testTableName = 'simple-test-table';
        const tableExists = tablesResponse.TableNames.includes(testTableName);

        if (!tableExists) {
            console.log(`\n🔨 Creating test table: ${testTableName}`);

            const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
            const createCommand = new CreateTableCommand({
                TableName: testTableName,
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            });

            await client.send(createCommand);
            console.log(`   ✅ Test table created successfully`);

            // Wait a moment for table to be ready
            console.log('   ⏳ Waiting for table to be ready...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            console.log(`\n✅ Test table ${testTableName} already exists`);
        }

        // Test 3: Insert a simple test item
        console.log('\n📝 Testing Data Insertion...');
        const testItem = {
            id: `test_${Date.now()}`,
            message: 'Hello DynamoDB!',
            timestamp: new Date().toISOString(),
            testData: {
                number: 42,
                boolean: true,
                array: ['item1', 'item2', 'item3']
            }
        };

        const putCommand = new PutCommand({
            TableName: testTableName,
            Item: testItem
        });

        await docClient.send(putCommand);
        console.log('   ✅ Test item inserted successfully');
        console.log(`   📝 Item ID: ${testItem.id}`);

        // Test 4: Read the item back
        console.log('\n📖 Testing Data Retrieval...');
        const scanCommand = new ScanCommand({
            TableName: testTableName,
            Limit: 1
        });

        const scanResponse = await docClient.send(scanCommand);
        console.log('   ✅ Data retrieved successfully');
        console.log(`   📊 Found ${scanResponse.Count} item(s)`);

        if (scanResponse.Items && scanResponse.Items.length > 0) {
            console.log('   📋 Sample item:');
            console.log(`      ID: ${scanResponse.Items[0].id}`);
            console.log(`      Message: ${scanResponse.Items[0].message}`);
            console.log(`      Timestamp: ${scanResponse.Items[0].timestamp}`);
        }

        // Test 5: Clean up test table
        console.log('\n🧹 Cleaning up test table...');
        const { DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
        const deleteCommand = new DeleteTableCommand({
            TableName: testTableName
        });

        await client.send(deleteCommand);
        console.log('   ✅ Test table deleted successfully');

        console.log('\n🎉 All DynamoDB Tests Passed!');
        console.log('\n✅ Your AWS credentials are working correctly');
        console.log('✅ DynamoDB access is functional');
        console.log('✅ Data insertion and retrieval works');
        console.log('✅ You can now use the full disaster detection system');

        console.log('\n🚀 Next Steps:');
        console.log('   1. Run: npm run create-tables (to create production tables)');
        console.log('   2. Run: npm run test-dynamodb-env (to test full system)');
        console.log('   3. Run: npm run enhanced-comprehensive (to run the full system)');

    } catch (error) {
        console.error('\n❌ DynamoDB Test Failed:');
        console.error(`   Error: ${error.message}`);

        if (error.message.includes('security token')) {
            console.log('\n💡 Security Token Issue:');
            console.log('   Your AWS credentials are invalid or expired.');
            console.log('\n🔧 Solutions:');
            console.log('   1. Check your .env file for typos');
            console.log('   2. Verify credentials in AWS Console');
            console.log('   3. If using temporary credentials, add AWS_SESSION_TOKEN');
            console.log('   4. Try creating new access keys');
        } else if (error.message.includes('Access Denied')) {
            console.log('\n💡 Permission Issue:');
            console.log('   Your AWS user doesn\'t have DynamoDB permissions.');
            console.log('\n🔧 Solutions:');
            console.log('   1. Go to AWS Console → IAM → Users → Your User');
            console.log('   2. Attach policy: AmazonDynamoDBFullAccess');
            console.log('   3. Or create custom policy with DynamoDB permissions');
        } else if (error.message.includes('InvalidUserID')) {
            console.log('\n💡 Invalid Credentials:');
            console.log('   The AWS Access Key ID is not valid.');
            console.log('\n🔧 Solutions:');
            console.log('   1. Check your .env file for typos');
            console.log('   2. Regenerate access keys in AWS Console');
            console.log('   3. Update your .env file with correct credentials');
        } else if (error.message.includes('Region')) {
            console.log('\n💡 Region Issue:');
            console.log('   Check your AWS_REGION setting.');
            console.log('\n🔧 Solutions:');
            console.log('   1. Set AWS_REGION=us-east-1 in your .env file');
            console.log('   2. Or use the region where your resources exist');
        } else {
            console.log('\n💡 Unknown Error:');
            console.log('   Check your AWS configuration and try again.');
            console.log('\n🔧 Troubleshooting:');
            console.log('   1. Verify AWS credentials in console');
            console.log('   2. Check IAM permissions');
            console.log('   3. Ensure correct AWS region');
            console.log('   4. Try: aws sts get-caller-identity (if AWS CLI installed)');
        }
    }
}

// Run the test
if (require.main === module) {
    simpleDynamoDBTest().catch(console.error);
}

module.exports = simpleDynamoDBTest;
