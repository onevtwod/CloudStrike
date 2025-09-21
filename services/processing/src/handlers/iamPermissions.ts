import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, CreatePolicyCommand, PutRolePolicyCommand, ListAttachedRolePoliciesCommand, ListRolePoliciesCommand } from '@aws-sdk/client-iam';
import { logger } from '@shared/utils';

const iam = new IAMClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface RoleConfig {
    roleName: string;
    description: string;
    assumeRolePolicyDocument: string;
    policies: PolicyConfig[];
}

interface PolicyConfig {
    policyName: string;
    description: string;
    policyDocument: string;
}

export const handler = async (event: any): Promise<{ rolesCreated: number; policiesCreated: number }> => {
    console.log('Setting up AWS IAM roles and policies for disaster alert system');

    let rolesCreated = 0;
    let policiesCreated = 0;

    try {
        // Define role configurations
        const roleConfigs: RoleConfig[] = [
            {
                roleName: 'DisasterAlertSystem-LambdaExecutionRole',
                description: 'Execution role for Lambda functions in disaster alert system',
                assumeRolePolicyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                Service: 'lambda.amazonaws.com'
                            },
                            Action: 'sts:AssumeRole'
                        }
                    ]
                }),
                policies: [
                    {
                        policyName: 'DisasterAlertSystem-LambdaBasicExecution',
                        description: 'Basic Lambda execution permissions',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'logs:CreateLogGroup',
                                        'logs:CreateLogStream',
                                        'logs:PutLogEvents'
                                    ],
                                    Resource: 'arn:aws:logs:*:*:*'
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-DynamoDBAccess',
                        description: 'DynamoDB access for disaster events table',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'dynamodb:GetItem',
                                        'dynamodb:PutItem',
                                        'dynamodb:UpdateItem',
                                        'dynamodb:DeleteItem',
                                        'dynamodb:Query',
                                        'dynamodb:Scan'
                                    ],
                                    Resource: [
                                        'arn:aws:dynamodb:*:*:table/disaster-events',
                                        'arn:aws:dynamodb:*:*:table/disaster-events/index/*'
                                    ]
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-SNSPublish',
                        description: 'SNS publish permissions for alerts',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'sns:Publish'
                                    ],
                                    Resource: 'arn:aws:sns:*:*:disaster-alerts'
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-SQSAccess',
                        description: 'SQS access for message processing',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'sqs:SendMessage',
                                        'sqs:ReceiveMessage',
                                        'sqs:DeleteMessage',
                                        'sqs:GetQueueAttributes'
                                    ],
                                    Resource: [
                                        'arn:aws:sqs:*:*:disaster-social-media-queue',
                                        'arn:aws:sqs:*:*:disaster-priority-queue',
                                        'arn:aws:sqs:*:*:disaster-dead-letter-queue'
                                    ]
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-S3Access',
                        description: 'S3 access for image storage',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        's3:GetObject',
                                        's3:PutObject',
                                        's3:DeleteObject'
                                    ],
                                    Resource: 'arn:aws:s3:::disaster-alert-images-*/*'
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-AIServices',
                        description: 'AI services access (Comprehend, Rekognition)',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'comprehend:DetectEntities',
                                        'comprehend:DetectSentiment',
                                        'comprehend:DetectDominantLanguage',
                                        'rekognition:DetectLabels',
                                        'rekognition:DetectText',
                                        'rekognition:DetectModerationLabels',
                                    ],
                                    Resource: '*'
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-SecretsManager',
                        description: 'Secrets Manager access for API credentials',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'secretsmanager:GetSecretValue'
                                    ],
                                    Resource: 'arn:aws:secretsmanager:*:*:secret:disaster-alert/*'
                                }
                            ]
                        })
                    },
                    {
                        policyName: 'DisasterAlertSystem-CloudWatch',
                        description: 'CloudWatch metrics and logs access',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'cloudwatch:PutMetricData',
                                        'cloudwatch:GetMetricStatistics',
                                        'cloudwatch:ListMetrics',
                                        'logs:CreateLogGroup',
                                        'logs:CreateLogStream',
                                        'logs:PutLogEvents',
                                        'logs:DescribeLogGroups',
                                        'logs:DescribeLogStreams'
                                    ],
                                    Resource: '*'
                                }
                            ]
                        })
                    }
                ]
            },
            {
                roleName: 'DisasterAlertSystem-AdminRole',
                description: 'Admin role for disaster alert system management',
                assumeRolePolicyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                AWS: 'arn:aws:iam::*:root'
                            },
                            Action: 'sts:AssumeRole',
                            Condition: {
                                StringEquals: {
                                    'sts:ExternalId': 'disaster-alert-admin-2024'
                                }
                            }
                        }
                    ]
                }),
                policies: [
                    {
                        policyName: 'DisasterAlertSystem-AdminAccess',
                        description: 'Full access to disaster alert system resources',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: '*',
                                    Resource: '*',
                                    Condition: {
                                        StringLike: {
                                            'aws:ResourceTag/Service': 'disaster-alert*'
                                        }
                                    }
                                }
                            ]
                        })
                    }
                ]
            },
            {
                roleName: 'DisasterAlertSystem-ReadOnlyRole',
                description: 'Read-only role for disaster alert system monitoring',
                assumeRolePolicyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                AWS: 'arn:aws:iam::*:root'
                            },
                            Action: 'sts:AssumeRole'
                        }
                    ]
                }),
                policies: [
                    {
                        policyName: 'DisasterAlertSystem-ReadOnlyAccess',
                        description: 'Read-only access to disaster alert system resources',
                        policyDocument: JSON.stringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        'dynamodb:GetItem',
                                        'dynamodb:Query',
                                        'dynamodb:Scan',
                                        's3:GetObject',
                                        'cloudwatch:GetMetricStatistics',
                                        'cloudwatch:ListMetrics',
                                        'logs:DescribeLogGroups',
                                        'logs:DescribeLogStreams',
                                        'logs:GetLogEvents'
                                    ],
                                    Resource: '*'
                                }
                            ]
                        })
                    }
                ]
            }
        ];

        // Create roles and policies
        for (const roleConfig of roleConfigs) {
            try {
                const roleResult = await createRole(roleConfig);
                if (roleResult.created) {
                    rolesCreated++;
                }

                for (const policyConfig of roleConfig.policies) {
                    try {
                        const policyResult = await createPolicy(policyConfig);
                        if (policyResult.created) {
                            policiesCreated++;
                        }

                        // Attach policy to role
                        await attachPolicyToRole(roleConfig.roleName, policyConfig.policyName);
                    } catch (error) {
                        logger.error(`Error creating policy ${policyConfig.policyName}`, error as Error);
                    }
                }
            } catch (error) {
                logger.error(`Error creating role ${roleConfig.roleName}`, error as Error);
            }
        }

        logger.info('AWS IAM setup completed', {
            rolesCreated,
            policiesCreated
        });

        return { rolesCreated, policiesCreated };

    } catch (error) {
        logger.error('Error setting up AWS IAM', error as Error);
        throw error;
    }
};

