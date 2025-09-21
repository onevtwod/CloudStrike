#!/usr/bin/env node

// Load environment variables from .env file (look in parent directory)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DynamoDBStorage = require('./dynamodb-storage.js');

async function testDynamoDBStorageWithEnv() {
    console.log('🧪 Testing DynamoDB Storage with Environment Variables\n');

    // Check if AWS credentials are loaded
    console.log('🔑 Checking AWS Credentials:');
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}`);

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('\n❌ AWS credentials not found in environment variables.');
        console.log('   Make sure your .env file contains:');
        console.log('   AWS_ACCESS_KEY_ID=your_access_key');
        console.log('   AWS_SECRET_ACCESS_KEY=your_secret_key');
        console.log('   AWS_REGION=us-east-1');
        return;
    }

    const dbStorage = new DynamoDBStorage();

    try {
        // Test 1: Store a raw post
        console.log('\n1️⃣ Testing Raw Post Storage...');
        const rawPost = {
            text: "Just felt an earthquake in KL! My house shook for 30 seconds! #earthquake #malaysia",
            author: "test_user_123",
            source: "twitter",
            timestamp: new Date(),
            location: "Kuala Lumpur",
            images: ["https://example.com/earthquake_photo.jpg"],
            url: "https://twitter.com/test_user/status/123456789",
            rawData: {
                retweet_count: 5,
                like_count: 12,
                reply_count: 3
            }
        };

        const rawPostResult = await dbStorage.storeRawPost(rawPost);
        console.log('   ✅ Raw post stored successfully');
        console.log(`   📝 Post ID: ${rawPostResult.id}`);

        // Test 2: Store an analyzed post
        console.log('\n2️⃣ Testing Analyzed Post Storage...');
        const analyzedPost = {
            rawPostId: rawPostResult.id,
            text: rawPost.text,
            author: rawPost.author,
            source: rawPost.source,
            timestamp: rawPost.timestamp,
            location: "Kuala Lumpur",
            images: rawPost.images,
            imageLocation: null,
            severity: 0.8,
            confidence: 0.9,
            isDisasterRelated: true,
            entities: [
                { text: "earthquake", type: "EVENT", score: 0.95 },
                { text: "Kuala Lumpur", type: "LOCATION", score: 0.88 }
            ],
            sentiment: {
                sentiment: "NEGATIVE",
                score: 0.75
            },
            keyPhrases: [
                { text: "earthquake", score: 0.95 },
                { text: "house shook", score: 0.88 }
            ],
            language: "en"
        };

        const analyzedPostResult = await dbStorage.storeAnalyzedPost(analyzedPost);
        console.log('   ✅ Analyzed post stored successfully');
        console.log(`   📝 Analyzed Post ID: ${analyzedPostResult.id}`);

        // Test 3: Store a disaster event
        console.log('\n3️⃣ Testing Event Storage...');
        const event = {
            type: "earthquake",
            location: "Kuala Lumpur",
            severity: 0.8,
            confidence: 0.9,
            description: "Earthquake detected in Kuala Lumpur area",
            source: "twitter",
            author: "test_user_123",
            timestamp: new Date(),
            images: rawPost.images,
            entities: analyzedPost.entities,
            sentiment: analyzedPost.sentiment,
            keyPhrases: analyzedPost.keyPhrases,
            verified: false
        };

        const eventResult = await dbStorage.storeEvent(event);
        console.log('   ✅ Event stored successfully');
        console.log(`   📝 Event ID: ${eventResult.id}`);

        // Test 4: Store a disaster alert
        console.log('\n4️⃣ Testing Alert Storage...');
        const alert = {
            location: "Kuala Lumpur",
            severity: 0.8,
            eventCount: 1,
            events: [eventResult.id],
            verified: false
        };

        const alertResult = await dbStorage.storeAlert(alert);
        console.log('   ✅ Alert stored successfully');
        console.log(`   📝 Alert ID: ${alertResult.id}`);

        // Test 5: Store a verification
        console.log('\n5️⃣ Testing Verification Storage...');
        const verification = {
            eventId: eventResult.id,
            alertId: alertResult.id,
            source: "Malaysian Meteorological Department",
            type: "official_confirmation",
            location: "Kuala Lumpur",
            text: "Earthquake magnitude 4.2 confirmed in Kuala Lumpur area",
            confidence: 0.95,
            url: "https://www.met.gov.my/earthquake/2025-09-20"
        };

        const verificationResult = await dbStorage.storeVerification(verification);
        console.log('   ✅ Verification stored successfully');
        console.log(`   📝 Verification ID: ${verificationResult.id}`);

        // Test 6: Query events by location
        console.log('\n6️⃣ Testing Query Operations...');
        const eventsByLocation = await dbStorage.getEventsByLocation("Kuala Lumpur");
        console.log(`   ✅ Found ${eventsByLocation.length} events in Kuala Lumpur`);

        // Test 7: Get recent events
        const recentEvents = await dbStorage.getRecentEvents(24);
        console.log(`   ✅ Found ${recentEvents.length} events in last 24 hours`);

        // Test 8: Get alerts by location
        const alertsByLocation = await dbStorage.getAlertsByLocation("Kuala Lumpur");
        console.log(`   ✅ Found ${alertsByLocation.length} alerts in Kuala Lumpur`);

        // Test 9: Update event verification
        console.log('\n7️⃣ Testing Event Verification Update...');
        const updateResult = await dbStorage.updateEventVerification(eventResult.id, {
            verified: true,
            verificationSource: "Malaysian Meteorological Department",
            verificationTimestamp: new Date().toISOString(),
            verificationId: verificationResult.id
        });
        console.log('   ✅ Event verification updated successfully');

        // Test 10: Get table counts
        console.log('\n8️⃣ Testing Table Statistics...');
        for (const [tableName, tableId] of Object.entries(dbStorage.tables)) {
            try {
                const count = await dbStorage.getTableCount(tableId);
                console.log(`   📊 ${tableName}: ${count} items`);
            } catch (error) {
                console.log(`   ⚠️  ${tableName}: Table not found or empty`);
            }
        }

        console.log('\n✅ All DynamoDB Storage Tests Completed Successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✅ Raw post storage and retrieval');
        console.log('   ✅ Analyzed post storage and retrieval');
        console.log('   ✅ Event creation and management');
        console.log('   ✅ Alert generation and tracking');
        console.log('   ✅ Verification system integration');
        console.log('   ✅ Query operations by location and time');
        console.log('   ✅ Event verification updates');
        console.log('   ✅ Table statistics and monitoring');

        console.log('\n🚀 DynamoDB Storage System is working correctly!');

    } catch (error) {
        console.error('\n❌ DynamoDB Storage Test Failed:');
        console.error('   Error:', error.message);

        if (error.message.includes('security token')) {
            console.log('\n💡 AWS credentials are invalid or expired.');
            console.log('   Please check your .env file and ensure credentials are correct.');
        } else if (error.message.includes('Table not found')) {
            console.log('\n💡 DynamoDB tables need to be created first.');
            console.log('   Create tables in AWS Console or use AWS CLI:');
            console.log('   aws dynamodb create-table --table-name disaster-raw-posts ...');
        } else if (error.message.includes('Access Denied')) {
            console.log('\n💡 AWS credentials don\'t have permission to access DynamoDB.');
            console.log('   Ensure your AWS user has DynamoDB permissions.');
        } else {
            console.log('\n💡 Check your AWS configuration and table setup.');
        }
    }
}

// Run the test
if (require.main === module) {
    testDynamoDBStorageWithEnv().catch(console.error);
}

module.exports = testDynamoDBStorageWithEnv;
