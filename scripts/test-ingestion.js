#!/usr/bin/env node

/**
 * Test Script for Social Media Ingestion
 * 
 * This script demonstrates how to send test posts to the disaster alert system
 * to verify the social media ingestion functionality.
 * 
 * Usage:
 *   node scripts/test-ingestion.js
 * 
 * Environment Variables:
 *   - API_BASE_URL: Your deployed API Gateway URL
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-id.execute-api.us-east-1.amazonaws.com';

// Test cases with various disaster scenarios
const testCases = [
    {
        name: 'Flood in Kuala Lumpur',
        data: {
            text: 'Heavy flooding in downtown Kuala Lumpur near KLCC, roads blocked and people trapped in buildings',
            source: 'twitter',
            author: '@kl_emergency',
            location: { lat: 3.1579, lng: 101.7116 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Storm in Petaling Jaya',
        data: {
            text: 'Severe thunderstorm with heavy rain in Petaling Jaya, avoid Jalan Utara area',
            source: 'twitter',
            author: '@pj_weather',
            location: { lat: 3.1073, lng: 101.6136 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Earthquake near Sabah',
        data: {
            text: 'Earthquake felt in Kota Kinabalu, magnitude 5.2, buildings shaking',
            source: 'facebook',
            author: '@sabah_alert',
            location: { lat: 5.9804, lng: 116.0735 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Fire in Penang',
        data: {
            text: 'Large fire reported in Georgetown, Penang. Fire department responding. Avoid Jalan Penang area',
            source: 'instagram',
            author: '@penang_fire_dept',
            location: { lat: 5.4164, lng: 100.3327 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Malay language flood warning',
        data: {
            text: 'Amaran banjir di Shah Alam. Elakkan kawasan Persiaran Klang. Jalan ditutup untuk keselamatan.',
            source: 'twitter',
            author: '@shahalam_banjir',
            location: { lat: 3.0733, lng: 101.5185 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Landslide warning',
        data: {
            text: 'Landslide warning issued for Cameron Highlands. Avoid Jalan Simpang Pulai due to unstable slopes',
            source: 'mobile_app',
            author: 'Emergency Services',
            location: { lat: 4.4869, lng: 101.3835 },
            timestamp: new Date().toISOString()
        }
    },
    {
        name: 'Non-disaster post (should not be verified)',
        data: {
            text: 'Beautiful sunset today in Langkawi. Perfect weather for vacation!',
            source: 'twitter',
            author: '@travel_langkawi',
            location: { lat: 6.3500, lng: 99.8000 },
            timestamp: new Date().toISOString()
        }
    }
];

async function testIngestion() {
    console.log('🚀 Testing Social Media Ingestion System');
    console.log('='.repeat(50));
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    console.log(`📅 Test Time: ${new Date().toISOString()}`);
    console.log('');

    const results = [];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n🧪 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
        console.log(`📝 Text: "${testCase.data.text}"`);
        console.log(`📍 Location: ${testCase.data.location ? `${testCase.data.location.lat}, ${testCase.data.location.lng}` : 'Not specified'}`);
        console.log(`👤 Author: ${testCase.data.author}`);
        console.log(`📱 Source: ${testCase.data.source}`);

        try {
            const startTime = Date.now();

            const response = await axios.post(
                `${API_BASE_URL}/ingest/twitter`,
                testCase.data,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            console.log(`✅ Success! (${responseTime}ms)`);
            console.log(`🆔 Event ID: ${response.data.id}`);
            console.log(`✅ Verified: ${response.data.verified ? 'YES' : 'NO'}`);
            console.log(`📊 Severity: ${response.data.severity}`);
            console.log(`🔍 Source: ${response.data.source}`);
            console.log(`📍 Detected Location: ${response.data.location || 'Not detected'}`);
            console.log(`🏷️  Event Type: ${response.data.eventType}`);
            console.log(`💬 Message: ${response.data.message}`);

            results.push({
                test: testCase.name,
                success: true,
                verified: response.data.verified,
                severity: response.data.severity,
                responseTime,
                data: response.data
            });

        } catch (error) {
            console.log(`❌ Failed!`);
            console.log(`🔴 Error: ${error.response?.data?.message || error.message}`);
            console.log(`📊 Status: ${error.response?.status || 'Network Error'}`);

            if (error.response?.data?.errors) {
                console.log(`🔍 Validation Errors:`);
                error.response.data.errors.forEach(err => console.log(`   - ${err}`));
            }

            results.push({
                test: testCase.name,
                success: false,
                error: error.response?.data?.message || error.message,
                status: error.response?.status
            });
        }

        // Wait between requests to avoid rate limiting
        if (i < testCases.length - 1) {
            console.log('⏳ Waiting 2 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success).length;
    const verified = results.filter(r => r.success && r.verified).length;
    const avgResponseTime = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / successful;

    console.log(`✅ Successful requests: ${successful}/${results.length}`);
    console.log(`🔍 Verified events: ${verified}/${successful}`);
    console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(0)}ms`);

    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const verified = result.verified ? '🔍' : '⏸️';
        console.log(`${status} ${index + 1}. ${result.test} ${result.success ? verified : ''}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('1. Check the web dashboard at /events to see processed events');
    console.log('2. Verify SNS alerts were sent for verified events');
    console.log('3. Check CloudWatch logs for detailed processing information');
    console.log('4. Test with real social media webhooks');

    return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
    testIngestion()
        .then(() => {
            console.log('\n✨ Testing completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testIngestion, testCases };
