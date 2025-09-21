#!/usr/bin/env node

/**
 * Test AWS Secrets Manager
 * This script tests secret creation, retrieval, and management for API credentials
 */

const { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, UpdateSecretCommand, ListSecretsCommand, DeleteSecretCommand } = require('@aws-sdk/client-secrets-manager');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class SecretsManagerTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.secretsManager = new SecretsManagerClient({ region: this.region });
        this.results = [];
        this.testSecretName = `disaster-alert-test-secret-${Date.now()}`;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
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

    async testListSecrets() {
        this.log('📋 Testing List Secrets', 'bold');

        const result = await this.testOperation(
            'List Secrets',
            () => this.secretsManager.send(new ListSecretsCommand({})),
            'List all secrets in Secrets Manager'
        );

        if (result && result.SecretList) {
            this.log(`   Found ${result.SecretList.length} secrets:`, 'info');
            result.SecretList.forEach(secret => {
                this.log(`     - ${secret.Name} (${secret.Description || 'No description'})`, 'info');
            });
        }

        return result;
    }

    async testCreateSecret() {
        this.log('🔐 Testing Secret Creation', 'bold');

        const secretValue = JSON.stringify({
            twitterBearerToken: 'test-twitter-token-12345',
            redditClientId: 'test-reddit-client-id',
            redditClientSecret: 'test-reddit-client-secret',
            newsApiKey: 'test-news-api-key-67890',
            mapsApiKey: 'test-maps-api-key-abcdef',
            meteoApiKey: 'test-meteo-api-key-ghijkl'
        });

        const result = await this.testOperation(
            'Create Secret',
            () => this.secretsManager.send(new CreateSecretCommand({
                Name: this.testSecretName,
                Description: 'Test secret for disaster alert system API credentials',
                SecretString: secretValue,
                Tags: [
                    {
                        Key: 'Environment',
                        Value: 'Test'
                    },
                    {
                        Key: 'Service',
                        Value: 'DisasterAlert'
                    },
                    {
                        Key: 'Type',
                        Value: 'API Credentials'
                    }
                ]
            })),
            `Create test secret: ${this.testSecretName}`
        );

        if (result && result.ARN) {
            this.log(`   Secret ARN: ${result.ARN}`, 'info');
        }

        return result;
    }

    async testGetSecretValue() {
        this.log('🔍 Testing Secret Retrieval', 'bold');

        const result = await this.testOperation(
            'Get Secret Value',
            () => this.secretsManager.send(new GetSecretValueCommand({
                SecretId: this.testSecretName
            })),
            `Retrieve secret value for ${this.testSecretName}`
        );

        if (result && result.SecretString) {
            const secretData = JSON.parse(result.SecretString);
            this.log(`   Retrieved secret with ${Object.keys(secretData).length} keys:`, 'info');
            Object.keys(secretData).forEach(key => {
                const value = secretData[key];
                const maskedValue = value.length > 8 ?
                    value.substring(0, 4) + '...' + value.substring(value.length - 4) :
                    '***';
                this.log(`     ${key}: ${maskedValue}`, 'info');
            });
        }

        return result;
    }

    async testUpdateSecret() {
        this.log('🔄 Testing Secret Update', 'bold');

        const updatedSecretValue = JSON.stringify({
            twitterBearerToken: 'updated-twitter-token-54321',
            redditClientId: 'updated-reddit-client-id',
            redditClientSecret: 'updated-reddit-client-secret',
            newsApiKey: 'updated-news-api-key-09876',
            mapsApiKey: 'updated-maps-api-key-fedcba',
            meteoApiKey: 'updated-meteo-api-key-lkjihg',
            newApiKey: 'new-additional-api-key'
        });

        const result = await this.testOperation(
            'Update Secret',
            () => this.secretsManager.send(new UpdateSecretCommand({
                SecretId: this.testSecretName,
                SecretString: updatedSecretValue,
                Description: 'Updated test secret for disaster alert system API credentials'
            })),
            `Update secret value for ${this.testSecretName}`
        );

        if (result && result.ARN) {
            this.log(`   Updated Secret ARN: ${result.ARN}`, 'info');
        }

        return result;
    }

    async testSecretValidation() {
        this.log('✅ Testing Secret Validation', 'bold');

        const result = await this.testOperation(
            'Validate Secret',
            async () => {
                const secretResponse = await this.secretsManager.send(new GetSecretValueCommand({
                    SecretId: this.testSecretName
                }));

                if (!secretResponse.SecretString) {
                    throw new Error('No secret string found');
                }

                const secretData = JSON.parse(secretResponse.SecretString);
                const requiredKeys = [
                    'twitterBearerToken',
                    'redditClientId',
                    'redditClientSecret',
                    'newsApiKey',
                    'mapsApiKey',
                    'meteoApiKey'
                ];

                const missingKeys = requiredKeys.filter(key => !secretData[key]);
                if (missingKeys.length > 0) {
                    throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
                }

                const validationResults = {};
                requiredKeys.forEach(key => {
                    const value = secretData[key];
                    validationResults[key] = {
                        present: !!value,
                        length: value ? value.length : 0,
                        valid: value && value.length > 5
                    };
                });

                return validationResults;
            },
            `Validate secret structure and content for ${this.testSecretName}`
        );

        if (result) {
            this.log(`   Secret Validation Results:`, 'info');
            Object.entries(result).forEach(([key, validation]) => {
                const status = validation.valid ? '✓' : '✗';
                this.log(`     ${status} ${key}: ${validation.present ? 'Present' : 'Missing'} (Length: ${validation.length})`, 'info');
            });
        }

        return result;
    }

    async testDisasterAlertSecrets() {
        this.log('🚨 Testing Disaster Alert Specific Secrets', 'bold');

        const disasterAlertSecrets = {
            socialMediaCredentials: {
                twitterBearerToken: 'disaster-twitter-token-12345',
                redditClientId: 'disaster-reddit-client-id',
                redditClientSecret: 'disaster-reddit-client-secret',
                facebookAccessToken: 'disaster-facebook-token-67890'
            },
            externalApiKeys: {
                newsApiKey: 'disaster-news-api-key-abcdef',
                mapsApiKey: 'disaster-maps-api-key-ghijkl',
                meteoApiKey: 'disaster-meteo-api-key-mnopqr'
            },
            awsCredentials: {
                accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                region: 'us-east-1'
            }
        };

        const secretName = `disaster-alert-credentials-${Date.now()}`;

        const result = await this.testOperation(
            'Create Disaster Alert Secrets',
            () => this.secretsManager.send(new CreateSecretCommand({
                Name: secretName,
                Description: 'Disaster alert system credentials and API keys',
                SecretString: JSON.stringify(disasterAlertSecrets),
                Tags: [
                    {
                        Key: 'Environment',
                        Value: 'Production'
                    },
                    {
                        Key: 'Service',
                        Value: 'DisasterAlert'
                    },
                    {
                        Key: 'Type',
                        Value: 'Multi-Service Credentials'
                    }
                ]
            })),
            `Create disaster alert specific secrets: ${secretName}`
        );

        if (result && result.ARN) {
            this.log(`   Disaster Alert Secret ARN: ${result.ARN}`, 'info');
        }

        // Clean up the disaster alert secret
        try {
            await this.secretsManager.send(new DeleteSecretCommand({
                SecretId: secretName,
                ForceDeleteWithoutRecovery: true
            }));
            this.log(`   Cleaned up disaster alert secret: ${secretName}`, 'info');
        } catch (error) {
            this.log(`   Failed to cleanup disaster alert secret: ${error.message}`, 'warning');
        }

        return result;
    }

    async testSecretRotation() {
        this.log('🔄 Testing Secret Rotation Simulation', 'bold');

        const result = await this.testOperation(
            'Simulate Secret Rotation',
            async () => {
                // Get current secret
                const currentSecret = await this.secretsManager.send(new GetSecretValueCommand({
                    SecretId: this.testSecretName
                }));

                if (!currentSecret.SecretString) {
                    throw new Error('No current secret found');
                }

                const currentData = JSON.parse(currentSecret.SecretString);

                // Simulate rotation by updating with new values
                const rotatedData = {
                    ...currentData,
                    twitterBearerToken: `rotated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    redditClientSecret: `rotated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    newsApiKey: `rotated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    rotationTimestamp: new Date().toISOString()
                };

                const updateResult = await this.secretsManager.send(new UpdateSecretCommand({
                    SecretId: this.testSecretName,
                    SecretString: JSON.stringify(rotatedData),
                    Description: `Rotated secret - ${new Date().toISOString()}`
                }));

                return {
                    originalKeys: Object.keys(currentData),
                    rotatedKeys: Object.keys(rotatedData),
                    rotationTimestamp: rotatedData.rotationTimestamp
                };
            },
            `Simulate secret rotation for ${this.testSecretName}`
        );

        if (result) {
            this.log(`   Rotation completed at: ${result.rotationTimestamp}`, 'info');
            this.log(`   Original keys: ${result.originalKeys.length}`, 'info');
            this.log(`   Rotated keys: ${result.rotatedKeys.length}`, 'info');
        }

        return result;
    }

    async testSecretsManager() {
        this.log('🔐 Testing AWS Secrets Manager', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Test Secret: ${this.testSecretName}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testListSecrets();
        await this.testCreateSecret();
        await this.testGetSecretValue();
        await this.testUpdateSecret();
        await this.testSecretValidation();
        await this.testDisasterAlertSecrets();
        await this.testSecretRotation();

        // Cleanup
        await this.cleanup();

        this.printSummary();
    }

    async cleanup() {
        this.log('🧹 Cleaning up test resources...', 'info');

        try {
            await this.secretsManager.send(new DeleteSecretCommand({
                SecretId: this.testSecretName,
                ForceDeleteWithoutRecovery: true
            }));
            this.log('   Test secret deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to delete test secret: ${error.message}`, 'warning');
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 SECRETS MANAGER TEST SUMMARY', 'bold');
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
            this.log('\n🎉 All Secrets Manager operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check Secrets Manager service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new SecretsManagerTester();
    await tester.testSecretsManager();

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

module.exports = SecretsManagerTester;
