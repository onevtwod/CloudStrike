#!/usr/bin/env node

/**
 * Local Development Server for Disaster Alert System
 * 
 * This script creates a local server that simulates the AWS Lambda functions
 * for testing the social media ingestion system without deploying to AWS.
 * 
 * Usage:
 *   node scripts/local-dev-server.js
 * 
 * Environment Variables:
 *   - PORT: Server port (default: 3001)
 *   - MOCK_MALAYSIA_WEATHER: Set to 'true' to mock Malaysian weather API calls
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // More lenient for local development
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Mock Malaysian weather data
const mockMalaysiaWeatherData = {
  warnings: [
    {
      warning_issue: {
        issued: new Date().toISOString(),
        title_en: "Heavy Rain Warning",
        title_bm: "Amaran Hujan Lebat"
      },
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      heading_en: "Heavy Rain Warning",
      text_en: "Heavy rain expected in Kuala Lumpur area",
      instruction_en: "Avoid flood-prone areas",
      heading_bm: "Amaran Hujan Lebat",
      text_bm: "Hujan lebat dijangka di kawasan Kuala Lumpur",
      instruction_bm: "Elakkan kawasan yang mudah banjir"
    }
  ],
  forecasts: [
    {
      location: {
        location_id: "St001",
        location_name: "Kuala Lumpur"
      },
      date: new Date().toISOString().split('T')[0],
      morning_forecast: "Tiada hujan",
      afternoon_forecast: "Ribut petir di beberapa tempat",
      night_forecast: "Hujan di satu dua tempat",
      summary_forecast: "Ribut petir di beberapa tempat",
      summary_when: "Petang",
      min_temp: 24,
      max_temp: 32
    }
  ],
  earthquakes: [
    {
      utcdatetime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      localdatetime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lat: 3.1390,
      lon: 101.6869,
      depth: 10.0,
      location: "Kuala Lumpur",
      location_original: "Kuala Lumpur",
      magdefault: 4.5,
      magtypedefault: "mb",
      status: "NORMAL",
      visible: true,
      lat_vector: "3.1390° U",
      lon_vector: "101.6869° T"
    }
  ]
};

// Mock Malaysian weather API endpoints
app.get('/mock-api/weather/warning', (req, res) => {
  console.log('🌦️  Mock Malaysian Weather API - Warnings called');
  res.json(mockMalaysiaWeatherData.warnings);
});

app.get('/mock-api/weather/forecast', (req, res) => {
  console.log('🌦️  Mock Malaysian Weather API - Forecasts called');
  res.json(mockMalaysiaWeatherData.forecasts);
});

app.get('/mock-api/weather/warning/earthquake', (req, res) => {
  console.log('🌦️  Mock Malaysian Weather API - Earthquakes called');
  res.json(mockMalaysiaWeatherData.earthquakes);
});

// Mock Comprehend AI service
function mockComprehendEntities(text) {
  const entities = [];
  const lowerText = text.toLowerCase();
  
  // Extract locations
  const locationKeywords = [
    'kuala lumpur', 'kl', 'petaling jaya', 'pj', 'shah alam', 'penang', 'georgetown',
    'sabah', 'kota kinabalu', 'sarawak', 'kuching', 'johor', 'johor bahru',
    'melaka', 'malacca', 'negeri sembilan', 'selangor', 'perak', 'kedah',
    'kelantan', 'terengganu', 'pahang', 'cameron highlands'
  ];
  
  for (const location of locationKeywords) {
    if (lowerText.includes(location)) {
      entities.push({
        Type: 'LOCATION',
        Text: location,
        Score: 0.95,
        BeginOffset: lowerText.indexOf(location),
        EndOffset: lowerText.indexOf(location) + location.length
      });
      break; // Only take the first match
    }
  }
  
  // Extract event types
  const eventKeywords = {
    'flood': 'flood',
    'banjir': 'banjir',
    'storm': 'storm',
    'ribut': 'ribut',
    'earthquake': 'earthquake',
    'gempa': 'gempa',
    'fire': 'fire',
    'kebakaran': 'kebakaran',
    'landslide': 'landslide',
    'tanah runtuh': 'tanah runtuh',
    'emergency': 'emergency',
    'kecemasan': 'kecemasan',
    'disaster': 'disaster',
    'bencana': 'bencana'
  };
  
  for (const [keyword, eventType] of Object.entries(eventKeywords)) {
    if (lowerText.includes(keyword)) {
      entities.push({
        Type: 'EVENT',
        Text: eventType,
        Score: 0.90,
        BeginOffset: lowerText.indexOf(keyword),
        EndOffset: lowerText.indexOf(keyword) + keyword.length
      });
      break; // Only take the first match
    }
  }
  
  return entities;
}

// Mock meteorological signal calculation
function calculateMockSeverity(text, location) {
  let severity = 0.3; // Base severity
  
  const lowerText = text.toLowerCase();
  
  // Check for active warnings (simulate current weather conditions)
  const hasActiveWarning = mockMalaysiaWeatherData.warnings.some(warning => {
    const now = new Date();
    const validFrom = new Date(warning.valid_from);
    const validTo = new Date(warning.valid_to);
    return now >= validFrom && now <= validTo;
  });
  
  if (hasActiveWarning) {
    severity += 0.4; // Significant increase for active warnings
  }
  
  // Check for recent earthquakes
  const hasRecentEarthquake = mockMalaysiaWeatherData.earthquakes.some(eq => {
    const eqTime = new Date(eq.localdatetime);
    const hoursDiff = (new Date().getTime() - eqTime.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24 && eq.magdefault >= 4.0;
  });
  
  if (hasRecentEarthquake) {
    severity += 0.3; // Increase for recent significant earthquakes
  }
  
  // Check for storm conditions in forecasts
  const hasStormConditions = mockMalaysiaWeatherData.forecasts.some(forecast => {
    const forecastText = [
      forecast.morning_forecast,
      forecast.afternoon_forecast,
      forecast.night_forecast,
      forecast.summary_forecast
    ].join(' ').toLowerCase();
    
    const stormKeywords = ['ribut petir', 'ribut', 'hujan lebat', 'angin kencang'];
    return stormKeywords.some(keyword => forecastText.includes(keyword));
  });
  
  if (hasStormConditions) {
    severity += 0.2; // Moderate increase for storm conditions
  }
  
  return Math.min(1.0, severity);
}

// In-memory storage for events
const events = [];
let eventIdCounter = 1;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    mode: 'local-development',
    timestamp: new Date().toISOString(),
    eventsCount: events.length
  });
});

// Mock /ingest/twitter endpoint
app.post('/ingest/twitter', async (req, res) => {
  try {
    console.log('📨 Received ingestion request:', JSON.stringify(req.body, null, 2));
    
    const { text, source, author, timestamp, location } = req.body;
    
    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: ['Text is required and must be a string']
      });
    }
    
    if (text.trim().length === 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: ['Text cannot be empty']
      });
    }
    
    if (text.length > 1000) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: ['Text must be less than 1000 characters']
      });
    }
    
    // Mock Comprehend AI processing
    const entities = mockComprehendEntities(text);
    const detectedLocation = entities.find(e => e.Type === 'LOCATION')?.Text;
    const eventType = entities.find(e => e.Type === 'EVENT')?.Text || 'disaster';
    
    console.log('🤖 AI Processing Results:');
    console.log('  - Detected Location:', detectedLocation);
    console.log('  - Event Type:', eventType);
    console.log('  - Entities:', entities);
    
    // Mock meteorological signal calculation
    const severity = calculateMockSeverity(text, location);
    const verified = severity > 0.5 ? 1 : 0;
    
    console.log('🌦️  Weather Analysis:');
    console.log('  - Severity:', severity);
    console.log('  - Verified:', verified ? 'YES' : 'NO');
    
    // Create event record
    const event = {
      id: `local-${eventIdCounter++}`,
      text: text.trim(),
      location: detectedLocation,
      coordinates: location,
      eventType,
      verified,
      createdAt: timestamp || new Date().toISOString(),
      source: source || 'unknown',
      author: author || 'unknown',
      severity,
      meteoSource: 'local-mock'
    };
    
    // Store in memory
    events.push(event);
    
    console.log('💾 Event stored:', event.id);
    
    // Simulate SNS alert if verified
    if (verified) {
      console.log('🚨 ALERT: Verified disaster event detected!');
      console.log('  - Event ID:', event.id);
      console.log('  - Type:', eventType);
      console.log('  - Location:', detectedLocation);
      console.log('  - Severity:', severity);
    }
    
    // Return response
    res.status(202).json({
      id: event.id,
      verified,
      severity,
      source: 'local-mock',
      location: detectedLocation,
      eventType,
      message: verified ? 'Event verified and alert sent' : 'Event processed and stored'
    });
    
  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mock /events endpoint
app.get('/events', (req, res) => {
  console.log('📋 Events requested, returning', events.length, 'events');
  
  // Return only verified events
  const verifiedEvents = events.filter(e => e.verified === 1);
  
  res.json(verifiedEvents);
});

// Mock /subscribe endpoint
app.post('/subscribe', (req, res) => {
  const { kind, value } = req.body;
  
  if (!kind || !value) {
    return res.status(400).json({
      message: 'kind and value required'
    });
  }
  
  console.log('📧 Mock subscription:', kind, value);
  
  res.json({
    message: 'Subscription requested (mock)'
  });
});

// Dashboard endpoint
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Disaster Alert System - Local Development</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .status { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .form-container { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .events-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
            input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: #0056b3; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
            .event-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #f9f9f9; }
            .event-verified { border-left: 4px solid #28a745; }
            .event-unverified { border-left: 4px solid #ffc107; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚨 Disaster Alert System - Local Development</h1>
                <p>Testing environment for social media ingestion system</p>
            </div>
            
            <div class="status">
                <h2>📊 System Status</h2>
                <p><strong>Mode:</strong> Local Development (Mock APIs)</p>
                <p><strong>Events Processed:</strong> <span id="eventsCount">0</span></p>
                <p><strong>Verified Events:</strong> <span id="verifiedCount">0</span></p>
                <p><strong>Last Updated:</strong> <span id="lastUpdated">-</span></p>
            </div>
            
            <div class="grid">
                <div class="form-container">
                    <h2>📝 Test Social Media Ingestion</h2>
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
                        <button type="button" onclick="loadEvents()">Refresh Events</button>
                    </form>
                    
                    <div id="result"></div>
                </div>
                
                <div class="events-container">
                    <h2>📋 Verified Events</h2>
                    <div id="eventsList">
                        <p>No events yet. Submit a test post to see events here.</p>
                    </div>
                </div>
            </div>
            
            <div class="form-container">
                <h2>🔗 API Endpoints</h2>
                <ul>
                    <li><strong>Health Check:</strong> GET /health</li>
                    <li><strong>Ingest Post:</strong> POST /ingest/twitter</li>
                    <li><strong>Get Events:</strong> GET /events</li>
                    <li><strong>Subscribe:</strong> POST /subscribe</li>
                </ul>
                
                <h3>🧪 Test Examples</h3>
                <button onclick="testFlood()">Test Flood Report</button>
                <button onclick="testStorm()">Test Storm Report</button>
                <button onclick="testEarthquake()">Test Earthquake Report</button>
                <button onclick="testMalay()">Test Malay Language</button>
                <button onclick="testNonDisaster()">Test Non-Disaster Post</button>
            </div>
        </div>

        <script>
            let events = [];
            
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
                    const response = await fetch('/ingest/twitter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await response.json();
                    const resultDiv = document.getElementById('result');
                    
                    if (response.ok) {
                        resultDiv.className = 'result success';
                        resultDiv.innerHTML = \`
                            <h3>✅ Success!</h3>
                            <p><strong>Event ID:</strong> \${result.id}</p>
                            <p><strong>Verified:</strong> \${result.verified ? 'YES' : 'NO'}</p>
                            <p><strong>Severity:</strong> \${result.severity}</p>
                            <p><strong>Location:</strong> \${result.location || 'Not detected'}</p>
                            <p><strong>Event Type:</strong> \${result.eventType}</p>
                            <p><strong>Message:</strong> \${result.message}</p>
                        \`;
                        
                        // Refresh events and stats
                        setTimeout(() => {
                            loadEvents();
                            updateStats();
                        }, 500);
                    } else {
                        resultDiv.className = 'result error';
                        resultDiv.innerHTML = \`
                            <h3>❌ Error</h3>
                            <p>\${result.message || 'Unknown error occurred'}</p>
                        \`;
                    }
                } catch (error) {
                    const resultDiv = document.getElementById('result');
                    resultDiv.className = 'result error';
                    resultDiv.innerHTML = \`
                        <h3>🌐 Network Error</h3>
                        <p>\${error.message}</p>
                    \`;
                }
            });
            
            async function loadEvents() {
                try {
                    const response = await fetch('/events');
                    events = await response.json();
                    
                    const eventsList = document.getElementById('eventsList');
                    if (events.length === 0) {
                        eventsList.innerHTML = '<p>No verified events yet.</p>';
                    } else {
                        eventsList.innerHTML = events.map(event => \`
                            <div class="event-card event-verified">
                                <h4>\${event.eventType.toUpperCase()}</h4>
                                <p><strong>Location:</strong> \${event.location || 'Unknown'}</p>
                                <p><strong>Text:</strong> \${event.text}</p>
                                <p><strong>Severity:</strong> \${event.severity}</p>
                                <p><strong>Author:</strong> \${event.author}</p>
                                <p><strong>Time:</strong> \${new Date(event.createdAt).toLocaleString()}</p>
                            </div>
                        \`).join('');
                    }
                } catch (error) {
                    console.error('Error loading events:', error);
                }
            }
            
            function updateStats() {
                document.getElementById('eventsCount').textContent = events.length;
                document.getElementById('verifiedCount').textContent = events.filter(e => e.verified).length;
                document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
            }
            
            function testFlood() {
                document.getElementById('text').value = 'Heavy flooding in downtown Kuala Lumpur, roads blocked and people trapped in buildings';
                document.getElementById('source').value = 'twitter';
                document.getElementById('author').value = '@kl_emergency';
                document.getElementById('lat').value = '3.1579';
                document.getElementById('lng').value = '101.7116';
            }
            
            function testStorm() {
                document.getElementById('text').value = 'Severe thunderstorm with heavy rain in Petaling Jaya, avoid Jalan Utara area';
                document.getElementById('source').value = 'twitter';
                document.getElementById('author').value = '@pj_weather';
                document.getElementById('lat').value = '3.1073';
                document.getElementById('lng').value = '101.6136';
            }
            
            function testEarthquake() {
                document.getElementById('text').value = 'Earthquake felt in Kota Kinabalu, magnitude 5.2, buildings shaking';
                document.getElementById('source').value = 'facebook';
                document.getElementById('author').value = '@sabah_alert';
                document.getElementById('lat').value = '5.9804';
                document.getElementById('lng').value = '116.0735';
            }
            
            function testMalay() {
                document.getElementById('text').value = 'Amaran banjir di Shah Alam. Elakkan kawasan Persiaran Klang. Jalan ditutup untuk keselamatan.';
                document.getElementById('source').value = 'twitter';
                document.getElementById('author').value = '@shahalam_banjir';
                document.getElementById('lat').value = '3.0733';
                document.getElementById('lng').value = '101.5185';
            }
            
            function testNonDisaster() {
                document.getElementById('text').value = 'Beautiful sunset today in Langkawi. Perfect weather for vacation!';
                document.getElementById('source').value = 'twitter';
                document.getElementById('author').value = '@travel_langkawi';
                document.getElementById('lat').value = '6.3500';
                document.getElementById('lng').value = '99.8000';
            }
            
            // Load initial data
            loadEvents();
            updateStats();
        </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Local Development Server Running');
  console.log('====================================');
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔗 API Base: http://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   - POST /ingest/twitter - Ingest social media posts`);
  console.log(`   - GET /events - Get verified events`);
  console.log(`   - POST /subscribe - Subscribe to alerts`);
  console.log(`\n🌦️  Mock Weather APIs:`);
  console.log(`   - GET /mock-api/weather/warning`);
  console.log(`   - GET /mock-api/weather/forecast`);
  console.log(`   - GET /mock-api/weather/warning/earthquake`);
  console.log(`\n💡 This server simulates the AWS Lambda functions locally`);
  console.log(`   No AWS deployment required for testing!`);
});

module.exports = app;

