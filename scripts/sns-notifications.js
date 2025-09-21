#!/usr/bin/env node

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

class SNSNotifications {
    constructor() {
        // Use AWS SDK default credential chain (includes OS-configured credentials)
        const config = {
            region: process.env.AWS_REGION || 'us-east-1'
        };

        // Only set explicit credentials if environment variables are provided
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };

            // Add session token if present (for temporary credentials)
            if (process.env.AWS_SESSION_TOKEN) {
                config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
            }
        }
        // If no explicit credentials, AWS SDK will use default credential chain

        this.sns = new SNSClient(config);

        this.topics = {
            disasterAlerts: process.env.SNS_DISASTER_ALERTS_TOPIC || 'disaster-alerts',
            verifications: process.env.SNS_VERIFICATIONS_TOPIC || 'disaster-verifications',
            systemStatus: process.env.SNS_SYSTEM_STATUS_TOPIC || 'system-status',
            emergency: process.env.SNS_EMERGENCY_TOPIC || 'emergency-alerts'
        };

        console.log('📢 SNS Notifications initialized');
    }

    // Send disaster alert notification
    async sendDisasterAlert(alert) {
        try {
            const message = {
                type: 'disaster_alert',
                alertId: alert.id,
                location: alert.location,
                severity: alert.severity,
                eventCount: alert.eventCount,
                timestamp: alert.timestamp,
                verified: alert.verified,
                message: this.formatDisasterAlertMessage(alert)
            };

            const command = new PublishCommand({
                TopicArn: this.topics.disasterAlerts,
                Subject: `🚨 Disaster Alert: ${alert.location}`,
                Message: JSON.stringify(message, null, 2),
                MessageAttributes: {
                    severity: {
                        DataType: 'String',
                        StringValue: this.getSeverityLevel(alert.severity)
                    },
                    location: {
                        DataType: 'String',
                        StringValue: alert.location
                    },
                    verified: {
                        DataType: 'String',
                        StringValue: alert.verified ? 'true' : 'false'
                    }
                }
            });

            const response = await this.sns.send(command);
            console.log(`   📢 Disaster alert sent: ${alert.id} (MessageId: ${response.MessageId})`);
            return response;

        } catch (error) {
            console.error('❌ Error sending disaster alert:', error.message);
            throw error;
        }
    }

    // Send verification notification
    async sendVerificationNotification(event, verification) {
        try {
            const message = {
                type: 'disaster_verified',
                eventId: event.id,
                location: event.location,
                disasterType: event.type,
                severity: event.severity,
                verificationSource: verification.source,
                verificationType: verification.type,
                verificationConfidence: verification.confidence,
                timestamp: verification.timestamp,
                message: this.formatVerificationMessage(event, verification)
            };

            const command = new PublishCommand({
                TopicArn: this.topics.verifications,
                Subject: `✅ Disaster Verified: ${event.location}`,
                Message: JSON.stringify(message, null, 2),
                MessageAttributes: {
                    verificationSource: {
                        DataType: 'String',
                        StringValue: verification.source
                    },
                    location: {
                        DataType: 'String',
                        StringValue: event.location
                    },
                    confidence: {
                        DataType: 'Number',
                        StringValue: verification.confidence.toString()
                    }
                }
            });

            const response = await this.sns.send(command);
            console.log(`   📢 Verification notification sent: ${event.id} (MessageId: ${response.MessageId})`);
            return response;

        } catch (error) {
            console.error('❌ Error sending verification notification:', error.message);
            throw error;
        }
    }

    // Send system status notification
    async sendSystemStatus(status) {
        try {
            const message = {
                type: 'system_status',
                timestamp: new Date().toISOString(),
                statistics: status.statistics,
                health: status.health,
                message: this.formatSystemStatusMessage(status)
            };

            const command = new PublishCommand({
                TopicArn: this.topics.systemStatus,
                Subject: `📊 System Status Update`,
                Message: JSON.stringify(message, null, 2),
                MessageAttributes: {
                    health: {
                        DataType: 'String',
                        StringValue: status.health
                    },
                    totalEvents: {
                        DataType: 'Number',
                        StringValue: status.statistics.events.toString()
                    }
                }
            });

            const response = await this.sns.send(command);
            console.log(`   📢 System status sent (MessageId: ${response.MessageId})`);
            return response;

        } catch (error) {
            console.error('❌ Error sending system status:', error.message);
            throw error;
        }
    }

    // Send emergency notification
    async sendEmergencyAlert(alert) {
        try {
            const message = {
                type: 'emergency_alert',
                alertId: alert.id,
                location: alert.location,
                severity: alert.severity,
                eventCount: alert.eventCount,
                timestamp: alert.timestamp,
                message: this.formatEmergencyMessage(alert)
            };

            const command = new PublishCommand({
                TopicArn: this.topics.emergency,
                Subject: `🚨 EMERGENCY: ${alert.location}`,
                Message: JSON.stringify(message, null, 2),
                MessageAttributes: {
                    severity: {
                        DataType: 'String',
                        StringValue: 'CRITICAL'
                    },
                    location: {
                        DataType: 'String',
                        StringValue: alert.location
                    },
                    priority: {
                        DataType: 'String',
                        StringValue: 'HIGH'
                    }
                }
            });

            const response = await this.sns.send(command);
            console.log(`   🚨 Emergency alert sent: ${alert.id} (MessageId: ${response.MessageId})`);
            return response;

        } catch (error) {
            console.error('❌ Error sending emergency alert:', error.message);
            throw error;
        }
    }

    // Send custom notification
    async sendCustomNotification(topic, subject, message, attributes = {}) {
        try {
            const command = new PublishCommand({
                TopicArn: topic,
                Subject: subject,
                Message: message,
                MessageAttributes: attributes
            });

            const response = await this.sns.send(command);
            console.log(`   📢 Custom notification sent (MessageId: ${response.MessageId})`);
            return response;

        } catch (error) {
            console.error('❌ Error sending custom notification:', error.message);
            throw error;
        }
    }

    // Format disaster alert message
    formatDisasterAlertMessage(alert) {
        const severity = this.getSeverityLevel(alert.severity);
        const verified = alert.verified ? '✅ VERIFIED' : '⏳ PENDING VERIFICATION';

        return `🚨 DISASTER ALERT

📍 Location: ${alert.location}
⚠️  Severity: ${severity} (${alert.severity.toFixed(2)})
📊 Events: ${alert.eventCount}
🔍 Status: ${verified}
⏰ Time: ${alert.timestamp}

This alert was generated based on ${alert.eventCount} social media posts reporting disaster-related events in ${alert.location}. Please verify with official sources before taking action.

Alert ID: ${alert.id}`;
    }

    // Format verification message
    formatVerificationMessage(event, verification) {
        return `✅ DISASTER VERIFIED

📍 Location: ${event.location}
🚨 Disaster Type: ${event.type}
⚠️  Severity: ${this.getSeverityLevel(event.severity)} (${event.severity.toFixed(2)})
🏢 Verified By: ${verification.source}
🔍 Confidence: ${(verification.confidence * 100).toFixed(1)}%
⏰ Verified At: ${verification.timestamp}

The disaster event has been officially confirmed by ${verification.source}. This is a verified disaster alert.

Event ID: ${event.id}
Verification ID: ${verification.id}`;
    }

    // Format system status message
    formatSystemStatusMessage(status) {
        const stats = status.statistics;
        const health = status.health;

        return `📊 SYSTEM STATUS UPDATE

🏥 Health: ${health}
📝 Raw Posts: ${stats.rawPosts}
🔍 Analyzed Posts: ${stats.analyzedPosts}
🚨 Events: ${stats.events}
⚠️  Alerts: ${stats.alerts}
✅ Verifications: ${stats.verifications}

Last Updated: ${stats.lastUpdated}

The disaster detection system is ${health.toLowerCase()}. All components are functioning normally.`;
    }

    // Format emergency message
    formatEmergencyMessage(alert) {
        return `🚨 EMERGENCY ALERT

📍 Location: ${alert.location}
⚠️  Severity: CRITICAL (${alert.severity.toFixed(2)})
📊 Events: ${alert.eventCount}
⏰ Time: ${alert.timestamp}

IMMEDIATE ATTENTION REQUIRED: Multiple disaster reports detected in ${alert.location}. This is a high-priority emergency alert requiring immediate response.

Alert ID: ${alert.id}`;
    }

    // Get severity level from numeric value
    getSeverityLevel(severity) {
        if (severity >= 0.8) return 'CRITICAL';
        if (severity >= 0.6) return 'HIGH';
        if (severity >= 0.4) return 'MEDIUM';
        if (severity >= 0.2) return 'LOW';
        return 'MINIMAL';
    }

    // Send batch notifications
    async sendBatchNotifications(notifications) {
        try {
            const promises = notifications.map(notification => {
                switch (notification.type) {
                    case 'disaster_alert':
                        return this.sendDisasterAlert(notification.data);
                    case 'verification':
                        return this.sendVerificationNotification(notification.event, notification.verification);
                    case 'system_status':
                        return this.sendSystemStatus(notification.data);
                    case 'emergency':
                        return this.sendEmergencyAlert(notification.data);
                    default:
                        return this.sendCustomNotification(
                            notification.topic,
                            notification.subject,
                            notification.message,
                            notification.attributes
                        );
                }
            });

            const results = await Promise.allSettled(promises);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`   📊 Batch notifications: ${successful} successful, ${failed} failed`);
            return results;

        } catch (error) {
            console.error('❌ Error in batch notifications:', error.message);
            throw error;
        }
    }

    // Test notification system
    async testNotifications() {
        try {
            console.log('🧪 Testing SNS notification system...');

            const testAlert = {
                id: 'test_alert_123',
                location: 'kuala lumpur',
                severity: 0.8,
                eventCount: 5,
                timestamp: new Date(),
                verified: false
            };

            const testEvent = {
                id: 'test_event_123',
                location: 'kuala lumpur',
                type: 'earthquake',
                severity: 0.8
            };

            const testVerification = {
                source: 'Malaysian Meteorological Department',
                type: 'official_alert',
                confidence: 0.95,
                timestamp: new Date()
            };

            const testStatus = {
                statistics: {
                    rawPosts: 100,
                    analyzedPosts: 85,
                    events: 15,
                    alerts: 3,
                    verifications: 8
                },
                health: 'HEALTHY'
            };

            // Test all notification types
            await this.sendDisasterAlert(testAlert);
            await this.sendVerificationNotification(testEvent, testVerification);
            await this.sendSystemStatus(testStatus);

            console.log('   ✅ All notification tests completed successfully');
            return true;

        } catch (error) {
            console.error('❌ Error testing notifications:', error.message);
            return false;
        }
    }
}

module.exports = SNSNotifications;
