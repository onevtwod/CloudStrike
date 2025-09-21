import { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, UpdateSecretCommand, DescribeSecretCommand, RotateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@shared/utils';

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface SecretConfig {
    name: string;
    description: string;
    secretString: string;
    tags?: Array<{
        Key: string;
        Value: string;
    }>;
}

interface SocialMediaCredentials {
    twitterBearerToken?: string;
    redditClientId?: string;
    redditClientSecret?: string;
    newsApiKey?: string;
    facebookAccessToken?: string;
    instagramAccessToken?: string;
}

interface DatabaseCredentials {
    username: string;
    password: string;
    host: string;
    port: number;
    database: string;
}

interface ApiKeys {
    mapsApiKey?: string;
    weatherApiKey?: string;
    emergencyApiKey?: string;
}

export const handler = async (event: any): Promise<{ secretsCreated: number; secretsUpdated: number }> => {
    console.log('Setting up AWS Secrets Manager for disaster alert system');

    let secretsCreated = 0;
    let secretsUpdated = 0;

    try {
        // Define secret configurations
        const secretConfigs: SecretConfig[] = [
            {
                name: 'disaster-alert/social-media-credentials',
                description: 'API credentials for social media platforms (Twitter, Reddit, News API)',
                secretString: JSON.stringify({
                    twitterBearerToken: '',
                    redditClientId: '',
                    redditClientSecret: '',
                    newsApiKey: '',
                    facebookAccessToken: '',
                    instagramAccessToken: ''
                }),
                tags: [
                    { Key: 'Environment', Value: 'production' },
                    { Key: 'Service', Value: 'disaster-alert' },
                    { Key: 'Type', Value: 'api-credentials' }
                ]
            },
            {
                name: 'disaster-alert/database-credentials',
                description: 'Database connection credentials for disaster alert system',
                secretString: JSON.stringify({
                    username: 'disaster_alert_user',
                    password: 'change_me_secure_password',
                    host: 'disaster-alert-db.cluster-xyz.us-east-1.rds.amazonaws.com',
                    port: 5432,
                    database: 'disaster_alert'
                }),
                tags: [
                    { Key: 'Environment', Value: 'production' },
                    { Key: 'Service', Value: 'disaster-alert' },
                    { Key: 'Type', Value: 'database-credentials' }
                ]
            },
            {
                name: 'disaster-alert/api-keys',
                description: 'Third-party API keys for external services',
                secretString: JSON.stringify({
                    mapsApiKey: '',
                    weatherApiKey: '',
                    emergencyApiKey: '',
                    googleMapsApiKey: '',
                    openWeatherApiKey: ''
                }),
                tags: [
                    { Key: 'Environment', Value: 'production' },
                    { Key: 'Service', Value: 'disaster-alert' },
                    { Key: 'Type', Value: 'api-keys' }
                ]
            },
            {
                name: 'disaster-alert/encryption-keys',
                description: 'Encryption keys for data protection',
                secretString: JSON.stringify({
                    dataEncryptionKey: generateEncryptionKey(),
                    jwtSecret: generateJWTSecret(),
                    webhookSecret: generateWebhookSecret()
                }),
                tags: [
                    { Key: 'Environment', Value: 'production' },
                    { Key: 'Service', Value: 'disaster-alert' },
                    { Key: 'Type', Value: 'encryption-keys' }
                ]
            }
        ];

        // Create or update secrets
        for (const config of secretConfigs) {
            try {
                const result = await createOrUpdateSecret(config);
                if (result.created) {
                    secretsCreated++;
                } else {
                    secretsUpdated++;
                }
            } catch (error) {
                logger.error(`Error managing secret ${config.name}`, error as Error);
            }
        }

        // Set up secret rotation for database credentials
        await setupSecretRotation('disaster-alert/database-credentials');

        logger.info('AWS Secrets Manager setup completed', {
            secretsCreated,
            secretsUpdated
        });

        return { secretsCreated, secretsUpdated };

    } catch (error) {
        logger.error('Error setting up AWS Secrets Manager', error as Error);
        throw error;
    }
};

async function createOrUpdateSecret(config: SecretConfig): Promise<{ created: boolean }> {
    try {
        // Check if secret already exists
        const describeCommand = new DescribeSecretCommand({
            SecretId: config.name
        });

        try {
            await secretsManager.send(describeCommand);

            // Secret exists, update it
            const updateCommand = new UpdateSecretCommand({
                SecretId: config.name,
                SecretString: config.secretString,
                Description: config.description
            });

            await secretsManager.send(updateCommand);
            logger.info(`Updated secret: ${config.name}`);
            return { created: false };

        } catch (error: any) {
            if (error.name === 'ResourceNotFoundException') {
                // Secret doesn't exist, create it
                const createCommand = new CreateSecretCommand({
                    Name: config.name,
                    Description: config.description,
                    SecretString: config.secretString,
                    Tags: config.tags
                });

                await secretsManager.send(createCommand);
                logger.info(`Created secret: ${config.name}`);
                return { created: true };
            } else {
                throw error;
            }
        }

    } catch (error) {
        logger.error(`Error managing secret ${config.name}`, error as Error);
        throw error;
    }
}

async function setupSecretRotation(secretName: string): Promise<void> {
    try {
        const command = new RotateSecretCommand({
            SecretId: secretName,
            RotationLambdaARN: process.env.ROTATION_LAMBDA_ARN,
            RotationRules: {
                AutomaticallyAfterDays: 30
            }
        });

        await secretsManager.send(command);
        logger.info(`Set up rotation for secret: ${secretName}`);
    } catch (error) {
        logger.warn(`Could not set up rotation for secret ${secretName}:`, error);
    }
}

// Utility functions for getting secrets
export async function getSocialMediaCredentials(): Promise<SocialMediaCredentials> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: 'disaster-alert/social-media-credentials'
        });

        const response = await secretsManager.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        logger.error('Error retrieving social media credentials', error as Error);
        return {};
    }
}

