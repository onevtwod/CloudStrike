#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 AWS Credentials Fix Helper\n');

// Read current .env file
const envPath = path.join(__dirname, '..', '.env');
let envContent = '';

try {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Found .env file');
} catch (error) {
    console.log('❌ .env file not found');
    process.exit(1);
}

console.log('\n📋 Current .env content:');
console.log(envContent);

console.log('\n🔍 Analysis:');
if (envContent.includes('ASIA')) {
    console.log('   ⚠️  You are using temporary AWS credentials (ASIA...)');
    console.log('   ⚠️  These require AWS_SESSION_TOKEN to work');

    if (!envContent.includes('AWS_SESSION_TOKEN')) {
        console.log('   ❌ AWS_SESSION_TOKEN is missing!');
        console.log('\n💡 Solutions:');
        console.log('   1. Add AWS_SESSION_TOKEN to your .env file');
        console.log('   2. Or switch to permanent credentials');
    } else {
        console.log('   ✅ AWS_SESSION_TOKEN is present');
    }
} else if (envContent.includes('AKIA')) {
    console.log('   ✅ You are using permanent AWS credentials (AKIA...)');
    console.log('   ✅ These should work without session token');
} else {
    console.log('   ❓ Unknown credential format');
}

console.log('\n🛠️  How to Fix:');
console.log('\nOption 1: Add Session Token (for temporary credentials)');
console.log('   1. Go to AWS Console → Command line or programmatic access');
console.log('   2. Copy the AWS_SESSION_TOKEN value');
console.log('   3. Add this line to your .env file:');
console.log('      AWS_SESSION_TOKEN=your_session_token_here');

console.log('\nOption 2: Use Permanent Credentials (recommended)');
console.log('   1. Go to AWS Console → IAM → Users → Your User');
console.log('   2. Security credentials → Create access key');
console.log('   3. Choose "Application running outside AWS"');
console.log('   4. Replace your .env file with:');
console.log('      AWS_ACCESS_KEY_ID=AKIA...');
console.log('      AWS_SECRET_ACCESS_KEY=...');
console.log('      AWS_REGION=us-east-1');

console.log('\nOption 3: Test with AWS CLI');
console.log('   aws sts get-caller-identity');
console.log('   (This will tell you if your credentials work)');

console.log('\n📝 Updated .env file should look like:');
console.log('   # For temporary credentials:');
console.log('   AWS_ACCESS_KEY_ID=ASIA4JAHHIC7U45LHWXK');
console.log('   AWS_SECRET_ACCESS_KEY=1RW3Y0KT1jnMScYv4eMKH6HNiQGC14lEwEKkEWBc');
console.log('   AWS_SESSION_TOKEN=your_session_token_here');
console.log('   AWS_REGION=us-east-1');
console.log('');
console.log('   # OR for permanent credentials:');
console.log('   AWS_ACCESS_KEY_ID=AKIA...');
console.log('   AWS_SECRET_ACCESS_KEY=...');
console.log('   AWS_REGION=us-east-1');

console.log('\n🧪 After updating, test with:');
console.log('   cd scripts && node test-aws-credentials.js');
