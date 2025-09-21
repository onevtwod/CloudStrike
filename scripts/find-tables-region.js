#!/usr/bin/env node

// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function findTablesInRegion(region) {
    try {
        const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };

        if (process.env.AWS_SESSION_TOKEN) {
            credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }

        const client = new DynamoDBClient({
            region: region,
            credentials: credentials
        });

        const command = new ListTablesCommand({});
        const response = await client.send(command);

        return {
            region: region,
            tableCount: response.TableNames.length,
            tables: response.TableNames
        };
    } catch (error) {
        return {
            region: region,
            tableCount: 0,
            tables: [],
            error: error.message
        };
    }
}

async function findTablesInAllRegions() {
    console.log('🔍 Searching for DynamoDB Tables in All Regions\n');

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('❌ AWS credentials not found. Please set up your .env file first.');
        return;
    }

    // Common AWS regions
    const regions = [
        'us-east-1',      // N. Virginia
        'us-east-2',      // Ohio
        'us-west-1',      // N. California
        'us-west-2',      // Oregon
        'eu-west-1',      // Ireland
        'eu-west-2',      // London
        'eu-central-1',   // Frankfurt
        'ap-southeast-1', // Singapore
        'ap-southeast-2', // Sydney
        'ap-northeast-1', // Tokyo
        'ca-central-1',   // Canada
        'sa-east-1'       // São Paulo
    ];

    console.log('Checking regions...\n');

    const results = [];
    for (const region of regions) {
        process.stdout.write(`   Checking ${region}... `);
        const result = await findTablesInRegion(region);
        results.push(result);

        if (result.error) {
            console.log(`❌ Error: ${result.error}`);
        } else {
            console.log(`✅ ${result.tableCount} tables`);
        }
    }

    console.log('\n📊 Results Summary:\n');

    const regionsWithTables = results.filter(r => r.tableCount > 0 && !r.error);

    if (regionsWithTables.length === 0) {
        console.log('❌ No tables found in any region.');
        console.log('\n💡 Possible reasons:');
        console.log('   1. Your AWS credentials don\'t have DynamoDB permissions');
        console.log('   2. Tables exist but in a different account');
        console.log('   3. Tables exist but with different names');
    } else {
        regionsWithTables.forEach(result => {
            console.log(`🎯 ${result.region}: ${result.tableCount} tables`);
            result.tables.forEach(tableName => {
                console.log(`   📋 ${tableName}`);
            });
            console.log('');
        });

        if (regionsWithTables.length === 1) {
            const region = regionsWithTables[0].region;
            console.log(`✅ Your tables are in region: ${region}`);
            console.log(`\n🔧 To fix, update your .env file:`);
            console.log(`   AWS_REGION=${region}`);
        } else {
            console.log('⚠️  Tables found in multiple regions.');
            console.log('   Update your .env file with the region you want to use.');
        }
    }
}

// Run the search
if (require.main === module) {
    findTablesInAllRegions().catch(console.error);
}

module.exports = findTablesInAllRegions;
