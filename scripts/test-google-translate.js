#!/usr/bin/env node

/**
 * Simple test for Google Translate API
 */

require('dotenv').config();
const axios = require('axios');

async function testGoogleTranslate() {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
        console.log('❌ GOOGLE_TRANSLATE_API_KEY not found in environment variables');
        return;
    }

    console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');

    try {
        console.log('🌐 Testing Google Translate API...');

        const response = await axios.post('https://translation.googleapis.com/language/translate/v2', {
            q: 'Hello world',
            source: 'en',
            target: 'ms',
            format: 'text'
        }, {
            params: {
                key: apiKey
            },
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        const translation = response.data.data.translations[0].translatedText;
        console.log('✅ Translation successful!');
        console.log('   English: Hello world');
        console.log('   Malay:', translation);

    } catch (error) {
        console.log('❌ Translation failed:');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data?.error?.message || error.message);

        if (error.response?.status === 403) {
            console.log('\n🔧 403 Forbidden - Possible fixes:');
            console.log('   1. Check API key restrictions in Google Cloud Console');
            console.log('   2. Make sure Cloud Translation API is enabled');
            console.log('   3. Verify billing is enabled');
            console.log('   4. Check if API key has proper permissions');
        }
    }
}

testGoogleTranslate().catch(console.error);
