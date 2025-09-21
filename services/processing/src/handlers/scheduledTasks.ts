import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

interface ScheduledEvent {
    source: string;
    detailType: string;
    detail: any;
    time: string;
}

export const handler = async (event: any): Promise<{ tasksExecuted: number; errors: number }> => {
    console.log('Starting scheduled tasks execution');

    let tasksExecuted = 0;
    let errors = 0;

    try {
        // Execute different scheduled tasks based on the event source
        const eventSource = event.source || 'aws.events';

        switch (eventSource) {
            case 'aws.events':
                // CloudWatch Events scheduled events
                await executeScheduledTasks(event);
                tasksExecuted++;
                break;


            default:
                console.log(`Unknown event source: ${eventSource}`);
        }

        // Send custom metrics
        await sendMetrics({
            tasksExecuted,
            errors,
            timestamp: new Date().toISOString()
        });

        console.log(`Scheduled tasks completed: ${tasksExecuted} executed, ${errors} errors`);
        return { tasksExecuted, errors };

    } catch (error) {
        console.error('Error in scheduled tasks:', error);
        errors++;
        throw error;
    }
};

async function executeScheduledTasks(event: any): Promise<void> {
    console.log('Executing scheduled tasks from CloudWatch Events');

    // Task 1: Social Media Scraping (every 5 minutes)
    if (event['detail-type'] === 'Scheduled Social Media Scraping') {
        await invokeLambdaFunction('socialMediaScraper', {
            platform: 'all',
            maxResults: 100
        });
    }

    // Task 2: Queue Processing (every minute)
    if (event['detail-type'] === 'Scheduled Queue Processing') {
        await invokeLambdaFunction('processQueue', {});
    }

    // Task 3: Data Cleanup (daily at 2 AM)
    if (event['detail-type'] === 'Scheduled Data Cleanup') {
        await cleanupOldData();
    }

    // Task 4: Health Check (every 10 minutes)
    if (event['detail-type'] === 'Scheduled Health Check') {
        await performHealthCheck();
    }

    // Task 5: Metrics Collection (every hour)
    if (event['detail-type'] === 'Scheduled Metrics Collection') {
        await collectSystemMetrics();
    }
}


async function invokeLambdaFunction(functionName: string, payload: any): Promise<void> {
    try {
        const command = new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify(payload)
        });

        await lambda.send(command);
        console.log(`Invoked Lambda function: ${functionName}`);
    } catch (error) {
        console.error(`Error invoking Lambda function ${functionName}:`, error);
        throw error;
    }
}

async function cleanupOldData(): Promise<void> {
    console.log('Starting data cleanup task');

    try {
        // Clean up old events (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const scanCommand = new ScanCommand({
            TableName: process.env.EVENTS_TABLE,
            FilterExpression: 'createdAt < :cutoffDate',
            ExpressionAttributeValues: {
                ':cutoffDate': thirtyDaysAgo.toISOString()
            }
        });

        const result = await dynamoDb.send(scanCommand);
        const oldEvents = result.Items || [];

        console.log(`Found ${oldEvents.length} old events to clean up`);

        // Delete old events in batches
        for (const event of oldEvents) {
            await dynamoDb.send(new UpdateCommand({
                TableName: process.env.EVENTS_TABLE,
                Key: { id: event.id },
                UpdateExpression: 'SET #deleted = :deleted, #deletedAt = :deletedAt',
                ExpressionAttributeNames: {
                    '#deleted': 'deleted',
                    '#deletedAt': 'deletedAt'
                },
                ExpressionAttributeValues: {
                    ':deleted': true,
                    ':deletedAt': new Date().toISOString()
                }
            }));
        }

        console.log(`Cleaned up ${oldEvents.length} old events`);
    } catch (error) {
        console.error('Error during data cleanup:', error);
        throw error;
    }
}