export async function getDatabaseCredentials(): Promise<DatabaseCredentials | null> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: 'disaster-alert/database-credentials'
        });

        const response = await secretsManager.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        logger.error('Error retrieving database credentials', error as Error);
        return null;
    }
}

export async function getApiKeys(): Promise<ApiKeys> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: 'disaster-alert/api-keys'
        });

        const response = await secretsManager.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        logger.error('Error retrieving API keys', error as Error);
        return {};
    }
}

export async function getEncryptionKeys(): Promise<{
    dataEncryptionKey?: string;
    jwtSecret?: string;
    webhookSecret?: string;
}> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: 'disaster-alert/encryption-keys'
        });

        const response = await secretsManager.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        logger.error('Error retrieving encryption keys', error as Error);
        return {};
    }
}

// Helper functions for generating secure keys
function generateEncryptionKey(): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
}

function generateJWTSecret(): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64');
}

function generateWebhookSecret(): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
}

// Function to update specific secret values
export async function updateSocialMediaCredentials(credentials: Partial<SocialMediaCredentials>): Promise<void> {
    try {
        const currentCredentials = await getSocialMediaCredentials();
        const updatedCredentials = { ...currentCredentials, ...credentials };

        const command = new UpdateSecretCommand({
            SecretId: 'disaster-alert/social-media-credentials',
            SecretString: JSON.stringify(updatedCredentials)
        });

        await secretsManager.send(command);
        logger.info('Updated social media credentials');
    } catch (error) {
        logger.error('Error updating social media credentials', error as Error);
        throw error;
    }
}

export async function updateApiKeys(apiKeys: Partial<ApiKeys>): Promise<void> {
    try {
        const currentApiKeys = await getApiKeys();
        const updatedApiKeys = { ...currentApiKeys, ...apiKeys };

        const command = new UpdateSecretCommand({
            SecretId: 'disaster-alert/api-keys',
            SecretString: JSON.stringify(updatedApiKeys)
        });

        await secretsManager.send(command);
        logger.info('Updated API keys');
    } catch (error) {
        logger.error('Error updating API keys', error as Error);
        throw error;
    }
}

// Function to validate secret integrity
export async function validateSecrets(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
        // Check social media credentials
        const socialCredentials = await getSocialMediaCredentials();
        if (!socialCredentials.twitterBearerToken && !socialCredentials.redditClientId) {
            errors.push('Social media credentials are incomplete');
        }

        // Check database credentials
        const dbCredentials = await getDatabaseCredentials();
        if (!dbCredentials || !dbCredentials.host || !dbCredentials.password) {
            errors.push('Database credentials are incomplete');
        }

        // Check API keys
        const apiKeys = await getApiKeys();
        if (!apiKeys.mapsApiKey && !apiKeys.weatherApiKey) {
            errors.push('API keys are incomplete');
        }

        // Check encryption keys
        const encryptionKeys = await getEncryptionKeys();
        if (!encryptionKeys.dataEncryptionKey || !encryptionKeys.jwtSecret) {
            errors.push('Encryption keys are incomplete');
        }

        return {
            valid: errors.length === 0,
            errors
        };

    } catch (error) {
        logger.error('Error validating secrets', error as Error);
        return {
            valid: false,
            errors: ['Failed to validate secrets']
        };
    }
}
