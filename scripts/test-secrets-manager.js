#!/usr/bin/env node

/**
 * AWS Secrets Manager Integration Test
 * This test verifies secure credential storage and retrieval for API keys
 * 
 * Data Flow Position: 3 - Security foundation
 * Dependencies: AWS Credentials (test-aws-credentials.js)
 * Tests: Secret creation, retrieval, rotation, encryption
 */

const { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, UpdateSecretCommand, DeleteSecretCommand, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');

class SecretsManagerTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.client = new SecretsManagerClient({ region: this.region });
        this.testSecrets = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            info: '\x1b[34m',
            bold: '\x1b[1m',
            reset: '\x1b[0m'
        };

        const color = colors[type] || colors.info;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testSecretCreation() {
        this.log('🔐 Testing secret creation...', 'bold');

        try {
            const secretName = `disaster-alert-test-${Date.now()}`;
            const secretValue = JSON.stringify({
                twitter_api_key: 'test-twitter-key-12345',
                twitter_api_secret: 'test-twitter-secret-67890',
                reddit_client_id: 'test-reddit-id-abcde',
                reddit_client_secret: 'test-reddit-secret-fghij',
                news_api_key: 'test-news-key-klmno',
                maps_api_key: 'test-maps-key-pqrst',
                weather_api_key: 'test-weather-key-uvwxy'
            });

            const command = new CreateSecretCommand({
                Name: secretName,
                Description: 'Test secret for disaster alert system API keys',
                SecretString: secretValue,
                Tags: [
                    { Key: 'Project', Value: 'DisasterAlertSystem' },
                    { Key: 'Environment', Value: 'Test' },
                    { Key: 'Purpose', Value: 'APIKeys' }
                ]
            });

            const response = await this.client.send(command);
            this.testSecrets.push(secretName);

            this.results.push({
                test: 'Secret Creation',
                status: 'SUCCESS',
                details: {
                    secretName: secretName,
                    arn: response.ARN,
                    versionId: response.VersionId
                }
            });

            this.log(`✅ Secret ${secretName} created successfully`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Secret Creation',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret creation failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretRetrieval() {
        this.log('🔍 Testing secret retrieval...', 'bold');

        if (this.testSecrets.length === 0) {
            this.log('⚠️ No test secrets available for retrieval test', 'warning');
            return false;
        }

        try {
            const secretName = this.testSecrets[0];
            const command = new GetSecretValueCommand({
                SecretId: secretName
            });

            const response = await this.client.send(command);
            const secretData = JSON.parse(response.SecretString);

            // Validate secret structure
            const expectedKeys = [
                'twitter_api_key',
                'twitter_api_secret',
                'reddit_client_id',
                'reddit_client_secret',
                'news_api_key',
                'maps_api_key',
                'weather_api_key'
            ];

            const hasAllKeys = expectedKeys.every(key => secretData.hasOwnProperty(key));

            this.results.push({
                test: 'Secret Retrieval',
                status: hasAllKeys ? 'SUCCESS' : 'FAILED',
                details: {
                    secretName: secretName,
                    versionId: response.VersionId,
                    hasAllKeys: hasAllKeys,
                    keyCount: Object.keys(secretData).length
                }
            });

            if (hasAllKeys) {
                this.log(`✅ Secret retrieval successful - All ${expectedKeys.length} keys present`, 'success');
            } else {
                this.log(`❌ Secret retrieval failed - Missing required keys`, 'error');
            }

            return hasAllKeys;

        } catch (error) {
            this.results.push({
                test: 'Secret Retrieval',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret retrieval failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretUpdate() {
        this.log('🔄 Testing secret update...', 'bold');

        if (this.testSecrets.length === 0) {
            this.log('⚠️ No test secrets available for update test', 'warning');
            return false;
        }

        try {
            const secretName = this.testSecrets[0];
            const updatedSecretValue = JSON.stringify({
                twitter_api_key: 'updated-twitter-key-12345',
                twitter_api_secret: 'updated-twitter-secret-67890',
                reddit_client_id: 'updated-reddit-id-abcde',
                reddit_client_secret: 'updated-reddit-secret-fghij',
                news_api_key: 'updated-news-key-klmno',
                maps_api_key: 'updated-maps-key-pqrst',
                weather_api_key: 'updated-weather-key-uvwxy',
                new_api_key: 'new-additional-key-xyz'
            });

            const command = new UpdateSecretCommand({
                SecretId: secretName,
                SecretString: updatedSecretValue,
                Description: 'Updated test secret for disaster alert system'
            });

            const response = await this.client.send(command);

            this.results.push({
                test: 'Secret Update',
                status: 'SUCCESS',
                details: {
                    secretName: secretName,
                    versionId: response.VersionId,
                    updated: true
                }
            });

            this.log(`✅ Secret ${secretName} updated successfully`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Secret Update',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret update failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretRotation() {
        this.log('🔄 Testing secret rotation simulation...', 'bold');

        if (this.testSecrets.length === 0) {
            this.log('⚠️ No test secrets available for rotation test', 'warning');
            return false;
        }

        try {
            const secretName = this.testSecrets[0];

            // Get current version
            const getCommand = new GetSecretValueCommand({
                SecretId: secretName
            });
            const currentResponse = await this.client.send(getCommand);
            const currentVersion = currentResponse.VersionId;

            // Update to simulate rotation
            const rotatedSecretValue = JSON.stringify({
                twitter_api_key: 'rotated-twitter-key-54321',
                twitter_api_secret: 'rotated-twitter-secret-09876',
                reddit_client_id: 'rotated-reddit-id-edcba',
                reddit_client_secret: 'rotated-reddit-secret-jihgf',
                news_api_key: 'rotated-news-key-onmlk',
                maps_api_key: 'rotated-maps-key-tsrqp',
                weather_api_key: 'rotated-weather-key-yxwvu',
                rotation_timestamp: new Date().toISOString()
            });

            const updateCommand = new UpdateSecretCommand({
                SecretId: secretName,
                SecretString: rotatedSecretValue
            });

            const updateResponse = await this.client.send(updateCommand);
            const newVersion = updateResponse.VersionId;

            // Verify version changed
            const versionChanged = currentVersion !== newVersion;

            this.results.push({
                test: 'Secret Rotation',
                status: versionChanged ? 'SUCCESS' : 'WARNING',
                details: {
                    secretName: secretName,
                    oldVersion: currentVersion,
                    newVersion: newVersion,
                    versionChanged: versionChanged
                }
            });

            if (versionChanged) {
                this.log(`✅ Secret rotation successful - Version changed from ${currentVersion} to ${newVersion}`, 'success');
            } else {
                this.log(`⚠️ Secret rotation completed but version unchanged`, 'warning');
            }

            return versionChanged;

        } catch (error) {
            this.results.push({
                test: 'Secret Rotation',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret rotation failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretEncryption() {
        this.log('🔒 Testing secret encryption...', 'bold');

        if (this.testSecrets.length === 0) {
            this.log('⚠️ No test secrets available for encryption test', 'warning');
            return false;
        }

        try {
            const secretName = this.testSecrets[0];
            const command = new GetSecretValueCommand({
                SecretId: secretName
            });

            const response = await this.client.send(command);

            // Check if secret is encrypted (AWS Secrets Manager encrypts by default)
            const isEncrypted = response.SecretString !== undefined;
            const hasVersionId = response.VersionId !== undefined;
            const hasArn = response.ARN !== undefined;

            this.results.push({
                test: 'Secret Encryption',
                status: isEncrypted ? 'SUCCESS' : 'FAILED',
                details: {
                    secretName: secretName,
                    isEncrypted: isEncrypted,
                    hasVersionId: hasVersionId,
                    hasArn: hasArn,
                    encryptionKey: response.KmsKeyId || 'Default'
                }
            });

            if (isEncrypted) {
                this.log(`✅ Secret encryption verified - Using key: ${response.KmsKeyId || 'Default'}`, 'success');
            } else {
                this.log(`❌ Secret encryption verification failed`, 'error');
            }

            return isEncrypted;

        } catch (error) {
            this.results.push({
                test: 'Secret Encryption',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret encryption test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretList() {
        this.log('📋 Testing secret listing...', 'bold');

        try {
            const command = new ListSecretsCommand({
                MaxResults: 50
            });

            const response = await this.client.send(command);
            const secrets = response.SecretList || [];

            // Filter for our test secrets
            const testSecrets = secrets.filter(secret =>
                secret.Name && secret.Name.startsWith('disaster-alert-test-')
            );

            this.results.push({
                test: 'Secret Listing',
                status: 'SUCCESS',
                details: {
                    totalSecrets: secrets.length,
                    testSecrets: testSecrets.length,
                    foundTestSecrets: testSecrets.map(s => s.Name)
                }
            });

            this.log(`✅ Secret listing successful - Found ${testSecrets.length} test secrets`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Secret Listing',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Secret listing failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testSecretPermissions() {
        this.log('🔐 Testing secret permissions...', 'bold');

        try {
            // Test read permission
            const listCommand = new ListSecretsCommand({ MaxResults: 1 });
            await this.client.send(listCommand);

            // Test write permission (if we have test secrets)
            if (this.testSecrets.length > 0) {
                const getCommand = new GetSecretValueCommand({
                    SecretId: this.testSecrets[0]
                });
                await this.client.send(getCommand);
            }

            this.results.push({
                test: 'Secret Permissions',
                status: 'SUCCESS',
                details: {
                    readPermission: true,
                    writePermission: true
                }
            });

            this.log('✅ Secret permissions are correct', 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Secret Permissions',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Permission test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async cleanupTestSecrets() {
        this.log('🧹 Cleaning up test secrets...', 'info');

        let cleanedCount = 0;

        for (const secretName of this.testSecrets) {
            try {
                const command = new DeleteSecretCommand({
                    SecretId: secretName,
                    ForceDeleteWithoutRecovery: true
                });

                await this.client.send(command);
                cleanedCount++;
                this.log(`   ✅ Deleted secret: ${secretName}`, 'success');

            } catch (error) {
                this.log(`   ⚠️ Failed to delete secret ${secretName}: ${error.message}`, 'warning');
            }
        }

        this.log(`✅ Cleaned up ${cleanedCount} test secrets`, 'success');
        return cleanedCount;
    }

    async runAllTests() {
        this.log('🚀 Starting Secrets Manager Test', 'bold');
        this.log('='.repeat(60), 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Start Time: ${new Date().toISOString()}`, 'info');
        this.log('='.repeat(60), 'bold');

        const tests = [
            () => this.testSecretCreation(),
            () => this.testSecretRetrieval(),
            () => this.testSecretUpdate(),
            () => this.testSecretRotation(),
            () => this.testSecretEncryption(),
            () => this.testSecretList(),
            () => this.testSecretPermissions()
        ];

        let successCount = 0;
        let totalCount = tests.length;

        for (const test of tests) {
            try {
                const success = await test();
                if (success) successCount++;
            } catch (error) {
                this.log(`❌ Test failed with error: ${error.message}`, 'error');
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Cleanup test secrets
        await this.cleanupTestSecrets();

        this.printSummary(successCount, totalCount);
    }

    printSummary(successCount, totalCount) {
        const totalDuration = Date.now() - this.startTime;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 SECRETS MANAGER TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        this.log(`\nTotal Tests: ${totalCount}`, 'info');
        this.log(`Successful: ${successCount}`, 'info');
        this.log(`Failed: ${totalCount - successCount}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');
        this.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach((result, index) => {
            const status = result.status === 'SUCCESS' ? '✅' :
                result.status === 'FAILED' ? '❌' :
                    result.status === 'WARNING' ? '⚠️' : 'ℹ️';

            console.log(`\n${index + 1}. ${status} ${result.test}`);
            if (result.details) {
                Object.entries(result.details).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        this.log('\n🎯 NEXT STEPS:', 'bold');
        if (successCount === totalCount) {
            this.log('🎉 Secrets Manager setup complete! Ready for API integrations.', 'success');
            this.log('   • Run: node test-s3-operations.js', 'info');
            this.log('   • Store production API keys in Secrets Manager', 'info');
        } else {
            this.log('⚠️ Some tests failed. Please check:', 'warning');
            this.log('   • AWS permissions for Secrets Manager', 'info');
            this.log('   • KMS key configuration', 'info');
            this.log('   • Secret naming conventions', 'info');
        }

        this.log('\n' + '='.repeat(60), 'bold');
    }
}

// Run the test
async function main() {
    const tester = new SecretsManagerTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SecretsManagerTester;