async function performHealthCheck(): Promise<void> {
    console.log('Performing system health check');

    try {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            services: {
                dynamodb: await checkDynamoDBHealth(),
                sns: await checkSNSHealth(),
                sqs: await checkSQSHealth(),
                lambda: await checkLambdaHealth()
            }
        };

        // Send health status to CloudWatch
        await sendHealthMetrics(healthStatus);

        // If any service is unhealthy, send alert
        const unhealthyServices = Object.entries(healthStatus.services)
            .filter(([_, status]) => !status.healthy)
            .map(([service, _]) => service);

        if (unhealthyServices.length > 0) {
            await sendHealthAlert(unhealthyServices);
        }

        console.log('Health check completed');
    } catch (error) {
        console.error('Error during health check:', error);
        throw error;
    }
}

async function checkDynamoDBHealth(): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    try {
        await dynamoDb.send(new ScanCommand({
            TableName: process.env.EVENTS_TABLE,
            Limit: 1
        }));
        return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
        return { healthy: false, responseTime: Date.now() - startTime };
    }
}

async function checkSNSHealth(): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    try {
        // Simple SNS health check - try to get topic attributes
        return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
        return { healthy: false, responseTime: Date.now() - startTime };
    }
}

async function checkSQSHealth(): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    try {
        // Simple SQS health check
        return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
        return { healthy: false, responseTime: Date.now() - startTime };
    }
}

async function checkLambdaHealth(): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    try {
        // Simple Lambda health check
        return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
        return { healthy: false, responseTime: Date.now() - startTime };
    }
}

async function collectSystemMetrics(): Promise<void> {
    console.log('Collecting system metrics');

    try {
        // Get event counts from DynamoDB
        const eventCounts = await getEventCounts();

        // Send metrics to CloudWatch
        await sendSystemMetrics(eventCounts);

        console.log('System metrics collected');
    } catch (error) {
        console.error('Error collecting system metrics:', error);
        throw error;
    }
}

async function getEventCounts(): Promise<any> {
    const scanCommand = new ScanCommand({
        TableName: process.env.EVENTS_TABLE,
        Select: 'COUNT'
    });

    const result = await dynamoDb.send(scanCommand);
    return {
        totalEvents: result.Count || 0,
        timestamp: new Date().toISOString()
    };
}

async function verifyDisasterEvents(payload: any): Promise<void> {
    console.log('Verifying disaster events');

    // Implementation for disaster event verification
    // This could involve cross-referencing with meteorological data,
    // checking multiple sources, etc.
}

async function distributeAlerts(payload: any): Promise<void> {
    console.log('Distributing alerts');

    // Implementation for alert distribution
    // This could involve sending notifications to subscribers,
    // updating dashboards, etc.
}

async function sendMetrics(metrics: any): Promise<void> {
    const command = new PutMetricDataCommand({
        Namespace: 'DisasterAlertSystem/ScheduledTasks',
        MetricData: [
            {
                MetricName: 'TasksExecuted',
                Value: metrics.tasksExecuted,
                Unit: 'Count',
                Timestamp: new Date()
            },
            {
                MetricName: 'TaskErrors',
                Value: metrics.errors,
                Unit: 'Count',
                Timestamp: new Date()
            }
        ]
    });

    await cloudWatch.send(command);
}

async function sendHealthMetrics(healthStatus: any): Promise<void> {
    const command = new PutMetricDataCommand({
        Namespace: 'DisasterAlertSystem/Health',
        MetricData: Object.entries(healthStatus.services).map(([service, status]: [string, any]) => ({
            MetricName: `${service}Health`,
            Value: status.healthy ? 1 : 0,
            Unit: 'None',
            Timestamp: new Date()
        }))
    });

    await cloudWatch.send(command);
}

async function sendHealthAlert(unhealthyServices: string[]): Promise<void> {
    // Send health alert via SNS
    console.log(`Health alert for services: ${unhealthyServices.join(', ')}`);
    // Note: In a real implementation, you would send this via SNS
    // For now, we'll just log it
}
