#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ComprehensiveDisasterSystem = require('./main');

class DisasterAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.disasterSystem = new ComprehensiveDisasterSystem();

        this.setupMiddleware();
        this.setupRoutes();
        this.startDisasterSystem();
    }

    setupMiddleware() {
        // CORS for web frontend
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.'
        });
        this.app.use('/api/', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                system: 'disaster-detection-api'
            });
        });

        // Get all disaster events
        this.app.get('/events', async (req, res) => {
            try {
                const events = await this.getDisasterEvents();
                res.json(events);
            } catch (error) {
                console.error('Error fetching events:', error);
                res.status(500).json({
                    error: 'Failed to fetch events',
                    message: error.message
                });
            }
        });

        // Get recent events (last 24 hours)
        this.app.get('/events/recent', async (req, res) => {
            try {
                const recentEvents = await this.getRecentEvents();
                res.json(recentEvents);
            } catch (error) {
                console.error('Error fetching recent events:', error);
                res.status(500).json({
                    error: 'Failed to fetch recent events',
                    message: error.message
                });
            }
        });

        // Get events by location
        this.app.get('/events/location/:location', async (req, res) => {
            try {
                const { location } = req.params;
                const events = await this.getEventsByLocation(location);
                res.json(events);
            } catch (error) {
                console.error('Error fetching events by location:', error);
                res.status(500).json({
                    error: 'Failed to fetch events by location',
                    message: error.message
                });
            }
        });

        // Subscribe to alerts
        this.app.post('/subscribe', async (req, res) => {
            try {
                const { kind, value } = req.body;

                if (!kind || !value) {
                    return res.status(400).json({
                        error: 'Missing required fields: kind and value'
                    });
                }

                if (!['email', 'sms'].includes(kind)) {
                    return res.status(400).json({
                        error: 'Invalid subscription kind. Must be "email" or "sms"'
                    });
                }

                const result = await this.subscribeToAlerts(kind, value);
                res.json(result);
            } catch (error) {
                console.error('Error subscribing to alerts:', error);
                res.status(500).json({
                    error: 'Failed to subscribe to alerts',
                    message: error.message
                });
            }
        });

        // Get system statistics
        this.app.get('/stats', async (req, res) => {
            try {
                const stats = await this.disasterSystem.getSystemStatus();
                res.json(stats);
            } catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).json({
                    error: 'Failed to fetch statistics',
                    message: error.message
                });
            }
        });

        // Manual event ingestion endpoint
        this.app.post('/ingest/twitter', async (req, res) => {
            try {
                const { text, author, location } = req.body;

                if (!text) {
                    return res.status(400).json({
                        error: 'Missing required field: text'
                    });
                }

                const mockPost = {
                    id: `manual_${Date.now()}`,
                    text: text,
                    author: author || 'manual_input',
                    source: 'manual',
                    timestamp: new Date(),
                    location: location || null,
                    images: []
                };

                await this.disasterSystem.processPost(mockPost);
                res.json({
                    message: 'Post processed successfully',
                    id: mockPost.id,
                    verified: 0.5 // Manual posts have medium verification
                });
            } catch (error) {
                console.error('Error processing manual post:', error);
                res.status(500).json({
                    error: 'Failed to process post',
                    message: error.message
                });
            }
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl
            });
        });
    }

    async getDisasterEvents() {
        try {
            // Get events from DynamoDB storage
            const events = await this.disasterSystem.storage.getRecentEvents(24, 100);

            // Format events for frontend
            return events.map(event => ({
                id: event.id,
                text: event.text || event.description || 'Disaster event detected',
                location: event.location || 'Unknown location',
                eventType: event.eventType || 'disaster',
                createdAt: event.timestamp || event.createdAt,
                severity: event.severity || 0.5,
                confidence: event.confidence || 0.8,
                verified: event.verified || false
            }));
        } catch (error) {
            console.error('Error getting disaster events:', error);
            return [];
        }
    }

    async getRecentEvents() {
        try {
            const events = await this.getDisasterEvents();
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            return events.filter(event =>
                new Date(event.createdAt) > oneDayAgo
            );
        } catch (error) {
            console.error('Error getting recent events:', error);
            return [];
        }
    }

    async getEventsByLocation(location) {
        try {
            const events = await this.getDisasterEvents();

            return events.filter(event =>
                event.location &&
                event.location.toLowerCase().includes(location.toLowerCase())
            );
        } catch (error) {
            console.error('Error getting events by location:', error);
            return [];
        }
    }

    async subscribeToAlerts(kind, value) {
        try {
            // Store subscription in DynamoDB
            const subscription = {
                id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                kind: kind,
                value: value,
                timestamp: new Date().toISOString(),
                active: true
            };

            await this.disasterSystem.storage.storeAlert({
                ...subscription,
                type: 'subscription'
            });

            return {
                message: `Subscription requested for ${kind}: ${value}. You will receive alerts for verified disaster events.`,
                subscriptionId: subscription.id
            };
        } catch (error) {
            console.error('Error storing subscription:', error);
            throw error;
        }
    }

    async startDisasterSystem() {
        try {
            console.log('🚀 Starting disaster detection system...');
            // Don't await this as it runs indefinitely
            this.disasterSystem.start().catch(error => {
                console.error('❌ Error starting disaster system:', error);
            });
        } catch (error) {
            console.error('❌ Failed to start disaster system:', error);
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🌐 Disaster Detection API Server running on port ${this.port}`);
            console.log(`📡 Health check: http://localhost:${this.port}/health`);
            console.log(`📊 Events endpoint: http://localhost:${this.port}/events`);
            console.log(`📈 Stats endpoint: http://localhost:${this.port}/stats`);
            console.log(`🔔 Subscribe endpoint: http://localhost:${this.port}/subscribe`);
        });
    }
}

// Start the server
if (require.main === module) {
    const server = new DisasterAPIServer();
    server.start();
}

module.exports = DisasterAPIServer;
