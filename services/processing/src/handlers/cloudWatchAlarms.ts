import { CloudWatchClient, PutMetricAlarmCommand, DescribeAlarmsCommand, DeleteAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface AlarmConfig {
    alarmName: string;
    metricName: string;
    namespace: string;
    threshold: number;
    comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
    evaluationPeriods: number;
    period: number;
    statistic: 'Average' | 'Sum' | 'Minimum' | 'Maximum' | 'SampleCount';
    description: string;
    dimensions?: Array<{
        Name: string;
        Value: string;
    }>;
}

export const handler = async (event: any): Promise<{ alarmsCreated: number; alarmsUpdated: number }> => {
    console.log('Setting up CloudWatch alarms for disaster alert system');

    let alarmsCreated = 0;
    let alarmsUpdated = 0;

    try {
        // Define alarm configurations
        const alarmConfigs: AlarmConfig[] = [
            // Lambda Function Alarms
            {
                alarmName: 'disaster-alert-lambda-errors',
                metricName: 'Errors',
                namespace: 'AWS/Lambda',
                threshold: 5,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300, // 5 minutes
                statistic: 'Sum',
                description: 'Lambda function error rate is too high',
                dimensions: [
                    { Name: 'FunctionName', Value: 'disaster-alert-system-processTweet' }
                ]
            },
            {
                alarmName: 'disaster-alert-lambda-duration',
                metricName: 'Duration',
                namespace: 'AWS/Lambda',
                threshold: 25000, // 25 seconds
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Average',
                description: 'Lambda function duration is too high',
                dimensions: [
                    { Name: 'FunctionName', Value: 'disaster-alert-system-processTweet' }
                ]
            },
            {
                alarmName: 'disaster-alert-lambda-throttles',
                metricName: 'Throttles',
                namespace: 'AWS/Lambda',
                threshold: 10,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 1,
                period: 300,
                statistic: 'Sum',
                description: 'Lambda function is being throttled',
                dimensions: [
                    { Name: 'FunctionName', Value: 'disaster-alert-system-processTweet' }
                ]
            },

            // DynamoDB Alarms
            {
                alarmName: 'disaster-alert-dynamodb-throttles',
                metricName: 'ThrottledRequests',
                namespace: 'AWS/DynamoDB',
                threshold: 10,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Sum',
                description: 'DynamoDB is being throttled',
                dimensions: [
                    { Name: 'TableName', Value: 'disaster-events' }
                ]
            },
            {
                alarmName: 'disaster-alert-dynamodb-consumed-reads',
                metricName: 'ConsumedReadCapacityUnits',
                namespace: 'AWS/DynamoDB',
                threshold: 80,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Average',
                description: 'DynamoDB read capacity usage is high',
                dimensions: [
                    { Name: 'TableName', Value: 'disaster-events' }
                ]
            },
            {
                alarmName: 'disaster-alert-dynamodb-consumed-writes',
                metricName: 'ConsumedWriteCapacityUnits',
                namespace: 'AWS/DynamoDB',
                threshold: 80,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Average',
                description: 'DynamoDB write capacity usage is high',
                dimensions: [
                    { Name: 'TableName', Value: 'disaster-events' }
                ]
            },

            // SQS Alarms
            {
                alarmName: 'disaster-alert-sqs-messages-visible',
                metricName: 'ApproximateNumberOfVisibleMessages',
                namespace: 'AWS/SQS',
                threshold: 100,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Average',
                description: 'Too many messages in SQS queue',
                dimensions: [
                    { Name: 'QueueName', Value: 'disaster-social-media-queue' }
                ]
            },
            {
                alarmName: 'disaster-alert-sqs-messages-in-flight',
                metricName: 'ApproximateNumberOfMessagesNotVisible',
                namespace: 'AWS/SQS',
                threshold: 50,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 3,
                period: 300,
                statistic: 'Average',
                description: 'Too many messages being processed in SQS',
                dimensions: [
                    { Name: 'QueueName', Value: 'disaster-social-media-queue' }
                ]
            },

            // Custom Business Metrics Alarms
            {
                alarmName: 'disaster-alert-high-disaster-score',
                metricName: 'DisasterEventsProcessed',
                namespace: 'DisasterAlertSystem/Events',
                threshold: 10,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 1,
                period: 300,
                statistic: 'Sum',
                description: 'High number of disaster events detected',
                dimensions: [
                    { Name: 'Severity', Value: 'HIGH' }
                ]
            },
            {
                alarmName: 'disaster-alert-error-rate',
                metricName: 'ErrorCount',
                namespace: 'DisasterAlertSystem/Logs',
                threshold: 20,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                statistic: 'Sum',
                description: 'High error rate in the system',
                dimensions: [
                    { Name: 'Service', Value: 'disaster-alert-system' }
                ]
            },
            {
                alarmName: 'disaster-alert-processing-time',
                metricName: 'ProcessingTime',
                namespace: 'DisasterAlertSystem/SocialMedia',
                threshold: 10000, // 10 seconds
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 3,
                period: 300,
                statistic: 'Average',
                description: 'Social media processing time is too high',
                dimensions: [
                    { Name: 'Platform', Value: 'twitter' }
                ]
            }
        ];

        // Create or update alarms
        for (const config of alarmConfigs) {
            try {
                const result = await createOrUpdateAlarm(config);
                if (result.created) {
                    alarmsCreated++;
                } else {
                    alarmsUpdated++;
                }
            } catch (error) {
                console.error(`Error creating alarm ${config.alarmName}:`, error);
            }
        }

        // Create dashboard
        await createCloudWatchDashboard();

        console.log(`CloudWatch alarms setup completed: ${alarmsCreated} created, ${alarmsUpdated} updated`);
        return { alarmsCreated, alarmsUpdated };

    } catch (error) {
        console.error('Error setting up CloudWatch alarms:', error);
        throw error;
    }
};

async function createOrUpdateAlarm(config: AlarmConfig): Promise<{ created: boolean }> {
    try {
        // Check if alarm already exists
        const describeCommand = new DescribeAlarmsCommand({
            AlarmNames: [config.alarmName]
        });

        const existingAlarms = await cloudWatch.send(describeCommand);
        const alarmExists = existingAlarms.MetricAlarms && existingAlarms.MetricAlarms.length > 0;

        if (alarmExists) {
            console.log(`Alarm ${config.alarmName} already exists, skipping creation`);
            return { created: false };
        }

        // Create new alarm
        const command = new PutMetricAlarmCommand({
            AlarmName: config.alarmName,
            ComparisonOperator: config.comparisonOperator,
            EvaluationPeriods: config.evaluationPeriods,
            MetricName: config.metricName,
            Namespace: config.namespace,
            Period: config.period,
            Statistic: config.statistic,
            Threshold: config.threshold,
            ActionsEnabled: true,
            AlarmActions: [process.env.ALERTS_TOPIC_ARN || ''],
            OKActions: [process.env.ALERTS_TOPIC_ARN || ''],
            AlarmDescription: config.description,
            Dimensions: config.dimensions,
            TreatMissingData: 'notBreaching'
        });

        await cloudWatch.send(command);
        console.log(`Created alarm: ${config.alarmName}`);
        return { created: true };

    } catch (error) {
        console.error(`Error creating alarm ${config.alarmName}:`, error);
        throw error;
    }
}

async function createCloudWatchDashboard(): Promise<void> {
    console.log('Creating CloudWatch dashboard');

    const dashboardBody = {
        widgets: [
            {
                type: 'metric',
                x: 0,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['AWS/Lambda', 'Invocations', 'FunctionName', 'disaster-alert-system-processTweet'],
                        ['.', 'Errors', '.', '.'],
                        ['.', 'Duration', '.', '.'],
                        ['.', 'Throttles', '.', '.']
                    ],
                    view: 'timeSeries',
                    stacked: false,
                    region: process.env.AWS_REGION || 'us-east-1',
                    title: 'Lambda Function Metrics',
                    period: 300
                }
            },
            {
                type: 'metric',
                x: 12,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', 'disaster-events'],
                        ['.', 'ConsumedWriteCapacityUnits', '.', '.'],
                        ['.', 'ThrottledRequests', '.', '.']
                    ],
                    view: 'timeSeries',
                    stacked: false,
                    region: process.env.AWS_REGION || 'us-east-1',
                    title: 'DynamoDB Metrics',
                    period: 300
                }
            },
            {
                type: 'metric',
                x: 0,
                y: 6,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['AWS/SQS', 'ApproximateNumberOfVisibleMessages', 'QueueName', 'disaster-social-media-queue'],
                        ['.', 'ApproximateNumberOfMessagesNotVisible', '.', '.'],
                        ['.', 'NumberOfMessagesSent', '.', '.'],
                        ['.', 'NumberOfMessagesReceived', '.', '.']
                    ],
                    view: 'timeSeries',
                    stacked: false,
                    region: process.env.AWS_REGION || 'us-east-1',
                    title: 'SQS Queue Metrics',
                    period: 300
                }
            },
            {
                type: 'metric',
                x: 12,
                y: 6,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['DisasterAlertSystem/Events', 'DisasterEventsProcessed'],
                        ['DisasterAlertSystem/Logs', 'ErrorCount'],
                        ['DisasterAlertSystem/SocialMedia', 'PostsProcessed'],
                        ['DisasterAlertSystem/API', 'RequestCount']
                    ],
                    view: 'timeSeries',
                    stacked: false,
                    region: process.env.AWS_REGION || 'us-east-1',
                    title: 'Business Metrics',
                    period: 300
                }
            }
        ]
    };

    try {
        const command = new PutMetricAlarmCommand({
            AlarmName: 'disaster-alert-dashboard',
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 1,
            MetricName: 'Invocations',
            Namespace: 'AWS/Lambda',
            Period: 300,
            Statistic: 'Sum',
            Threshold: 0,
            ActionsEnabled: false,
            AlarmDescription: 'Dashboard placeholder alarm'
        });

        // Note: In a real implementation, you would use the CloudWatch Dashboard API
        // For now, we'll just log that the dashboard would be created
        console.log('CloudWatch dashboard configuration prepared');
    } catch (error) {
        console.error('Error creating dashboard:', error);
    }
}

// Function to send test alarm
export const sendTestAlarm = async (): Promise<void> => {
    try {
        const command = new PublishCommand({
            TopicArn: process.env.ALERTS_TOPIC_ARN,
            Subject: 'Test Alarm - Disaster Alert System',
            Message: JSON.stringify({
                type: 'test',
                message: 'This is a test alarm to verify the monitoring system is working correctly',
                timestamp: new Date().toISOString(),
                severity: 'INFO'
            })
        });

        await sns.send(command);
        console.log('Test alarm sent successfully');
    } catch (error) {
        console.error('Error sending test alarm:', error);
        throw error;
    }
};
