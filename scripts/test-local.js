#!/usr/bin/env node

/**
 * Local Test Script for Social Media Ingestion
 * 
 * This script tests the disaster alert system using the local development server
 * without requiring AWS deployment.
 * 
 * Usage:
 *   node scripts/test-local.js
 */

const axios = require('axios');

const LOCAL_API_URL = 'http://localhost:3001';

// Test cases optimized for local testing
const localTestCases = [
  {
    name: 'Flood in Kuala Lumpur (Should be verified)',
    data: {
      text: 'Heavy flooding in downtown Kuala Lumpur near KLCC, roads blocked and people trapped in buildings',
      source: 'twitter',
      author: '@kl_emergency',
      location: { lat: 3.1579, lng: 101.7116 },
      timestamp: new Date().toISOString()
    },
    expectedVerified: true
  },
  {
    name: 'Storm in Petaling Jaya (Should be verified)',
    data: {
      text: 'Severe thunderstorm with heavy rain in Petaling Jaya, avoid Jalan Utara area',
      source: 'twitter',
      author: '@pj_weather',
      location: { lat: 3.1073, lng: 101.6136 },
      timestamp: new Date().toISOString()
    },
    expectedVerified: true
  },
  {
    name: 'Malay Language Flood Warning (Should be verified)',
    data: {
      text: 'Amaran banjir di Shah Alam. Elakkan kawasan Persiaran Klang. Jalan ditutup untuk keselamatan.',
      source: 'twitter',
      author: '@shahalam_banjir',
      location: { lat: 3.0733, lng: 101.5185 },
      timestamp: new Date().toISOString()
    },
    expectedVerified: true
  },
  {
    name: 'Fire Emergency (Should be verified)',
    data: {
      text: 'Large fire reported in Georgetown, Penang. Fire department responding. Avoid Jalan Penang area',
      source: 'instagram',
      author: '@penang_fire_dept',
      location: { lat: 5.4164, lng: 100.3327 },
      timestamp: new Date().toISOString()
    },
    expectedVerified: true
  },
  {
    name: 'Non-disaster Post (Should NOT be verified)',
    data: {
      text: 'Beautiful sunset today in Langkawi. Perfect weather for vacation!',
      source: 'twitter',
      author: '@travel_langkawi',
      location: { lat: 6.3500, lng: 99.8000 },
      timestamp: new Date().toISOString()
    },
    expectedVerified: false
  },
  {
    name: 'Invalid Input Test',
    data: {
      text: '', // Empty text should fail validation
      source: 'twitter'
    },
    expectedVerified: false,
    shouldFail: true
  }
];