async function createRole(roleConfig: RoleConfig): Promise<{ created: boolean }> {
    try {
        const command = new CreateRoleCommand({
            RoleName: roleConfig.roleName,
            AssumeRolePolicyDocument: roleConfig.assumeRolePolicyDocument,
            Description: roleConfig.description,
            Tags: [
                { Key: 'Service', Value: 'disaster-alert' },
                { Key: 'Environment', Value: 'production' },
                { Key: 'CreatedBy', Value: 'disaster-alert-setup' }
            ]
        });

        await iam.send(command);
        logger.info(`Created IAM role: ${roleConfig.roleName}`);
        return { created: true };

    } catch (error: any) {
        if (error.name === 'EntityAlreadyExistsException') {
            logger.info(`IAM role already exists: ${roleConfig.roleName}`);
            return { created: false };
        }
        throw error;
    }
}

async function createPolicy(policyConfig: PolicyConfig): Promise<{ created: boolean }> {
    try {
        const command = new CreatePolicyCommand({
            PolicyName: policyConfig.policyName,
            PolicyDocument: policyConfig.policyDocument,
            Description: policyConfig.description,
            Tags: [
                { Key: 'Service', Value: 'disaster-alert' },
                { Key: 'Environment', Value: 'production' },
                { Key: 'CreatedBy', Value: 'disaster-alert-setup' }
            ]
        });

        await iam.send(command);
        logger.info(`Created IAM policy: ${policyConfig.policyName}`);
        return { created: true };

    } catch (error: any) {
        if (error.name === 'EntityAlreadyExistsException') {
            logger.info(`IAM policy already exists: ${policyConfig.policyName}`);
            return { created: false };
        }
        throw error;
    }
}

