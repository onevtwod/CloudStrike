#!/usr/bin/env node

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

class EnhancedSNSNotifications {
    constructor(storage) {
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
        this.ses = new SESClient(config);
        this.storage = storage; // DynamoDB storage instance

        this.topics = {
            disasterAlerts: process.env.SNS_DISASTER_ALERTS_TOPIC || 'disaster-alerts',
            verifications: process.env.SNS_VERIFICATIONS_TOPIC || 'disaster-verifications',
            systemStatus: process.env.SNS_SYSTEM_STATUS_TOPIC || 'system-status',
            emergency: process.env.SNS_EMERGENCY_TOPIC || 'emergency-alerts'
        };

        console.log('📢 Enhanced SNS Notifications initialized with DynamoDB subscriber support');
    }

    // Send disaster alert notification to all subscribers
    async sendDisasterAlert(alert) {
        try {
            console.log(`📢 Sending disaster alert to all subscribers: ${alert.id}`);

            // Check if this alert has already been sent to prevent duplicates
            const alreadySent = await this.checkNotificationSent(alert.id, 'disaster');
            if (alreadySent) {
                console.log(`   ⚠️  Disaster alert ${alert.id} already sent - skipping duplicate`);
                return { success: true, skipped: true, reason: 'Already sent' };
            }

            // Get all subscribers who want disaster alerts
            const subscribers = await this.storage.getActiveSubscribers('disasterAlerts');
            console.log(`   📊 Found ${subscribers.length} subscribers for disaster alerts`);

            // Get location-specific subscribers if location is available
            let locationSubscribers = [];
            if (alert.location && alert.location !== 'unknown') {
                locationSubscribers = await this.storage.getSubscribersByLocation(alert.location, 'disasterAlerts');
                console.log(`   📍 Found ${locationSubscribers.length} location-specific subscribers for ${alert.location}`);
            }

            // Combine all subscribers (remove duplicates)
            const allSubscribers = this.mergeSubscribers(subscribers, locationSubscribers);
            console.log(`   📊 Total unique subscribers: ${allSubscribers.length}`);

            if (allSubscribers.length === 0) {
                console.log('   ⚠️  No subscribers found for disaster alerts');
                return { messageId: 'no-subscribers', subscriberCount: 0 };
            }

            // Send notifications to all subscribers
            const results = await this.sendNotificationsToSubscribers(allSubscribers, {
                type: 'disaster_alert',
                alertId: alert.id,
                location: alert.location,
                severity: alert.severity,
                eventCount: alert.eventCount,
                timestamp: alert.timestamp,
                verified: alert.verified,
                subject: `🚨 Disaster Alert: ${alert.location}`,
                message: this.formatDisasterAlertMessage(alert),
                attributes: {
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

            // Update subscriber notification timestamps
            await this.updateSubscriberTimestamps(allSubscribers, 'disaster_alert');

            // Mark this alert as sent to prevent duplicates
            await this.markNotificationSent(alert.id, 'disaster', results.successful);

            console.log(`   ✅ Disaster alert sent to ${results.successful} subscribers`);
            return results;

        } catch (error) {
            console.error('❌ Error sending disaster alert to subscribers:', error.message);
            throw error;
        }
    }

    // Send verification notification to all subscribers
    async sendVerificationNotification(event, verification) {
        try {
            console.log(`📢 Sending verification notification to all subscribers: ${event.id}`);

            // Get all subscribers who want verification notifications
            const subscribers = await this.storage.getActiveSubscribers('verifications');
            console.log(`   📊 Found ${subscribers.length} subscribers for verification notifications`);

            // Get location-specific subscribers if location is available
            let locationSubscribers = [];
            if (event.location && event.location !== 'unknown') {
                locationSubscribers = await this.storage.getSubscribersByLocation(event.location, 'verifications');
                console.log(`   📍 Found ${locationSubscribers.length} location-specific subscribers for ${event.location}`);
            }

            // Combine all subscribers (remove duplicates)
            const allSubscribers = this.mergeSubscribers(subscribers, locationSubscribers);
            console.log(`   📊 Total unique subscribers: ${allSubscribers.length}`);

            if (allSubscribers.length === 0) {
                console.log('   ⚠️  No subscribers found for verification notifications');
                return { messageId: 'no-subscribers', subscriberCount: 0 };
            }

            // Send notifications to all subscribers
            const results = await this.sendNotificationsToSubscribers(allSubscribers, {
                type: 'disaster_verified',
                eventId: event.id,
                location: event.location,
                disasterType: event.type,
                severity: event.severity,
                verificationSource: verification.source,
                verificationType: verification.type,
                verificationConfidence: verification.confidence,
                timestamp: verification.timestamp,
                subject: `✅ Disaster Verified: ${event.location}`,
                message: this.formatVerificationMessage(event, verification),
                attributes: {
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

            // Update subscriber notification timestamps
            await this.updateSubscriberTimestamps(allSubscribers, 'verification');

            console.log(`   ✅ Verification notification sent to ${results.successful} subscribers`);
            return results;

        } catch (error) {
            console.error('❌ Error sending verification notification to subscribers:', error.message);
            throw error;
        }
    }

    // Send system status notification to all subscribers
    async sendSystemStatus(status) {
        try {
            console.log(`📢 Sending system status notification to all subscribers`);

            // Get all subscribers who want system status notifications
            const subscribers = await this.storage.getActiveSubscribers('systemStatus');
            console.log(`   📊 Found ${subscribers.length} subscribers for system status notifications`);

            if (subscribers.length === 0) {
                console.log('   ⚠️  No subscribers found for system status notifications');
                return { messageId: 'no-subscribers', subscriberCount: 0 };
            }

            // Send notifications to all subscribers
            const results = await this.sendNotificationsToSubscribers(subscribers, {
                type: 'system_status',
                timestamp: new Date().toISOString(),
                statistics: status.statistics,
                health: status.health,
                subject: `📊 System Status Update`,
                message: this.formatSystemStatusMessage(status),
                attributes: {
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

            // Update subscriber notification timestamps
            await this.updateSubscriberTimestamps(subscribers, 'system_status');

            console.log(`   ✅ System status notification sent to ${results.successful} subscribers`);
            return results;

        } catch (error) {
            console.error('❌ Error sending system status notification to subscribers:', error.message);
            throw error;
        }
    }

    // Send emergency alert notification to all subscribers
    async sendEmergencyAlert(alert) {
        try {
            console.log(`🚨 Sending emergency alert to all subscribers: ${alert.id}`);

            // Check if this alert has already been sent to prevent duplicates
            const alreadySent = await this.checkNotificationSent(alert.id, 'emergency');
            if (alreadySent) {
                console.log(`   ⚠️  Emergency alert ${alert.id} already sent - skipping duplicate`);
                return { success: true, skipped: true, reason: 'Already sent' };
            }

            // Get all subscribers who want emergency alerts
            const subscribers = await this.storage.getActiveSubscribers('emergencyAlerts');
            console.log(`   📊 Found ${subscribers.length} subscribers for emergency alerts`);

            // Get location-specific subscribers if location is available
            let locationSubscribers = [];
            if (alert.location && alert.location !== 'unknown') {
                locationSubscribers = await this.storage.getSubscribersByLocation(alert.location, 'emergencyAlerts');
                console.log(`   📍 Found ${locationSubscribers.length} location-specific subscribers for ${alert.location}`);
            }

            // Combine all subscribers (remove duplicates)
            const allSubscribers = this.mergeSubscribers(subscribers, locationSubscribers);
            console.log(`   📊 Total unique subscribers: ${allSubscribers.length}`);

            if (allSubscribers.length === 0) {
                console.log('   ⚠️  No subscribers found for emergency alerts');
                return { messageId: 'no-subscribers', subscriberCount: 0 };
            }

            // Send notifications to all subscribers
            const results = await this.sendNotificationsToSubscribers(allSubscribers, {
                type: 'emergency_alert',
                alertId: alert.id,
                location: alert.location,
                severity: alert.severity,
                eventCount: alert.eventCount,
                timestamp: alert.timestamp,
                subject: `🚨 EMERGENCY: ${alert.location}`,
                message: this.formatEmergencyMessage(alert),
                attributes: {
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

            // Update subscriber notification timestamps
            await this.updateSubscriberTimestamps(allSubscribers, 'emergency_alert');

            // Mark this alert as sent to prevent duplicates
            await this.markNotificationSent(alert.id, 'emergency', results.successful);

            console.log(`   🚨 Emergency alert sent to ${results.successful} subscribers`);
            return results;

        } catch (error) {
            console.error('❌ Error sending emergency alert to subscribers:', error.message);
            throw error;
        }
    }

    // Send notifications to a list of subscribers
    async sendNotificationsToSubscribers(subscribers, notificationData) {
        try {
            const results = {
                successful: 0,
                failed: 0,
                details: []
            };

            for (const subscriber of subscribers) {
                try {
                    let endpoint = null;
                    let protocol = null;

                    // Determine endpoint and protocol based on subscriber type
                    if (subscriber.type === 'email' && subscriber.email) {
                        endpoint = subscriber.email;
                        protocol = 'email';
                    } else if (subscriber.type === 'sms' && subscriber.phone) {
                        endpoint = subscriber.phone;
                        protocol = 'sms';
                    } else if (subscriber.type === 'both') {
                        // Send to both email and SMS if available
                        if (subscriber.email) {
                            await this.sendDirectNotification(subscriber.email, 'email', notificationData);
                            results.successful++;
                            results.details.push({
                                subscriberId: subscriber.id,
                                endpoint: subscriber.email,
                                protocol: 'email',
                                status: 'success'
                            });
                        }
                        if (subscriber.phone) {
                            await this.sendDirectNotification(subscriber.phone, 'sms', notificationData);
                            results.successful++;
                            results.details.push({
                                subscriberId: subscriber.id,
                                endpoint: subscriber.phone,
                                protocol: 'sms',
                                status: 'success'
                            });
                        }
                        continue;
                    }

                    if (!endpoint || !protocol) {
                        console.log(`   ⚠️  Skipping subscriber ${subscriber.id}: no valid endpoint`);
                        results.failed++;
                        results.details.push({
                            subscriberId: subscriber.id,
                            status: 'failed',
                            reason: 'No valid endpoint'
                        });
                        continue;
                    }

                    // Send notification
                    await this.sendDirectNotification(endpoint, protocol, notificationData);
                    results.successful++;
                    results.details.push({
                        subscriberId: subscriber.id,
                        endpoint: endpoint,
                        protocol: protocol,
                        status: 'success'
                    });

                    // Add small delay to avoid overwhelming SNS
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`   ❌ Failed to send notification to subscriber ${subscriber.id}:`, error.message);
                    results.failed++;
                    results.details.push({
                        subscriberId: subscriber.id,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('❌ Error in sendNotificationsToSubscribers:', error.message);
            throw error;
        }
    }

    // Send direct notification to a single endpoint
    async sendDirectNotification(endpoint, protocol, notificationData) {
        try {
            if (protocol === 'email') {
                // Use AWS SES to send real emails
                await this.sendEmailNotification(endpoint, notificationData);

            } else if (protocol === 'sms') {
                // Use AWS SNS to send real SMS
                await this.sendSMSNotification(endpoint, notificationData);
            }

        } catch (error) {
            console.error(`❌ Error sending direct notification to ${endpoint}:`, error.message);
            throw error;
        }
    }

    // Send real email using AWS SES
    async sendEmailNotification(emailAddress, notificationData) {
        try {
            console.log(`   📧 Sending email to: ${emailAddress}`);

            // Determine sender email (you should set this in your environment)
            const senderEmail = process.env.SES_SENDER_EMAIL || 'noreply@yourdomain.com';

            const command = new SendEmailCommand({
                Source: senderEmail,
                Destination: {
                    ToAddresses: [emailAddress]
                },
                Message: {
                    Subject: {
                        Data: notificationData.subject,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Text: {
                            Data: notificationData.message,
                            Charset: 'UTF-8'
                        },
                        Html: {
                            Data: this.formatEmailHTML(notificationData),
                            Charset: 'UTF-8'
                        }
                    }
                },
                Tags: [
                    {
                        Name: 'NotificationType',
                        Value: notificationData.type || 'disaster_alert'
                    },
                    {
                        Name: 'System',
                        Value: 'disaster-detection'
                    }
                ]
            });

            const response = await this.ses.send(command);
            console.log(`   ✅ Email sent successfully to ${emailAddress} (MessageId: ${response.MessageId})`);

            return response;

        } catch (error) {
            console.error(`   ❌ Failed to send email to ${emailAddress}:`, error.message);

            // Handle common SES errors
            if (error.name === 'MessageRejected') {
                console.error(`   📧 Email address may be invalid or not verified: ${emailAddress}`);
            } else if (error.name === 'MailFromDomainNotVerifiedException') {
                console.error(`   📧 Sender domain not verified. Set SES_SENDER_EMAIL environment variable to a verified email.`);
            } else if (error.name === 'ConfigurationSetDoesNotExistException') {
                console.error(`   📧 SES configuration issue. Check your AWS SES setup.`);
            }

            throw error;
        }
    }

    // Send real SMS using AWS SNS
    async sendSMSNotification(phoneNumber, notificationData) {
        try {
            console.log(`   📱 Sending SMS to: ${phoneNumber}`);

            // Create a temporary SNS topic for SMS delivery
            const tempTopicName = `temp-sms-${Date.now()}`;

            // For SMS, we'll use SNS directly with the phone number
            // Note: In production, you might want to create a dedicated SMS topic
            const command = new PublishCommand({
                PhoneNumber: phoneNumber,
                Message: notificationData.message,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: 'Transactional'
                    },
                    'AWS.SNS.SMS.SenderID': {
                        DataType: 'String',
                        StringValue: 'DISASTER'
                    }
                }
            });

            const response = await this.sns.send(command);
            console.log(`   ✅ SMS sent successfully to ${phoneNumber} (MessageId: ${response.MessageId})`);

            return response;

        } catch (error) {
            console.error(`   ❌ Failed to send SMS to ${phoneNumber}:`, error.message);

            // Handle common SNS errors
            if (error.name === 'InvalidParameter') {
                console.error(`   📱 Phone number format may be invalid: ${phoneNumber}`);
                console.error(`   📱 Use international format like +1234567890`);
            } else if (error.name === 'OptedOut') {
                console.error(`   📱 Phone number has opted out of SMS: ${phoneNumber}`);
            } else if (error.name === 'Throttled') {
                console.error(`   📱 SMS sending rate exceeded. Please wait before retrying.`);
            }

            throw error;
        }
    }

    // Format notification data as HTML email
    formatEmailHTML(notificationData) {
        const severity = this.getSeverityLevel(notificationData.severity || 0.5);
        const severityColor = {
            'CRITICAL': '#dc3545',
            'HIGH': '#fd7e14',
            'MEDIUM': '#ffc107',
            'LOW': '#28a745',
            'MINIMAL': '#6c757d'
        }[severity] || '#6c757d';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: ${severityColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-box { border-left: 4px solid ${severityColor}; padding: 15px; background-color: #f8f9fa; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .severity { display: inline-block; padding: 5px 10px; background-color: ${severityColor}; color: white; border-radius: 3px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 Disaster Alert System</h1>
    </div>
    
    <div class="content">
        <h2>${notificationData.subject}</h2>
        
        <div class="alert-box">
            <p><strong>Severity:</strong> <span class="severity">${severity}</span></p>
            ${notificationData.location ? `<p><strong>Location:</strong> ${notificationData.location}</p>` : ''}
            ${notificationData.timestamp ? `<p><strong>Time:</strong> ${new Date(notificationData.timestamp).toLocaleString()}</p>` : ''}
        </div>
        
        <div style="white-space: pre-line;">${notificationData.message}</div>
        
        <hr style="margin: 20px 0;">
        
        <p><strong>⚠️ Important:</strong> This is an automated alert from the Disaster Detection System. Please verify information with official sources before taking action.</p>
        
        <p><strong>📱 Emergency Contacts:</strong></p>
        <ul>
            <li>999 - Emergency Services</li>
            <li>03-12345678 - Local Emergency</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>This message was sent by the AWS Disaster Detection System</p>
        <p>To unsubscribe or update preferences, contact your system administrator</p>
    </div>
</body>
</html>`;
    }

    // Merge subscriber lists and remove duplicates
    mergeSubscribers(subscribers1, subscribers2) {
        const merged = [...subscribers1];
        const existingIds = new Set(subscribers1.map(s => s.id));

        for (const subscriber of subscribers2) {
            if (!existingIds.has(subscriber.id)) {
                merged.push(subscriber);
                existingIds.add(subscriber.id);
            }
        }

        return merged;
    }

    // Update subscriber notification timestamps
    async updateSubscriberTimestamps(subscribers, notificationType) {
        try {
            const promises = subscribers.map(subscriber =>
                this.storage.updateSubscriberLastNotified(subscriber.id, notificationType)
            );

            await Promise.allSettled(promises);
            console.log(`   ✅ Updated notification timestamps for ${subscribers.length} subscribers`);

        } catch (error) {
            console.error('❌ Error updating subscriber timestamps:', error.message);
        }
    }

    // Check if a notification has already been sent to prevent duplicates
    async checkNotificationSent(alertId, notificationType) {
        try {
            const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
            const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

            const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

            const command = new QueryCommand({
                TableName: 'disaster-notifications-sent',
                KeyConditionExpression: 'alertId = :alertId AND notificationType = :type',
                ExpressionAttributeValues: marshall({
                    ':alertId': alertId,
                    ':type': notificationType
                })
            });

            const response = await client.send(command);
            return (response.Items && response.Items.length > 0);
        } catch (error) {
            // If table doesn't exist, assume not sent (fail open)
            if (error.name === 'ResourceNotFoundException') {
                console.log(`   ℹ️  Notification tracking table doesn't exist - allowing notification`);
                return false;
            }
            console.error('   ⚠️  Error checking notification sent status:', error.message);
            return false; // Fail open - allow notification if we can't check
        }
    }

    // Mark a notification as sent to prevent duplicates
    async markNotificationSent(alertId, notificationType, subscriberCount) {
        try {
            const { DynamoDBClient, PutCommand } = require('@aws-sdk/client-dynamodb');
            const { marshall } = require('@aws-sdk/util-dynamodb');

            const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

            const item = {
                alertId: alertId,
                notificationType: notificationType,
                timestamp: new Date().toISOString(),
                subscriberCount: subscriberCount,
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
            };

            const command = new PutCommand({
                TableName: 'disaster-notifications-sent',
                Item: marshall(item)
            });

            await client.send(command);
            console.log(`   ✅ Marked ${notificationType} notification ${alertId} as sent`);
        } catch (error) {
            // If table doesn't exist, just log and continue (fail gracefully)
            if (error.name === 'ResourceNotFoundException') {
                console.log(`   ℹ️  Notification tracking table doesn't exist - skipping tracking`);
                return;
            }
            console.error('   ⚠️  Failed to mark notification as sent:', error.message);
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

    // Test notification system with sample subscribers
    async testNotificationsWithSubscribers() {
        try {
            console.log('🧪 Testing Enhanced SNS notification system with subscribers...');

            // Create test subscribers with REAL email addresses and phone numbers
            // IMPORTANT: Replace these with your actual test email/phone numbers
            const testSubscribers = [
                {
                    email: process.env.TEST_EMAIL_1 || 'limtzeyou@gmail.com',
                    type: 'email',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: false
                    },
                    location: 'Kuala Lumpur'
                },
                {
                    phone: process.env.TEST_PHONE_1 || '+60168396802',
                    type: 'sms',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: false,
                        systemStatus: false
                    },
                    location: 'Global'
                },
                {
                    email: process.env.TEST_EMAIL_2 || 'your-test-email2@example.com',
                    phone: process.env.TEST_PHONE_2 || '+60198765432',
                    type: 'both',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: true
                    },
                    location: 'Kuala Lumpur'
                }
            ];

            // Store test subscribers
            console.log('📝 Creating test subscribers...');
            for (const subscriber of testSubscribers) {
                await this.storage.storeSubscriber(subscriber);
            }

            // Test disaster alert
            const testAlert = {
                id: 'test_alert_123',
                location: 'Kuala Lumpur',
                severity: 0.7,
                eventCount: 3,
                timestamp: new Date(),
                verified: false
            };

            // Test emergency alert
            const testEmergencyAlert = {
                id: 'test_emergency_123',
                location: 'Kuala Lumpur',
                severity: 0.9,
                eventCount: 1,
                timestamp: new Date(),
                events: [testAlert]
            };

            // Test verification notification
            const testEvent = {
                id: 'test_event_123',
                location: 'Kuala Lumpur',
                type: 'earthquake',
                severity: 0.8
            };

            const testVerification = {
                source: 'Malaysian Meteorological Department',
                type: 'official_alert',
                confidence: 0.95,
                timestamp: new Date()
            };

            // Test system status
            const testStatus = {
                statistics: {
                    rawPosts: 100,
                    analyzedPosts: 85,
                    events: 15,
                    alerts: 3,
                    verifications: 8,
                    lastUpdated: new Date().toISOString()
                },
                health: 'HEALTHY'
            };

            // Send test notifications
            console.log('📢 Sending test notifications...');
            await this.sendDisasterAlert(testAlert);
            await this.sendEmergencyAlert(testEmergencyAlert);
            await this.sendVerificationNotification(testEvent, testVerification);
            await this.sendSystemStatus(testStatus);

            console.log('✅ All Enhanced SNS notification tests completed successfully');
            return true;

        } catch (error) {
            console.error('❌ Error testing Enhanced SNS notifications:', error.message);
            return false;
        }
    }
}

module.exports = EnhancedSNSNotifications;