async function checkServerHealth() {
  try {
    const response = await axios.get(`${LOCAL_API_URL}/health`, { timeout: 5000 });
    console.log('✅ Local server is running');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Mode: ${response.data.mode}`);
    console.log(`   Events: ${response.data.eventsCount}`);
    return true;
  } catch (error) {
    console.log('❌ Local server is not running');
    console.log('   Please start the local development server first:');
    console.log('   node scripts/local-dev-server.js');
    return false;
  }
}

async function testLocalIngestion() {
  console.log('🧪 Testing Local Social Media Ingestion System');
  console.log('=' .repeat(60));
  console.log(`📡 Local API URL: ${LOCAL_API_URL}`);
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  console.log('');

  // Check if server is running
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    return;
  }

  console.log('');

  const results = [];
  let verifiedCount = 0;
  let totalResponseTime = 0;

  for (let i = 0; i < localTestCases.length; i++) {
    const testCase = localTestCases[i];
    console.log(`\n🧪 Test ${i + 1}/${localTestCases.length}: ${testCase.name}`);
    console.log(`📝 Text: "${testCase.data.text}"`);
    console.log(`📍 Location: ${testCase.data.location ? `${testCase.data.location.lat}, ${testCase.data.location.lng}` : 'Not specified'}`);
    console.log(`👤 Author: ${testCase.data.author}`);
    console.log(`📱 Source: ${testCase.data.source}`);

    try {
      const startTime = Date.now();
      
      const response = await axios.post(
        `${LOCAL_API_URL}/ingest/twitter`,
        testCase.data,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      totalResponseTime += responseTime;

      console.log(`✅ Success! (${responseTime}ms)`);
      console.log(`🆔 Event ID: ${response.data.id}`);
      console.log(`✅ Verified: ${response.data.verified ? 'YES' : 'NO'}`);
      console.log(`📊 Severity: ${response.data.severity}`);
      console.log(`🔍 Source: ${response.data.source}`);
      console.log(`📍 Detected Location: ${response.data.location || 'Not detected'}`);
      console.log(`🏷️  Event Type: ${response.data.eventType}`);
      console.log(`💬 Message: ${response.data.message}`);

      // Check if verification matches expectation
      const verificationCorrect = response.data.verified === (testCase.expectedVerified ? 1 : 0);
      if (verificationCorrect) {
        console.log(`✅ Verification expectation: CORRECT`);
      } else {
        console.log(`⚠️  Verification expectation: INCORRECT (expected ${testCase.expectedVerified ? 'verified' : 'not verified'})`);
      }

      if (response.data.verified) {
        verifiedCount++;
      }

      results.push({
        test: testCase.name,
        success: true,
        verified: response.data.verified,
        severity: response.data.severity,
        responseTime,
        verificationCorrect
      });

    } catch (error) {
      const expectedFailure = testCase.shouldFail;
      
      if (expectedFailure) {
        console.log(`✅ Expected failure occurred!`);
        console.log(`🔴 Error: ${error.response?.data?.message || error.message}`);
        results.push({
          test: testCase.name,
          success: true, // This is actually a success since we expected it to fail
          expectedFailure: true,
          error: error.response?.data?.message || error.message
        });
      } else {
        console.log(`❌ Unexpected failure!`);
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
    }

    // Wait between requests
    if (i < localTestCases.length - 1) {
      console.log('⏳ Waiting 1 second before next test...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Test events endpoint
  console.log('\n' + '='.repeat(60));
  console.log('📋 Testing Events Endpoint');
  console.log('='.repeat(60));

  try {
    const eventsResponse = await axios.get(`${LOCAL_API_URL}/events`);
    const events = eventsResponse.data;
    
    console.log(`✅ Retrieved ${events.length} verified events`);
    
    if (events.length > 0) {
      console.log('\n📋 Verified Events:');
      events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.eventType.toUpperCase()} - ${event.location || 'Unknown location'}`);
        console.log(`      Severity: ${event.severity}, Author: ${event.author}`);
      });
    }
  } catch (error) {
    console.log(`❌ Failed to retrieve events: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOCAL TEST SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const correctVerifications = results.filter(r => r.verificationCorrect).length;
  const avgResponseTime = totalResponseTime / results.filter(r => r.success).length;

  console.log(`✅ Successful tests: ${successful}/${results.length}`);
  console.log(`🔍 Correct verifications: ${correctVerifications}/${results.length - (results.filter(r => r.expectedFailure).length)}`);
  console.log(`🚨 Verified events: ${verifiedCount}`);
  console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(0)}ms`);

  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const verified = result.verified ? '🔍' : '⏸️';
    const correct = result.verificationCorrect ? '✓' : '✗';
    const expectedFail = result.expectedFailure ? ' (expected failure)' : '';
    console.log(`${status} ${index + 1}. ${result.test} ${result.success ? verified : ''} ${result.verificationCorrect !== undefined ? correct : ''}${expectedFail}`);
  });

  console.log('\n🎯 Next Steps:');
  console.log('1. Open the dashboard: http://localhost:3001/dashboard');
  console.log('2. Try manual testing with the web interface');
  console.log('3. Check the console output for detailed processing logs');
  console.log('4. When ready, deploy to AWS using: npm run deploy');

  console.log('\n💡 Local Development Benefits:');
  console.log('- No AWS costs for testing');
  console.log('- Instant feedback and debugging');
  console.log('- Full control over mock data');
  console.log('- Easy to modify and experiment');

  return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
  testLocalIngestion()
    .then(() => {
      console.log('\n✨ Local testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Local test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testLocalIngestion, localTestCases };

