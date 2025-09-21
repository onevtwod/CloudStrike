#!/usr/bin/env node

/**
 * Test CloudWatch Operations
 * This script tests CloudWatch metrics, logs, and alarms for monitoring the disaster alert system
 */

const { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand, ListMetricsCommand, DescribeAlarmsCommand, PutMetricAlarmCommand, DeleteAlarmsCommand } = require('@aws-sdk/client-cloudwatch');
const { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand, PutLogEventsCommand, DescribeLogGroupsCommand, DeleteLogGroupCommand } = require('@aws-sdk/client-cloudwatch-logs');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class CloudWatchTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.cloudwatch = new CloudWatchClient({ region: this.region });
        this.cloudwatchLogs = new CloudWatchLogsClient({ region: this.region });
        this.results = [];
        this.testLogGroupName = `/aws/lambda/disaster-alert-test-${Date.now()}`;
        this.testAlarmName = `disaster-alert-test-alarm-${Date.now()}`;
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

    async testListMetrics() {
        this.log('📊 Testing List Metrics', 'bold');

        const result = await this.testOperation(
            'List Metrics',
            () => this.cloudwatch.send(new ListMetricsCommand({})),
            'List all available CloudWatch metrics'
        );

        if (result && result.Metrics) {
            this.log(`   Found ${result.Metrics.length} metrics:`, 'info');
            result.Metrics.slice(0, 10).forEach(metric => {
                this.log(`     - ${metric.Namespace}/${metric.MetricName}`, 'info');
            });
            if (result.Metrics.length > 10) {
                this.log(`     ... and ${result.Metrics.length - 10} more`, 'info');
            }
        }

        return result;
    }

    async testPutCustomMetrics() {
        this.log('📈 Testing Custom Metrics', 'bold');

        const customMetrics = [
            {
                MetricName: 'DisasterEventsProcessed',
                Namespace: 'DisasterAlert/Processing',
                Value: 15,
                Unit: 'Count',
                Dimensions: [
                    {
                        Name: 'EventType',
                        Value: 'flood'
                    },
                    {
                        Name: 'Region',
                        Value: 'Kuala Lumpur'
                    }
                ]
            },
            {
                MetricName: 'DisasterEventsVerified',
                Namespace: 'DisasterAlert/Processing',
                Value: 8,
                Unit: 'Count',
                Dimensions: [
                    {
                        Name: 'EventType',
                        Value: 'flood'
                    },
                    {
                        Name: 'Severity',
                        Value: 'high'
                    }
                ]
            },
            {
                MetricName: 'ProcessingLatency',
                Namespace: 'DisasterAlert/Performance',
                Value: 1250,
                Unit: 'Milliseconds',
                Dimensions: [
                    {
                        Name: 'Service',
                        Value: 'Comprehend'
                    }
                ]
            },
            {
                MetricName: 'APIRequests',
                Namespace: 'DisasterAlert/API',
                Value: 42,
                Unit: 'Count',
                Dimensions: [
                    {
                        Name: 'Endpoint',
                        Value: '/events'
                    },
                    {
                        Name: 'Method',
                        Value: 'GET'
                    }
                ]
            }
        ];

        const result = await this.testOperation(
            'Put Custom Metrics',
            () => this.cloudwatch.send(new PutMetricDataCommand({
                Namespace: 'DisasterAlert/Test',
                MetricData: customMetrics
            })),
            `Publish ${customMetrics.length} custom disaster alert metrics`
        );

        if (result) {
            this.log(`   Published ${customMetrics.length} custom metrics successfully`, 'info');
        }

        return result;
    }

    async testGetMetricStatistics() {
        this.log('📊 Testing Get Metric Statistics', 'bold');

        const result = await this.testOperation(
            'Get Metric Statistics',
            () => this.cloudwatch.send(new GetMetricStatisticsCommand({
                Namespace: 'AWS/Lambda',
                MetricName: 'Invocations',
                StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
                EndTime: new Date(),
                Period: 3600, // 1 hour
                Statistics: ['Sum', 'Average', 'Maximum']
            })),
            'Get Lambda invocations statistics for the last 24 hours'
        );

        if (result && result.Datapoints) {
            this.log(`   Found ${result.Datapoints.length} data points:`, 'info');
            result.Datapoints.slice(0, 5).forEach(datapoint => {
                this.log(`     ${datapoint.Timestamp}: Sum=${datapoint.Sum}, Avg=${datapoint.Average}, Max=${datapoint.Maximum}`, 'info');
            });
        }

        return result;
    }

    async testCreateLogGroup() {
        this.log('📝 Testing Log Group Creation', 'bold');

        const result = await this.testOperation(
            'Create Log Group',
            () => this.cloudwatchLogs.send(new CreateLogGroupCommand({
                logGroupName: this.testLogGroupName
            })),
            `Create test log group: ${this.testLogGroupName}`
        );

        if (result) {
            this.log(`   Log group created: ${this.testLogGroupName}`, 'info');
        }

        return result;
    }

    async testPutLogEvents() {
        this.log('📝 Testing Log Events', 'bold');

        const logStreamName = `test-stream-${Date.now()}`;

        // Create log stream first
        await this.cloudwatchLogs.send(new CreateLogStreamCommand({
            logGroupName: this.testLogGroupName,
            logStreamName: logStreamName
        }));

        const logEvents = [
            {
                message: 'Disaster event processed: flood in Kuala Lumpur',
                timestamp: Date.now(),
                level: 'INFO'
            },
            {
                message: 'Event verified with meteorological data: severity=high',
                timestamp: Date.now() + 1000,
                level: 'INFO'
            },
            {
                message: 'SNS notification sent to subscribers',
                timestamp: Date.now() + 2000,
                level: 'INFO'
            },
            {
                message: 'Error processing image: Invalid format',
                timestamp: Date.now() + 3000,
                level: 'ERROR'
            },
            {
                message: 'Queue processing completed: 5 messages processed',
                timestamp: Date.now() + 4000,
                level: 'INFO'
            }
        ];

        const result = await this.testOperation(
            'Put Log Events',
            () => this.cloudwatchLogs.send(new PutLogEventsCommand({
                logGroupName: this.testLogGroupName,
                logStreamName: logStreamName,
                logEvents: logEvents.map(event => ({
                    message: `[${event.level}] ${event.message}`,
                    timestamp: event.timestamp
                }))
            })),
            `Publish ${logEvents.length} log events to test log group`
        );

        if (result) {
            this.log(`   Published ${logEvents.length} log events successfully`, 'info');
        }

        return result;
    }

    async testListLogGroups() {
        this.log('📋 Testing List Log Groups', 'bold');

        const result = await this.testOperation(
            'List Log Groups',
            () => this.cloudwatchLogs.send(new DescribeLogGroupsCommand({})),
            'List all CloudWatch log groups'
        );

        if (result && result.logGroups) {
            this.log(`   Found ${result.logGroups.length} log groups:`, 'info');
            result.logGroups.slice(0, 10).forEach(logGroup => {
                this.log(`     - ${logGroup.logGroupName}`, 'info');
            });
            if (result.logGroups.length > 10) {
                this.log(`     ... and ${result.logGroups.length - 10} more`, 'info');
            }
        }

        return result;
    }

    async testCreateAlarm() {
        this.log('🚨 Testing Alarm Creation', 'bold');

        const result = await this.testOperation(
            'Create Metric Alarm',
            () => this.cloudwatch.send(new PutMetricAlarmCommand({
                AlarmName: this.testAlarmName,
                AlarmDescription: 'Test alarm for disaster alert system monitoring',
                MetricName: 'DisasterEventsProcessed',
                Namespace: 'DisasterAlert/Test',
                Statistic: 'Sum',
                Period: 300, // 5 minutes
                EvaluationPeriods: 2,
                Threshold: 10,
                ComparisonOperator: 'GreaterThanThreshold',
                AlarmActions: [], // No actions for test
                OKActions: [],
                InsufficientDataActions: []
            })),
            `Create test alarm: ${this.testAlarmName}`
        );

        if (result) {
            this.log(`   Alarm created: ${this.testAlarmName}`, 'info');
        }

        return result;
    }

    async testListAlarms() {
        this.log('📋 Testing List Alarms', 'bold');

        const result = await this.testOperation(
            'List Alarms',
            () => this.cloudwatch.send(new DescribeAlarmsCommand({})),
            'List all CloudWatch alarms'
        );

        if (result && result.MetricAlarms) {
            this.log(`   Found ${result.MetricAlarms.length} alarms:`, 'info');
            result.MetricAlarms.slice(0, 10).forEach(alarm => {
                this.log(`     - ${alarm.AlarmName} (${alarm.StateValue})`, 'info');
            });
            if (result.MetricAlarms.length > 10) {
                this.log(`     ... and ${result.MetricAlarms.length - 10} more`, 'info');
            }
        }

        return result;
    }

    async testDisasterAlertMetrics() {
        this.log('🚨 Testing Disaster Alert Specific Metrics', 'bold');

        const disasterMetrics = [
            {
                MetricName: 'FloodEvents',
                Namespace: 'DisasterAlert/Events',
                Value: 5,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Location', Value: 'Kuala Lumpur' },
                    { Name: 'Severity', Value: 'High' }
                ]
            },
            {
                MetricName: 'EarthquakeEvents',
                Namespace: 'DisasterAlert/Events',
                Value: 2,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Location', Value: 'Sabah' },
                    { Name: 'Severity', Value: 'Medium' }
                ]
            },
            {
                MetricName: 'FireEvents',
                Namespace: 'DisasterAlert/Events',
                Value: 3,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Location', Value: 'Penang' },
                    { Name: 'Severity', Value: 'Low' }
                ]
            },
            {
                MetricName: 'ProcessingTime',
                Namespace: 'DisasterAlert/Performance',
                Value: 850,
                Unit: 'Milliseconds',
                Dimensions: [
                    { Name: 'Service', Value: 'Comprehend' },
                    { Name: 'EventType', Value: 'Flood' }
                ]
            },
            {
                MetricName: 'NotificationsSent',
                Namespace: 'DisasterAlert/Notifications',
                Value: 12,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Channel', Value: 'SNS' },
                    { Name: 'EventType', Value: 'Flood' }
                ]
            }
        ];

        const result = await this.testOperation(
            'Put Disaster Alert Metrics',
            () => this.cloudwatch.send(new PutMetricDataCommand({
                Namespace: 'DisasterAlert/Production',
                MetricData: disasterMetrics
            })),
            `Publish ${disasterMetrics.length} disaster alert specific metrics`
        );

        if (result) {
            this.log(`   Published ${disasterMetrics.length} disaster metrics successfully`, 'info');
        }

        return result;
    }

    async testCloudWatchOperations() {
        this.log('☁️  Testing CloudWatch Operations', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Test Log Group: ${this.testLogGroupName}`, 'info');
        this.log(`Test Alarm: ${this.testAlarmName}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testListMetrics();
        await this.testPutCustomMetrics();
        await this.testGetMetricStatistics();
        await this.testCreateLogGroup();
        await this.testPutLogEvents();
        await this.testListLogGroups();
        await this.testCreateAlarm();
        await this.testListAlarms();
        await this.testDisasterAlertMetrics();

        // Cleanup
        await this.cleanup();

        this.printSummary();
    }

    async cleanup() {
        this.log('🧹 Cleaning up test resources...', 'info');

        try {
            // Delete test alarm
            await this.cloudwatch.send(new DeleteAlarmsCommand({
                AlarmNames: [this.testAlarmName]
            }));
            this.log('   Test alarm deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to delete test alarm: ${error.message}`, 'warning');
        }

        try {
            // Delete test log group
            await this.cloudwatchLogs.send(new DeleteLogGroupCommand({
                logGroupName: this.testLogGroupName
            }));
            this.log('   Test log group deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to delete test log group: ${error.message}`, 'warning');
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 CLOUDWATCH TEST SUMMARY', 'bold');
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
            this.log('\n🎉 All CloudWatch operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check CloudWatch service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new CloudWatchTester();
    await tester.testCloudWatchOperations();
    
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

module.exports = CloudWatchTester;
