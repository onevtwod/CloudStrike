#!/usr/bin/env node

/**
 * Webhook Receiver for Social Media Integration
 * 
 * This script creates a simple webhook receiver that can be used to:
 * 1. Receive webhooks from Twitter, Facebook, Instagram, etc.
 * 2. Forward posts to the disaster alert system
 * 3. Provide a simple API for manual testing
 * 
 * Usage:
 *   node scripts/webhook-receiver.js
 * 
 * Environment Variables:
 *   - API_BASE_URL: Your deployed API Gateway URL
 *   - PORT: Server port (default: 3000)
 *   - TWITTER_WEBHOOK_SECRET: Secret for Twitter webhook verification
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-id.execute-api.us-east-1.amazonaws.com';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        apiBaseUrl: API_BASE_URL
    });
});

// Manual ingestion endpoint
app.post('/api/ingest', async (req, res) => {
    try {
        const { text, source = 'manual', author, location } = req.body;

        if (!text) {
            return res.status(400).json({
                error: 'Text is required'
            });
        }

        // Forward to disaster alert system
        const response = await axios.post(
            `${API_BASE_URL}/ingest/twitter`,
            {
                text,
                source,
                author,
                location,
                timestamp: new Date().toISOString()
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Ingestion error:', error.message);
        res.status(500).json({
            error: 'Failed to process request',
            message: error.response?.data?.message || error.message
        });
    }
});

// Twitter webhook endpoint
app.post('/webhook/twitter', async (req, res) => {
    try {
        // Verify Twitter webhook signature
        const signature = req.headers['x-twitter-webhooks-signature'];
        const webhookSecret = process.env.TWITTER_WEBHOOK_SECRET;

        if (webhookSecret && !verifyTwitterSignature(req.body, signature, webhookSecret)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('Received Twitter webhook:', JSON.stringify(req.body, null, 2));

        // Process tweet events
        const tweetEvents = req.body.tweet_create_events || [];
        const results = [];

        for (const tweet of tweetEvents) {
            try {
                // Extract location if available
                const location = extractLocationFromTweet(tweet);

                // Check if tweet contains disaster-related keywords
                if (containsDisasterKeywords(tweet.text)) {
                    const response = await axios.post(
                        `${API_BASE_URL}/ingest/twitter`,
                        {
                            text: tweet.text,
                            source: 'twitter',
                            author: `@${tweet.user.screen_name}`,
                            location,
                            timestamp: tweet.created_at
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000
                        }
                    );

                    results.push({
                        tweetId: tweet.id_str,
                        processed: true,
                        result: response.data
                    });

                    console.log(`Processed tweet ${tweet.id_str}:`, response.data);
                } else {
                    results.push({
                        tweetId: tweet.id_str,
                        processed: false,
                        reason: 'No disaster keywords found'
                    });
                }
            } catch (error) {
                console.error(`Error processing tweet ${tweet.id_str}:`, error.message);
                results.push({
                    tweetId: tweet.id_str,
                    processed: false,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message
        });
    }
});

// Facebook webhook endpoint (for future use)
app.post('/webhook/facebook', async (req, res) => {
    try {
        console.log('Received Facebook webhook:', JSON.stringify(req.body, null, 2));

        // TODO: Implement Facebook webhook processing
        res.json({
            success: true,
            message: 'Facebook webhook received (not implemented yet)'
        });
    } catch (error) {
        console.error('Facebook webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Instagram webhook endpoint (for future use)
app.post('/webhook/instagram', async (req, res) => {
    try {
        console.log('Received Instagram webhook:', JSON.stringify(req.body, null, 2));

        // TODO: Implement Instagram webhook processing
        res.json({
            success: true,
            message: 'Instagram webhook received (not implemented yet)'
        });
    } catch (error) {
        console.error('Instagram webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Simple dashboard endpoint
app.get('/dashboard', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Disaster Alert System - Webhook Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Disaster Alert System - Webhook Dashboard</h1>
            
            <h2>Manual Post Ingestion</h2>
            <form id="ingestForm">
                <div class="form-group">
                    <label for="text">Post Text:</label>
                    <textarea id="text" name="text" rows="4" placeholder="Describe the disaster or emergency situation..."></textarea>
                </div>
                
                <div class="form-group">
                    <label for="source">Source:</label>
                    <select id="source" name="source">
                        <option value="manual">Manual</option>
                        <option value="twitter">Twitter</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="mobile_app">Mobile App</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="author">Author (optional):</label>
                    <input type="text" id="author" name="author" placeholder="@username or name">
                </div>
                
                <div class="form-group">
                    <label for="lat">Latitude (optional):</label>
                    <input type="number" id="lat" name="lat" step="any" placeholder="3.1390">
                </div>
                
                <div class="form-group">
                    <label for="lng">Longitude (optional):</label>
                    <input type="number" id="lng" name="lng" step="any" placeholder="101.6869">
                </div>
                
                <button type="submit">Submit Post</button>
            </form>
            
            <div id="result"></div>
            
            <h2>API Endpoints</h2>
            <ul>
                <li><strong>Health Check:</strong> GET /health</li>
                <li><strong>Manual Ingestion:</strong> POST /api/ingest</li>
                <li><strong>Twitter Webhook:</strong> POST /webhook/twitter</li>
                <li><strong>Facebook Webhook:</strong> POST /webhook/facebook</li>
                <li><strong>Instagram Webhook:</strong> POST /webhook/instagram</li>
            </ul>
        </div>

        <script>
            document.getElementById('ingestForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {
                    text: formData.get('text'),
                    source: formData.get('source'),
                    author: formData.get('author') || undefined,
                    location: undefined
                };
                
                if (formData.get('lat') && formData.get('lng')) {
                    data.location = {
                        lat: parseFloat(formData.get('lat')),
                        lng: parseFloat(formData.get('lng'))
                    };
                }
                
                try {
                    const response = await fetch('/api/ingest', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await response.json();
                    const resultDiv = document.getElementById('result');
                    
                    if (response.ok) {
                        resultDiv.className = 'result success';
                        resultDiv.innerHTML = \`
                            <h3>Success!</h3>
                            <p><strong>Event ID:</strong> \${result.data.id}</p>
                            <p><strong>Verified:</strong> \${result.data.verified ? 'Yes' : 'No'}</p>
                            <p><strong>Severity:</strong> \${result.data.severity}</p>
                            <p><strong>Location:</strong> \${result.data.location || 'Not specified'}</p>
                            <p><strong>Event Type:</strong> \${result.data.eventType}</p>
                            <p><strong>Message:</strong> \${result.data.message}</p>
                        \`;
                    } else {
                        resultDiv.className = 'result error';
                        resultDiv.innerHTML = \`
                            <h3>Error</h3>
                            <p>\${result.error || 'Unknown error occurred'}</p>
                        \`;
                    }
                } catch (error) {
                    const resultDiv = document.getElementById('result');
                    resultDiv.className = 'result error';
                    resultDiv.innerHTML = \`
                        <h3>Network Error</h3>
                        <p>\${error.message}</p>
                    \`;
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Helper functions
function verifyTwitterSignature(body, signature, secret) {
    if (!signature || !secret) return false;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body), 'utf8')
        .digest('base64');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

function extractLocationFromTweet(tweet) {
    // Try to extract location from tweet coordinates or place
    if (tweet.coordinates && tweet.coordinates.coordinates) {
        const [lng, lat] = tweet.coordinates.coordinates;
        return { lat, lng };
    }

    if (tweet.place && tweet.place.bounding_box) {
        // Use center of bounding box
        const box = tweet.place.bounding_box.coordinates[0];
        const lng = (box[0][0] + box[2][0]) / 2;
        const lat = (box[0][1] + box[2][1]) / 2;
        return { lat, lng };
    }

    return undefined;
}

function containsDisasterKeywords(text) {
    const keywords = [
        'flood', 'banjir', 'storm', 'ribut', 'earthquake', 'gempa',
        'disaster', 'bencana', 'emergency', 'kecemasan', 'fire', 'kebakaran',
        'landslide', 'tanah runtuh', 'drought', 'kemarau', 'tsunami',
        'hurricane', 'tornado', 'cyclone', 'typhoon', 'blizzard'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Webhook receiver running on port ${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}/dashboard`);
    console.log(`🔗 API Base URL: ${API_BASE_URL}`);
    console.log(`\n📡 Webhook endpoints:`);
    console.log(`   - Twitter: http://localhost:${PORT}/webhook/twitter`);
    console.log(`   - Facebook: http://localhost:${PORT}/webhook/facebook`);
    console.log(`   - Instagram: http://localhost:${PORT}/webhook/instagram`);
    console.log(`\n🛠️  Manual API: http://localhost:${PORT}/api/ingest`);
    console.log(`\n💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