async function attachPolicyToRole(roleName: string, policyName: string): Promise<void> {
    try {
        const command = new AttachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:policy/${policyName}`
        });

        await iam.send(command);
        logger.info(`Attached policy ${policyName} to role ${roleName}`);

    } catch (error) {
        logger.error(`Error attaching policy ${policyName} to role ${roleName}`, error as Error);
        throw error;
    }
}

// Function to create inline policy for role
async function createInlinePolicy(roleName: string, policyName: string, policyDocument: string): Promise<void> {
    try {
        const command = new PutRolePolicyCommand({
            RoleName: roleName,
            PolicyName: policyName,
            PolicyDocument: policyDocument
        });

        await iam.send(command);
        logger.info(`Created inline policy ${policyName} for role ${roleName}`);

    } catch (error) {
        logger.error(`Error creating inline policy ${policyName} for role ${roleName}`, error as Error);
        throw error;
    }
}

// Function to list role policies
async function listRolePolicies(roleName: string): Promise<{
    attachedPolicies: string[];
    inlinePolicies: string[];
}> {
    try {
        const [attachedResult, inlineResult] = await Promise.all([
            iam.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName })),
            iam.send(new ListRolePoliciesCommand({ RoleName: roleName }))
        ]);

        return {
            attachedPolicies: attachedResult.AttachedPolicies?.map(p => p.PolicyName || '') || [],
            inlinePolicies: inlineResult.PolicyNames || []
        };

    } catch (error) {
        logger.error(`Error listing policies for role ${roleName}`, error as Error);
        return { attachedPolicies: [], inlinePolicies: [] };
    }
}

// Function to create service-specific roles
export async function createServiceRoles(): Promise<void> {
    const serviceRoles = [
        {
            roleName: 'DisasterAlertSystem-ImageProcessor',
            description: 'Role for image processing Lambda functions',
            policies: [
                'DisasterAlertSystem-S3Access',
                'DisasterAlertSystem-AIServices',
                'DisasterAlertSystem-DynamoDBAccess'
            ]
        },
        {
            roleName: 'DisasterAlertSystem-SocialMediaScraper',
            description: 'Role for social media scraping Lambda functions',
            policies: [
                'DisasterAlertSystem-SQSAccess',
                'DisasterAlertSystem-SecretsManager',
                'DisasterAlertSystem-CloudWatch'
            ]
        },
        {
            roleName: 'DisasterAlertSystem-NotificationSender',
            description: 'Role for notification sending Lambda functions',
            policies: [
                'DisasterAlertSystem-SNSPublish',
                'DisasterAlertSystem-DynamoDBAccess',
                'DisasterAlertSystem-CloudWatch'
            ]
        }
    ];

    for (const serviceRole of serviceRoles) {
        try {
            await createRole({
                roleName: serviceRole.roleName,
                description: serviceRole.description,
                assumeRolePolicyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                Service: 'lambda.amazonaws.com'
                            },
                            Action: 'sts:AssumeRole'
                        }
                    ]
                }),
                policies: []
            });

            // Attach existing policies
            for (const policyName of serviceRole.policies) {
                await attachPolicyToRole(serviceRole.roleName, policyName);
            }

        } catch (error) {
            logger.error(`Error creating service role ${serviceRole.roleName}`, error as Error);
        }
    }
}
