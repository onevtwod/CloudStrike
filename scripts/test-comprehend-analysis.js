#!/usr/bin/env node

/**
 * Test Amazon Comprehend Analysis
 * This script tests text analysis, entity detection, and sentiment analysis using Amazon Comprehend
 */

const { ComprehendClient, DetectEntitiesCommand, DetectSentimentCommand, DetectDominantLanguageCommand } = require('@aws-sdk/client-comprehend');
const axios = require('axios');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class ComprehendTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        // Clear environment variables to avoid conflicts
        delete process.env.AWS_PROFILE;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        this.comprehend = new ComprehendClient({ region: this.region });

        // Debug: Check environment variables
        this.log(`Environment check:`, 'info');
        this.log(`  GOOGLE_TRANSLATE_API_KEY: ${process.env.GOOGLE_TRANSLATE_API_KEY ? 'Set' : 'Not set'}`, 'info');
        this.log(`  GOOGLE_CLOUD_PROJECT_ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID || 'Not set'}`, 'info');

        // Initialize Google Translate API key
        this.googleTranslateApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

        if (this.googleTranslateApiKey) {
            this.log('Google Translate configured with API key', 'success');
        } else {
            this.log('Google Translate not configured. Set GOOGLE_TRANSLATE_API_KEY in your .env file', 'warning');
        }

        this.results = [];

        // Test texts in different languages and disaster scenarios
        this.testTexts = [
            {
                text: "Heavy flooding reported in Kuala Lumpur city center. Water level rising rapidly. Please avoid the area.",
                language: "en",
                expectedEntities: ["LOCATION", "EVENT"],
                description: "English flood report"
            },
            {
                text: "Banjir teruk di pusat bandar Kuala Lumpur. Paras air naik dengan pantas. Sila elakkan kawasan ini.",
                language: "ms",
                expectedEntities: ["LOCATION", "EVENT"],
                description: "Malay flood report"
            },
            {
                text: "Massive earthquake hits Sabah with magnitude 6.5. Buildings damaged. Emergency services responding.",
                language: "en",
                expectedEntities: ["LOCATION", "EVENT", "QUANTITY"],
                description: "English earthquake report"
            },
            {
                text: "Kebakaran besar di Pulau Pinang. Asap tebal mengganggu penglihatan. Penduduk diminta berpindah.",
                language: "ms",
                expectedEntities: ["LOCATION", "EVENT"],
                description: "Malay fire report"
            },
            {
                text: "Tornado warning issued for Selangor. Take immediate shelter. Stay away from windows.",
                language: "en",
                expectedEntities: ["LOCATION", "EVENT"],
                description: "English tornado warning"
            }
        ];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async translateText(text, sourceLanguage = 'ms', targetLanguage = 'en') {
        // Check if Google Translate API key is configured
        if (!this.googleTranslateApiKey) {
            this.log(`Google Translate not configured. Using original text.`, 'warning');
            this.log(`To enable translation, set GOOGLE_TRANSLATE_API_KEY in your .env file`, 'info');
            return text;
        }

        try {
            this.log(`Translating from ${sourceLanguage} to ${targetLanguage} using Google Translate...`, 'info');

            // Use Google Translate REST API as per official documentation
            const response = await axios.post('https://translation.googleapis.com/language/translate/v2', {
                q: text,
                source: sourceLanguage,
                target: targetLanguage,
                format: 'text'
            }, {
                params: {
                    key: this.googleTranslateApiKey
                },
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });

            const translation = response.data.data.translations[0].translatedText;
            this.log(`Translation successful: "${translation}"`, 'success');
            return translation;

        } catch (error) {
            this.log(`Google Translate failed: ${error.message}`, 'warning');
            if (error.response?.data?.error) {
                this.log(`API Error: ${error.response.data.error.message}`, 'warning');
            }
            this.log(`Falling back to original text. Check your Google Cloud API key and billing.`, 'info');
            return text; // Return original text if translation fails
        }
    }

    async testOperation(operationName, testFunction, description) {
        try {
            this.log(`Testing ${operationName}...`, 'info');
            const startTime = Date.now();
            const result = await testFunction();
            const duration = Date.now() - startTime;

            this.results.push({
                operation: operationName,
                status: 'SUCCESS',
                duration: `${duration}ms`,
                description,
                result
            });

            this.log(`✓ ${operationName} - ${description} (${duration}ms)`, 'success');
            return result;
        } catch (error) {
            this.results.push({
                operation: operationName,
                status: 'FAILED',
                error: error.message,
                description
            });

            this.log(`✗ ${operationName} - ${error.message}`, 'error');
            return null;
        }
    }

    async testLanguageDetection() {
        this.log('🌐 Testing Language Detection', 'bold');

        for (const testCase of this.testTexts) {
            await this.testOperation(
                `Language Detection (${testCase.description})`,
                () => this.comprehend.send(new DetectDominantLanguageCommand({
                    Text: testCase.text
                })),
                `Detect language for: ${testCase.text.substring(0, 50)}...`
            );
        }
    }

    async testEntityDetection() {
        this.log('🏷️  Testing Entity Detection', 'bold');

        for (const testCase of this.testTexts) {
            let textToAnalyze = testCase.text;
            let isTranslated = false;

            // If it's Malay text, translate it first using Google Translate
            if (testCase.language === 'ms') {
                this.log(`   Translating Malay text to English...`, 'info');
                textToAnalyze = await this.translateText(testCase.text, 'ms', 'en');
                isTranslated = true;
                this.log(`   Translated: "${textToAnalyze}"`, 'info');
            }

            const result = await this.testOperation(
                `Entity Detection (${testCase.description})`,
                () => this.comprehend.send(new DetectEntitiesCommand({
                    LanguageCode: 'en', // Use English language code as fallback
                    Text: textToAnalyze
                })),
                `Extract entities from: ${testCase.text.substring(0, 50)}...`
            );

            if (result && result.Entities) {
                this.log(`   Found ${result.Entities.length} entities:`, 'info');
                result.Entities.forEach(entity => {
                    this.log(`     - ${entity.Type}: "${entity.Text}" (Confidence: ${(entity.Score * 100).toFixed(1)}%)`, 'info');
                });
                if (isTranslated) {
                    this.log(`   Note: Entities extracted from translated text`, 'info');
                }
            }
        }
    }

    async testSentimentAnalysis() {
        this.log('😊 Testing Sentiment Analysis', 'bold');

        const sentimentTexts = [
            {
                text: "This is a terrible disaster! People are suffering and need help immediately!",
                language: "en"
            },
            {
                text: "The emergency response team did an excellent job saving lives.",
                language: "en"
            },
            {
                text: "The situation is under control now. Relief efforts are going well.",
                language: "en"
            },
            {
                text: "We are monitoring the situation closely and will provide updates.",
                language: "en"
            },
            {
                text: "Ini adalah bencana yang dahsyat! Rakyat menderita dan memerlukan bantuan segera!",
                language: "ms"
            },
            {
                text: "Pasukan bantuan kecemasan melakukan kerja yang cemerlang menyelamatkan nyawa.",
                language: "ms"
            }
        ];

        for (const testCase of sentimentTexts) {
            let textToAnalyze = testCase.text;
            let isTranslated = false;

            // If it's Malay text, translate it first using Google Translate
            if (testCase.language === 'ms') {
                this.log(`   Translating Malay text to English...`, 'info');
                textToAnalyze = await this.translateText(testCase.text, 'ms', 'en');
                isTranslated = true;
                this.log(`   Translated: "${textToAnalyze}"`, 'info');
            }

            const result = await this.testOperation(
                'Sentiment Analysis',
                () => this.comprehend.send(new DetectSentimentCommand({
                    LanguageCode: 'en', // Always use English for sentiment analysis
                    Text: textToAnalyze
                })),
                `Analyze sentiment: ${testCase.text.substring(0, 50)}...`
            );

            if (result && result.Sentiment) {
                const confidence = result.SentimentScore && result.SentimentScore[result.Sentiment]
                    ? (result.SentimentScore[result.Sentiment] * 100).toFixed(1)
                    : 'N/A';
                this.log(`   Sentiment: ${result.Sentiment} (Confidence: ${confidence}%)`, 'info');
                if (isTranslated) {
                    this.log(`   Note: Sentiment analyzed from translated text`, 'info');
                }
            }
        }
    }

    async testDisasterEntityExtraction() {
        this.log('🚨 Testing Disaster-Specific Entity Extraction', 'bold');

        const disasterTexts = [
            "Flooding in downtown area. Water level 2 meters high. Evacuation ordered.",
            "Earthquake magnitude 5.2 in Sabah. Multiple buildings damaged. Casualties reported.",
            "Forest fire spreading rapidly in Cameron Highlands. Smoke affecting visibility.",
            "Landslide blocks main highway. Traffic diverted. No injuries reported.",
            "Tornado touches down in Selangor. Roofs blown off houses. Emergency declared."
        ];

        for (const text of disasterTexts) {
            const result = await this.testOperation(
                'Disaster Entity Extraction',
                () => this.comprehend.send(new DetectEntitiesCommand({
                    LanguageCode: 'en',
                    Text: text
                })),
                `Extract disaster entities: ${text.substring(0, 50)}...`
            );

            if (result && result.Entities) {
                const disasterEntities = result.Entities.filter(e =>
                    ['LOCATION', 'EVENT', 'QUANTITY', 'ORGANIZATION'].includes(e.Type)
                );

                this.log(`   Disaster-related entities:`, 'info');
                disasterEntities.forEach(entity => {
                    this.log(`     - ${entity.Type}: "${entity.Text}" (${(entity.Score * 100).toFixed(1)}%)`, 'info');
                });
            }
        }
    }

    async testBatchProcessing() {
        this.log('📦 Testing Batch Processing', 'bold');

        // Test with multiple texts in a single request
        const batchTexts = this.testTexts.slice(0, 3).map(t => t.text);

        await this.testOperation(
            'Batch Entity Detection',
            async () => {
                const promises = batchTexts.map(text =>
                    this.comprehend.send(new DetectEntitiesCommand({
                        LanguageCode: 'en',
                        Text: text
                    }))
                );
                return Promise.all(promises);
            },
            `Process ${batchTexts.length} texts in parallel`
        );
    }

    async testComprehendAnalysis() {
        this.log('🧠 Testing Amazon Comprehend Analysis', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testLanguageDetection();
        await this.testEntityDetection();
        await this.testSentimentAnalysis();
        await this.testDisasterEntityExtraction();
        await this.testBatchProcessing();

        this.printSummary();
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 COMPREHEND TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        const successCount = this.results.filter(r => r.status === 'SUCCESS').length;
        const totalCount = this.results.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log(`\nTotal Operations: ${totalCount}`, 'info');
        this.log(`Successful: ${colors.green}${successCount}${colors.reset}`, 'info');
        this.log(`Failed: ${colors.red}${totalCount - successCount}${colors.reset}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach(result => {
            const status = result.status === 'SUCCESS' ?
                `${colors.green}✓${colors.reset}` :
                `${colors.red}✗${colors.reset}`;

            console.log(`${status} ${result.operation}: ${result.description}`);
            if (result.status === 'SUCCESS' && result.duration) {
                console.log(`   Duration: ${result.duration}`);
            }
            if (result.status === 'FAILED' && result.error) {
                console.log(`   Error: ${colors.red}${result.error}${colors.reset}`);
            }
        });

        if (successCount === totalCount) {
            this.log('\n🎉 All Comprehend operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check Comprehend service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new ComprehendTester();
    await tester.testComprehendAnalysis();

    // Exit with non-zero code if any tests failed
    const successCount = tester.results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = tester.results.length;

    if (successCount !== totalCount) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComprehendTester;
