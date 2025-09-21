#!/usr/bin/env node

/**
 * Test Amazon Bedrock Translation Functionality
 * This script tests the Bedrock translation integration
 */

const ComprehensiveDisasterSystem = require('./main');

async function testBedrockTranslation() {
    console.log('🤖 Testing Amazon Bedrock Translation...');
    console.log('='.repeat(50));

    try {
        // Check AWS credentials
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.log('❌ AWS credentials not found. Please set:');
            console.log('   AWS_ACCESS_KEY_ID');
            console.log('   AWS_SECRET_ACCESS_KEY');
            console.log('   AWS_REGION (optional, defaults to us-east-1)');
            return;
        }

        console.log('✅ AWS credentials found');
        console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);

        // Initialize the disaster system
        const system = new ComprehensiveDisasterSystem();

        // Test Malay text samples
        const testTexts = [
            "Banjir berlaku di Kuala Lumpur hari ini. Jalan-jalan ditutup.",
            "Gempa bumi dirasai di Sabah. Tiada kerosakan dilaporkan.",
            "Ribut petir melanda Selangor. Penduduk diminta berhati-hati.",
            "Kebakaran di Pulau Pinang. Bomba sedang mengawal api.",
            "Kecemasan di Johor. Evakuasi sedang dijalankan."
        ];

        console.log('\n📝 Testing Malay to English translation:');
        console.log('-'.repeat(50));

        for (let i = 0; i < testTexts.length; i++) {
            const malayText = testTexts[i];
            console.log(`\n${i + 1}. Malay: "${malayText}"`);

            try {
                const englishText = await system.translateText(malayText, 'ms', 'en');
                console.log(`   English: "${englishText}"`);
                console.log('   ✅ Translation successful');
            } catch (error) {
                console.log(`   ❌ Translation failed: ${error.message}`);

                if (error.name === 'ValidationException') {
                    console.log('   💡 Nova Pro model not available in this region. Try us-east-1 or us-west-2');
                } else if (error.name === 'AccessDeniedException') {
                    console.log('   💡 Access denied. Check Bedrock permissions for Nova Pro model');
                }
            }

            // Add delay between requests
            if (i < testTexts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('\n🎯 Bedrock Translation Test Complete!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Ensure Amazon Nova Pro model access is enabled in AWS Console');
        console.log('   2. Check IAM permissions for Bedrock service');
        console.log('   3. Verify Nova Pro availability in your region');
        console.log('   4. Run: node main.js (to test with real Reddit data)');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testBedrockTranslation().catch(console.error);
}

module.exports = testBedrockTranslation;
