import { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand, PutLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudWatchLogs = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL'
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    function?: string;
    requestId?: string;
    userId?: string;
    metadata?: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export class Logger {
    private service: string;
    private function?: string;
    private logGroupName: string;
    private logStreamName: string;
    private sequenceToken?: string;

    constructor(service: string, functionName?: string) {
        this.service = service;
        this.function = functionName;
        this.logGroupName = `/aws/lambda/${service}`;
        this.logStreamName = `${functionName || 'default'}-${new Date().toISOString().split('T')[0]}`;
    }

    async debug(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.DEBUG, message, metadata);
    }

    async info(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.INFO, message, metadata);
    }

    async warn(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.WARN, message, metadata);
    }

    async error(message: string, error?: Error, metadata?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.ERROR, message, metadata, error);
    }

    async fatal(message: string, error?: Error, metadata?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.FATAL, message, metadata, error);
    }

    private async log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): Promise<void> {
        const logEntry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: this.service,
            function: this.function,
            requestId: process.env.AWS_REQUEST_ID,
            metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        };

        // Send to CloudWatch Logs
        await this.sendToCloudWatchLogs(logEntry);

        // Send metrics for error levels
        if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
            await this.sendErrorMetrics(level);
        }

        // Also log to console for local development
        if (process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify(logEntry, null, 2));
        }
    }

    private async sendToCloudWatchLogs(logEntry: LogEntry): Promise<void> {
        try {
            // Ensure log group exists
            await this.ensureLogGroupExists();

            // Ensure log stream exists
            await this.ensureLogStreamExists();

            // Send log event
            const command = new PutLogEventsCommand({
                logGroupName: this.logGroupName,
                logStreamName: this.logStreamName,
                logEvents: [{
                    timestamp: Date.now(),
                    message: JSON.stringify(logEntry)
                }],
                sequenceToken: this.sequenceToken
            });

            const response = await cloudWatchLogs.send(command);
            this.sequenceToken = response.nextSequenceToken;

        } catch (error) {
            console.error('Failed to send log to CloudWatch:', error);
        }
    }

    private async ensureLogGroupExists(): Promise<void> {
        try {
            const command = new DescribeLogGroupsCommand({
                logGroupNamePrefix: this.logGroupName
            });

            const response = await cloudWatchLogs.send(command);
            const logGroupExists = response.logGroups?.some(group => group.logGroupName === this.logGroupName);

            if (!logGroupExists) {
                await cloudWatchLogs.send(new CreateLogGroupCommand({
                    logGroupName: this.logGroupName
                }));
            }
        } catch (error) {
            // Log group might already exist or we might not have permissions
            console.warn('Could not ensure log group exists:', error);
        }
    }

    private async ensureLogStreamExists(): Promise<void> {
        try {
            await cloudWatchLogs.send(new CreateLogStreamCommand({
                logGroupName: this.logGroupName,
                logStreamName: this.logStreamName
            }));
        } catch (error) {
            // Log stream might already exist
            console.warn('Could not ensure log stream exists:', error);
        }
    }

    private async sendErrorMetrics(level: LogLevel): Promise<void> {
        try {
            const command = new PutMetricDataCommand({
                Namespace: 'DisasterAlertSystem/Logs',
                MetricData: [{
                    MetricName: 'ErrorCount',
                    Value: 1,
                    Unit: 'Count',
                    Timestamp: new Date(),
                    Dimensions: [
                        {
                            Name: 'Service',
                            Value: this.service
                        },
                        {
                            Name: 'Level',
                            Value: level
                        }
                    ]
                }]
            });

            await cloudWatch.send(command);
        } catch (error) {
            console.error('Failed to send error metrics:', error);
        }
    }

    // Business-specific logging methods
    async logDisasterEvent(eventId: string, eventType: string, severity: string, metadata?: Record<string, any>): Promise<void> {
        await this.info('Disaster event processed', {
            eventId,
            eventType,
            severity,
            ...metadata
        });

        // Send custom metric
        await this.sendDisasterEventMetrics(eventType, severity);
    }

    async logSocialMediaPost(platform: string, postId: string, processingTime: number, metadata?: Record<string, any>): Promise<void> {
        await this.info('Social media post processed', {
            platform,
            postId,
            processingTime,
            ...metadata
        });

        // Send custom metric
        await this.sendSocialMediaMetrics(platform, processingTime);
    }

    async logApiRequest(method: string, path: string, statusCode: number, responseTime: number, metadata?: Record<string, any>): Promise<void> {
        await this.info('API request processed', {
            method,
            path,
            statusCode,
            responseTime,
            ...metadata
        });

        // Send custom metric
        await this.sendApiMetrics(method, path, statusCode, responseTime);
    }

    private async sendDisasterEventMetrics(eventType: string, severity: string): Promise<void> {
        try {
            const command = new PutMetricDataCommand({
                Namespace: 'DisasterAlertSystem/Events',
                MetricData: [{
                    MetricName: 'DisasterEventsProcessed',
                    Value: 1,
                    Unit: 'Count',
                    Timestamp: new Date(),
                    Dimensions: [
                        {
                            Name: 'EventType',
                            Value: eventType
                        },
                        {
                            Name: 'Severity',
                            Value: severity
                        }
                    ]
                }]
            });

            await cloudWatch.send(command);
        } catch (error) {
            console.error('Failed to send disaster event metrics:', error);
        }
    }

    private async sendSocialMediaMetrics(platform: string, processingTime: number): Promise<void> {
        try {
            const command = new PutMetricDataCommand({
                Namespace: 'DisasterAlertSystem/SocialMedia',
                MetricData: [
                    {
                        MetricName: 'PostsProcessed',
                        Value: 1,
                        Unit: 'Count',
                        Timestamp: new Date(),
                        Dimensions: [
                            {
                                Name: 'Platform',
                                Value: platform
                            }
                        ]
                    },
                    {
                        MetricName: 'ProcessingTime',
                        Value: processingTime,
                        Unit: 'Milliseconds',
                        Timestamp: new Date(),
                        Dimensions: [
                            {
                                Name: 'Platform',
                                Value: platform
                            }
                        ]
                    }
                ]
            });

            await cloudWatch.send(command);
        } catch (error) {
            console.error('Failed to send social media metrics:', error);
        }
    }

    private async sendApiMetrics(method: string, path: string, statusCode: number, responseTime: number): Promise<void> {
        try {
            const command = new PutMetricDataCommand({
                Namespace: 'DisasterAlertSystem/API',
                MetricData: [
                    {
                        MetricName: 'RequestCount',
                        Value: 1,
                        Unit: 'Count',
                        Timestamp: new Date(),
                        Dimensions: [
                            {
                                Name: 'Method',
                                Value: method
                            },
                            {
                                Name: 'Path',
                                Value: path
                            },
                            {
                                Name: 'StatusCode',
                                Value: statusCode.toString()
                            }
                        ]
                    },
                    {
                        MetricName: 'ResponseTime',
                        Value: responseTime,
                        Unit: 'Milliseconds',
                        Timestamp: new Date(),
                        Dimensions: [
                            {
                                Name: 'Method',
                                Value: method
                            },
                            {
                                Name: 'Path',
                                Value: path
                            }
                        ]
                    }
                ]
            });

            await cloudWatch.send(command);
        } catch (error) {
            console.error('Failed to send API metrics:', error);
        }
    }
}

// Create a default logger instance
export const logger = new Logger('disaster-alert-system');

// Utility function for structured logging
export function createLogger(service: string, functionName?: string): Logger {
    return new Logger(service, functionName);
}
