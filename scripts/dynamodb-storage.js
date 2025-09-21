#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDBStorage {
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
        // which includes: environment variables, AWS credentials file, IAM roles, etc.

        this.client = new DynamoDBClient(config);

        this.docClient = DynamoDBDocumentClient.from(this.client);

        this.tables = {
            rawPosts: 'disaster-raw-posts',
            analyzedPosts: 'disaster-analyzed-posts',
            events: 'disaster-events',
            alerts: 'disaster-alerts',
            verifications: 'disaster-verifications',
            subscribers: 'disaster-subscribers'
        };

        console.log('🗄️  DynamoDB Storage initialized');
    }

    // Store raw social media posts
    async storeRawPost(post) {
        try {
            const item = {
                id: post.id || `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: post.text,
                author: post.author,
                source: post.source,
                timestamp: post.timestamp.toISOString(),
                location: post.location || 'unknown', // Cannot be null for location-timestamp-index
                images: post.images || [],
                url: post.url || null,
                rawData: post.rawData || {},
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
            };

            const command = new PutCommand({
                TableName: this.tables.rawPosts,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Raw post stored: ${item.id}`);
            return item;

        } catch (error) {
            console.error('❌ Error storing raw post:', error.message);
            throw error;
        }
    }

    // Store analyzed posts with Comprehend results
    async storeAnalyzedPost(analyzedPost) {
        try {
            const item = {
                id: analyzedPost.id || `analyzed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                rawPostId: analyzedPost.rawPostId || null,
                text: analyzedPost.text,
                author: analyzedPost.author,
                source: analyzedPost.source,
                timestamp: analyzedPost.timestamp.toISOString(),
                location: analyzedPost.location || 'unknown', // Cannot be null for location-timestamp-index
                images: analyzedPost.images || [],
                imageLocation: analyzedPost.imageLocation || null,
                severity: analyzedPost.severity,
                confidence: analyzedPost.confidence,
                isDisasterRelated: analyzedPost.isDisasterRelated ? 'true' : 'false', // Convert boolean to string for disaster-timestamp-index
                entities: analyzedPost.entities || [],
                sentiment: analyzedPost.sentiment || {},
                keyPhrases: analyzedPost.keyPhrases || [],
                language: analyzedPost.language || 'en',
                analyzedAt: analyzedPost.analyzedAt.toISOString(),
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
            };

            const command = new PutCommand({
                TableName: this.tables.analyzedPosts,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Analyzed post stored: ${item.id}`);
            return item;

        } catch (error) {
            console.error('❌ Error storing analyzed post:', error.message);
            throw error;
        }
    }

    // Store disaster events
    async storeEvent(event) {
        try {
            const item = {
                id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: event.type || 'disaster',
                location: event.location || 'unknown',
                severity: event.severity,
                confidence: event.confidence,
                description: event.description || event.text,
                source: event.source,
                author: event.author,
                timestamp: event.timestamp.toISOString(),
                images: event.images || [],
                entities: event.entities || [],
                sentiment: event.sentiment || {},
                keyPhrases: event.keyPhrases || [],
                verified: event.verified || false,
                verificationSource: event.verificationSource || null,
                verificationTimestamp: event.verificationTimestamp || null,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
            };

            const command = new PutCommand({
                TableName: this.tables.events,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Event stored: ${item.id}`);
            return item;

        } catch (error) {
            console.error('❌ Error storing event:', error.message);
            throw error;
        }
    }

    // Store disaster alerts
    async storeAlert(alert) {
        try {
            const item = {
                id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                location: alert.location,
                severity: alert.severity,
                eventCount: alert.eventCount || alert.events?.length || 0,
                events: alert.events || [],
                timestamp: alert.timestamp.toISOString(),
                verified: alert.verified || false,
                verificationSource: alert.verificationSource || null,
                verificationTimestamp: alert.verificationTimestamp || null,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60) // 6 months TTL
            };

            const command = new PutCommand({
                TableName: this.tables.alerts,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Alert stored: ${item.id}`);
            return item;

        } catch (error) {
            console.error('❌ Error storing alert:', error.message);
            throw error;
        }
    }

    // Store verification records
    async storeVerification(verification) {
        try {
            const item = {
                id: verification.id || `verification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                eventId: verification.eventId || null,
                alertId: verification.alertId || null,
                source: verification.source,
                type: verification.type,
                location: verification.location,
                text: verification.text,
                confidence: verification.confidence,
                timestamp: verification.timestamp.toISOString(),
                url: verification.url || null,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
            };

            const command = new PutCommand({
                TableName: this.tables.verifications,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Verification stored: ${item.id}`);
            return item;

        } catch (error) {
            console.error('❌ Error storing verification:', error.message);
            throw error;
        }
    }

    // Query events by location
    async getEventsByLocation(location, limit = 50) {
        try {
            const command = new QueryCommand({
                TableName: this.tables.events,
                IndexName: 'location-timestamp-index', // Assuming GSI exists
                KeyConditionExpression: 'location = :location',
                ExpressionAttributeValues: {
                    ':location': location
                },
                ScanIndexForward: false, // Most recent first
                Limit: limit
            });

            const response = await this.docClient.send(command);
            return response.Items || [];

        } catch (error) {
            console.error('❌ Error querying events by location:', error.message);
            return [];
        }
    }

    // Query recent events
    async getRecentEvents(hours = 24, limit = 100) {
        try {
            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

            const command = new ScanCommand({
                TableName: this.tables.events,
                FilterExpression: '#ts > :cutoff',
                ExpressionAttributeNames: {
                    '#ts': 'timestamp'
                },
                ExpressionAttributeValues: {
                    ':cutoff': cutoffTime
                },
                Limit: limit
            });

            const response = await this.docClient.send(command);
            return response.Items || [];

        } catch (error) {
            console.error('❌ Error querying recent events:', error.message);
            return [];
        }
    }

    // Query alerts by location
    async getAlertsByLocation(location, limit = 20) {
        try {
            const command = new QueryCommand({
                TableName: this.tables.alerts,
                IndexName: 'location-timestamp-index', // Assuming GSI exists
                KeyConditionExpression: 'location = :location',
                ExpressionAttributeValues: {
                    ':location': location
                },
                ScanIndexForward: false, // Most recent first
                Limit: limit
            });

            const response = await this.docClient.send(command);
            return response.Items || [];

        } catch (error) {
            console.error('❌ Error querying alerts by location:', error.message);
            return [];
        }
    }

    // Update event verification status
    async updateEventVerification(eventId, verification) {
        try {
            const command = new UpdateCommand({
                TableName: this.tables.events,
                Key: { id: eventId },
                UpdateExpression: 'SET verified = :verified, verificationSource = :source, verificationTimestamp = :timestamp',
                ExpressionAttributeValues: {
                    ':verified': true,
                    ':source': verification.source,
                    ':timestamp': verification.timestamp.toISOString()
                },
                ReturnValues: 'ALL_NEW'
            });

            const response = await this.docClient.send(command);
            console.log(`   ✅ Event ${eventId} verification updated`);
            return response.Attributes;

        } catch (error) {
            console.error('❌ Error updating event verification:', error.message);
            throw error;
        }
    }

    // Get statistics
    async getStatistics() {
        try {
            const [rawPosts, analyzedPosts, events, alerts, verifications] = await Promise.all([
                this.getTableCount(this.tables.rawPosts),
                this.getTableCount(this.tables.analyzedPosts),
                this.getTableCount(this.tables.events),
                this.getTableCount(this.tables.alerts),
                this.getTableCount(this.tables.verifications)
            ]);

            return {
                rawPosts,
                analyzedPosts,
                events,
                alerts,
                verifications,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting statistics:', error.message);
            return {
                rawPosts: 0,
                analyzedPosts: 0,
                events: 0,
                alerts: 0,
                verifications: 0,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    // Get table count (approximate)
    async getTableCount(tableName) {
        try {
            const command = new ScanCommand({
                TableName: tableName,
                Select: 'COUNT'
            });

            const response = await this.docClient.send(command);
            return response.Count || 0;

        } catch (error) {
            console.error(`❌ Error getting count for ${tableName}:`, error.message);
            return 0;
        }
    }

    // Batch store multiple items
    async batchStoreRawPosts(posts) {
        try {
            const promises = posts.map(post => this.storeRawPost(post));
            const results = await Promise.allSettled(promises);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`   📊 Batch store completed: ${successful} successful, ${failed} failed`);
            return results;

        } catch (error) {
            console.error('❌ Error in batch store:', error.message);
            throw error;
        }
    }

    // Batch store analyzed posts
    async batchStoreAnalyzedPosts(analyzedPosts) {
        try {
            const promises = analyzedPosts.map(post => this.storeAnalyzedPost(post));
            const results = await Promise.allSettled(promises);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`   📊 Batch store analyzed posts: ${successful} successful, ${failed} failed`);
            return results;

        } catch (error) {
            console.error('❌ Error in batch store analyzed posts:', error.message);
            throw error;
        }
    }

    // Store subscriber
    async storeSubscriber(subscriber) {
        try {
            // Check for existing subscriber with same email or phone
            const existingSubscriber = await this.findExistingSubscriber(subscriber.email, subscriber.phone);

            if (existingSubscriber) {
                // Update existing subscriber instead of creating duplicate
                console.log(`   🔄 Updating existing subscriber: ${existingSubscriber.id}`);
                return await this.updateSubscriber(existingSubscriber.id, subscriber);
            }

            const item = {
                id: subscriber.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                email: subscriber.email || null,
                phone: subscriber.phone || null,
                type: subscriber.type || 'email', // email, sms, both
                preferences: subscriber.preferences || {
                    disasterAlerts: true,
                    emergencyAlerts: true,
                    verifications: true,
                    systemStatus: false
                },
                location: subscriber.location || 'unknown', // Optional: location-specific alerts (use 'unknown' instead of null for GSI compatibility)
                active: subscriber.active !== false, // Default to true
                subscribedAt: subscriber.subscribedAt || new Date().toISOString(),
                lastNotified: null,
                createdAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
            };

            const command = new PutCommand({
                TableName: this.tables.subscribers,
                Item: item
            });

            await this.docClient.send(command);
            console.log(`   💾 Subscriber stored: ${item.id}`);
            return item;

        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                console.error(`❌ DynamoDB table '${this.tables.subscribers}' not found. Please run: node scripts/create-subscribers-table.js`);
                console.error('   This will create the required DynamoDB table for storing subscribers.');
            } else {
                console.error('❌ Error storing subscriber:', error.message);
            }
            throw error;
        }
    }

    // Find existing subscriber by email or phone
    async findExistingSubscriber(email, phone) {
        try {
            // Scan for existing subscribers with matching email or phone
            const scanParams = {
                TableName: this.tables.subscribers,
                FilterExpression: '#active = :active AND (#email = :email OR #phone = :phone)',
                ExpressionAttributeNames: {
                    '#active': 'active',
                    '#email': 'email',
                    '#phone': 'phone'
                },
                ExpressionAttributeValues: {
                    ':active': true,
                    ':email': email || null,
                    ':phone': phone || null
                }
            };

            const result = await this.docClient.send(new ScanCommand(scanParams));

            if (result.Items && result.Items.length > 0) {
                return result.Items[0]; // Return first match
            }

            return null;
        } catch (error) {
            console.error('❌ Error finding existing subscriber:', error.message);
            return null;
        }
    }

    // Update existing subscriber
    async updateSubscriber(subscriberId, newData) {
        try {
            const updateParams = {
                TableName: this.tables.subscribers,
                Key: { id: subscriberId },
                UpdateExpression: 'SET #type = :type, preferences = :preferences, #location = :location, active = :active, subscribedAt = :subscribedAt',
                ExpressionAttributeNames: {
                    '#type': 'type',
                    '#location': 'location'
                },
                ExpressionAttributeValues: {
                    ':type': newData.type || 'email',
                    ':preferences': newData.preferences || {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: false
                    },
                    ':location': newData.location || 'unknown',
                    ':active': newData.active !== false,
                    ':subscribedAt': new Date().toISOString()
                }
            };

            await this.docClient.send(new UpdateCommand(updateParams));
            console.log(`   ✅ Subscriber updated: ${subscriberId}`);

            // Return updated item
            return {
                id: subscriberId,
                ...newData,
                subscribedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error updating subscriber:', error.message);
            throw error;
        }
    }

    // Get all active subscribers
    async getActiveSubscribers(preference = null) {
        try {
            let filterExpression = 'active = :active';
            let expressionAttributeValues = { ':active': true };
            let expressionAttributeNames = {};

            // Add preference filter if specified
            if (preference) {
                filterExpression += ' AND preferences.#pref = :prefValue';
                expressionAttributeValues[':prefValue'] = true;
                expressionAttributeNames['#pref'] = preference;
            }

            const command = new ScanCommand({
                TableName: this.tables.subscribers,
                FilterExpression: filterExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
            });

            const response = await this.docClient.send(command);
            console.log(`   📊 Found ${response.Items?.length || 0} active subscribers`);
            return response.Items || [];

        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                console.error(`❌ DynamoDB table '${this.tables.subscribers}' not found. Please run: node scripts/create-subscribers-table.js`);
                console.error('   This will create the required DynamoDB table for storing subscribers.');
            } else {
                console.error('❌ Error getting active subscribers:', error.message);
            }
            return [];
        }
    }

    // Get subscribers by location
    async getSubscribersByLocation(location, preference = null) {
        try {
            let filterExpression = 'active = :active AND #loc = :location';
            let expressionAttributeValues = {
                ':active': true,
                ':location': location
            };
            let expressionAttributeNames = {
                '#loc': 'location' // Use alias for reserved keyword 'location'
            };

            // Add preference filter if specified
            if (preference) {
                filterExpression += ' AND preferences.#pref = :prefValue';
                expressionAttributeValues[':prefValue'] = true;
                expressionAttributeNames['#pref'] = preference;
            }

            const command = new ScanCommand({
                TableName: this.tables.subscribers,
                FilterExpression: filterExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames
            });

            const response = await this.docClient.send(command);
            console.log(`   📊 Found ${response.Items?.length || 0} subscribers for location: ${location}`);
            return response.Items || [];

        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                console.error(`❌ DynamoDB table '${this.tables.subscribers}' not found. Please run: node scripts/create-subscribers-table.js`);
                console.error('   This will create the required DynamoDB table for storing subscribers.');
            } else {
                console.error('❌ Error getting subscribers by location:', error.message);
            }
            return [];
        }
    }

    // Update subscriber notification timestamp
    async updateSubscriberLastNotified(subscriberId, notificationType) {
        try {
            const command = new UpdateCommand({
                TableName: this.tables.subscribers,
                Key: { id: subscriberId },
                UpdateExpression: 'SET lastNotified = :timestamp, lastNotificationType = :type',
                ExpressionAttributeValues: {
                    ':timestamp': new Date().toISOString(),
                    ':type': notificationType
                },
                ReturnValues: 'ALL_NEW'
            });

            const response = await this.docClient.send(command);
            console.log(`   ✅ Subscriber ${subscriberId} notification timestamp updated`);
            return response.Attributes;

        } catch (error) {
            console.error('❌ Error updating subscriber notification timestamp:', error.message);
            throw error;
        }
    }

    // Unsubscribe a subscriber
    async unsubscribeSubscriber(subscriberId) {
        try {
            const command = new UpdateCommand({
                TableName: this.tables.subscribers,
                Key: { id: subscriberId },
                UpdateExpression: 'SET active = :active, unsubscribedAt = :timestamp',
                ExpressionAttributeValues: {
                    ':active': false,
                    ':timestamp': new Date().toISOString()
                },
                ReturnValues: 'ALL_NEW'
            });

            const response = await this.docClient.send(command);
            console.log(`   ✅ Subscriber ${subscriberId} unsubscribed`);
            return response.Attributes;

        } catch (error) {
            console.error('❌ Error unsubscribing subscriber:', error.message);
            throw error;
        }
    }
}

module.exports = DynamoDBStorage;
