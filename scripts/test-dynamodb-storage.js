#!/usr/bin/env node

const DynamoDBStorage = require('./dynamodb-storage');

async function testDynamoDBStorage() {
    try {
        console.log('🧪 Testing DynamoDB Storage...');

        const storage = new DynamoDBStorage();

        // Test storing a simple event
        const testEvent = {
            id: `test_event_${Date.now()}`,
            text: 'Test disaster event',
            author: 'test_user',
            source: 'test',
            location: 'Test Location',
            severity: 0.5,
            confidence: 0.8,
            timestamp: new Date(),
            images: [],
            entities: [],
            sentiment: { sentiment: 'NEUTRAL' },
            keyPhrases: [],
            verified: false
        };

        console.log('📝 Storing test event...');
        await storage.storeEvent(testEvent);
        console.log('✅ Test event stored successfully!');

        // Test storing a raw post
        const testPost = {
            id: `test_post_${Date.now()}`,
            text: 'Test post content',
            author: 'test_author',
            source: 'reddit',
            timestamp: new Date(),
            images: [],
            location: 'Test Location'  // Fixed: Cannot be null for location-timestamp-index
        };

        console.log('📝 Storing test raw post...');
        await storage.storeRawPost(testPost);
        console.log('✅ Test raw post stored successfully!');

        console.log('🎉 All DynamoDB storage tests passed!');

    } catch (error) {
        console.error('❌ DynamoDB storage test failed:', error.message);
        console.error('Error details:', error);

        if (error.name === 'ResourceNotFoundException') {
            console.log('\n💡 The DynamoDB tables don\'t exist yet.');
            console.log('Run: node scripts/create-dynamodb-tables.js');
        }
    }
}

if (require.main === module) {
    testDynamoDBStorage().catch(console.error);
}

module.exports = testDynamoDBStorage;