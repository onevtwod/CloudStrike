#!/usr/bin/env node

const axios = require('axios');

class WeatherAPIService {
    constructor() {
        this.apiKey = process.env.WEATHER_API_KEY;
        this.rateLimitDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;

        // Malaysian Meteorological Department API endpoints
        this.metMalaysiaAPI = {
            warnings: 'https://www.met.gov.my/en/web/metmalaysia/forecast',
            forecasts: 'https://www.met.gov.my/en/web/metmalaysia/forecast',
            earthquakes: 'https://www.met.gov.my/en/web/metmalaysia/earthquake'
        };

        // OpenWeatherMap API (backup/alternative)
        this.openWeatherAPI = {
            baseURL: 'https://api.openweathermap.org/data/2.5',
            apiKey: process.env.OPENWEATHER_API_KEY
        };

        console.log('🌦️  Weather API Service initialized');
    }

    async rateLimitRequest() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
            const delay = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    async fetchMalaysianWeatherWarnings() {
        try {
            await this.rateLimitRequest();
            console.log('🌦️  Fetching Malaysian weather warnings...');

            // Try to fetch from Malaysian Met Department
            const response = await axios.get(this.metMalaysiaAPI.warnings, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Parse the HTML response to extract warnings
            const warnings = this.parseWeatherWarnings(response.data);
            console.log(`   📊 Found ${warnings.length} weather warnings`);
            return warnings;

        } catch (error) {
            console.error('❌ Error fetching Malaysian weather warnings:', error.message);
            return this.getFallbackWeatherWarnings();
        }
    }

    async fetchMalaysianEarthquakeData() {
        try {
            await this.rateLimitRequest();
            console.log('🌍 Fetching Malaysian earthquake data...');

            const response = await axios.get(this.metMalaysiaAPI.earthquakes, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const earthquakes = this.parseEarthquakeData(response.data);
            console.log(`   📊 Found ${earthquakes.length} recent earthquakes`);
            return earthquakes;

        } catch (error) {
            console.error('❌ Error fetching earthquake data:', error.message);
            return this.getFallbackEarthquakeData();
        }
    }

    async fetchOpenWeatherAlerts(latitude, longitude) {
        try {
            if (!this.openWeatherAPI.apiKey) {
                console.log('⚠️  OpenWeatherMap API key not configured');
                return null;
            }

            await this.rateLimitRequest();
            console.log('🌤️  Fetching OpenWeatherMap alerts...');

            const response = await axios.get(`${this.openWeatherAPI.baseURL}/onecall`, {
                params: {
                    lat: latitude,
                    lon: longitude,
                    appid: this.openWeatherAPI.apiKey,
                    exclude: 'minutely,daily'
                },
                timeout: 10000
            });

            const alerts = response.data.alerts || [];
            console.log(`   📊 Found ${alerts.length} weather alerts`);
            return alerts;

        } catch (error) {
            console.error('❌ Error fetching OpenWeatherMap alerts:', error.message);
            return null;
        }
    }

    parseWeatherWarnings(htmlData) {
        // This is a simplified parser - in production, you'd use cheerio or puppeteer
        const warnings = [];

        try {
            // Look for common warning patterns in Malaysian weather sites
            const warningPatterns = [
                /Amaran Hujan Lebat/gi,
                /Heavy Rain Warning/gi,
                /Amaran Ribut Petir/gi,
                /Thunderstorm Warning/gi,
                /Amaran Angin Kencang/gi,
                /Strong Wind Warning/gi,
                /Amaran Gelombang Tinggi/gi,
                /High Wave Warning/gi
            ];

            warningPatterns.forEach(pattern => {
                const matches = htmlData.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        warnings.push({
                            type: match,
                            severity: this.calculateWarningSeverity(match),
                            timestamp: new Date().toISOString(),
                            source: 'Malaysian Meteorological Department'
                        });
                    });
                }
            });

        } catch (error) {
            console.error('Error parsing weather warnings:', error.message);
        }

        return warnings;
    }

    parseEarthquakeData(htmlData) {
        const earthquakes = [];

        try {
            // Look for earthquake data patterns
            const earthquakePatterns = [
                /Magnitude[\s:]*(\d+\.?\d*)/gi,
                /Depth[\s:]*(\d+\.?\d*)[\s]*km/gi,
                /Location[\s:]*([^<>\n]+)/gi
            ];

            // This is simplified - real implementation would parse structured data
            const magnitudeMatch = htmlData.match(/Magnitude[\s:]*(\d+\.?\d*)/i);
            if (magnitudeMatch) {
                earthquakes.push({
                    magnitude: parseFloat(magnitudeMatch[1]),
                    depth: 10.0, // Default depth
                    location: 'Malaysia',
                    timestamp: new Date().toISOString(),
                    source: 'Malaysian Meteorological Department'
                });
            }

        } catch (error) {
            console.error('Error parsing earthquake data:', error.message);
        }

        return earthquakes;
    }

    calculateWarningSeverity(warningText) {
        const lowerText = warningText.toLowerCase();

        if (lowerText.includes('severe') || lowerText.includes('teruk')) {
            return 0.9;
        } else if (lowerText.includes('heavy') || lowerText.includes('lebat')) {
            return 0.7;
        } else if (lowerText.includes('thunderstorm') || lowerText.includes('ribut')) {
            return 0.6;
        } else if (lowerText.includes('wind') || lowerText.includes('angin')) {
            return 0.5;
        }

        return 0.4; // Default severity
    }

    async getMeteorologicalData(location = null) {
        try {
            console.log('🌦️  Fetching comprehensive meteorological data...');

            const [warnings, earthquakes] = await Promise.all([
                this.fetchMalaysianWeatherWarnings(),
                this.fetchMalaysianEarthquakeData()
            ]);

            const meteorologicalData = {
                warnings: warnings,
                earthquakes: earthquakes,
                timestamp: new Date().toISOString(),
                location: location
            };

            console.log(`   ✅ Meteorological data collected: ${warnings.length} warnings, ${earthquakes.length} earthquakes`);
            return meteorologicalData;

        } catch (error) {
            console.error('❌ Error fetching meteorological data:', error.message);
            return this.getFallbackMeteorologicalData();
        }
    }

    calculateDisasterSeverityFromWeather(postText, location, meteorologicalData) {
        let severity = 0.3; // Base severity

        const lowerText = postText.toLowerCase();

        // Check for active weather warnings
        if (meteorologicalData.warnings && meteorologicalData.warnings.length > 0) {
            const activeWarnings = meteorologicalData.warnings.filter(warning => {
                const warningTime = new Date(warning.timestamp);
                const hoursDiff = (new Date().getTime() - warningTime.getTime()) / (1000 * 60 * 60);
                return hoursDiff <= 24; // Active in last 24 hours
            });

            if (activeWarnings.length > 0) {
                severity += 0.4; // Significant increase for active warnings
                console.log(`   🌦️  Active weather warning detected: ${activeWarnings[0].type}`);
            }
        }

        // Check for recent earthquakes
        if (meteorologicalData.earthquakes && meteorologicalData.earthquakes.length > 0) {
            const recentEarthquakes = meteorologicalData.earthquakes.filter(eq => {
                const eqTime = new Date(eq.timestamp);
                const hoursDiff = (new Date().getTime() - eqTime.getTime()) / (1000 * 60 * 60);
                return hoursDiff <= 24 && eq.magnitude >= 4.0;
            });

            if (recentEarthquakes.length > 0) {
                severity += 0.3; // Increase for recent significant earthquakes
                console.log(`   🌍 Recent earthquake detected: Magnitude ${recentEarthquakes[0].magnitude}`);
            }
        }

        // Check for weather-related keywords in post
        const weatherKeywords = [
            'rain', 'hujan', 'flood', 'banjir', 'storm', 'ribut', 'thunder', 'petir',
            'wind', 'angin', 'typhoon', 'taufan', 'cyclone', 'siklon', 'hurricane'
        ];

        const hasWeatherKeywords = weatherKeywords.some(keyword => lowerText.includes(keyword));
        if (hasWeatherKeywords) {
            severity += 0.2; // Moderate increase for weather-related posts
        }

        return Math.min(1.0, severity);
    }

    getFallbackWeatherWarnings() {
        // Fallback data when API is unavailable
        return [
            {
                type: 'Heavy Rain Warning',
                severity: 0.7,
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                source: 'Fallback Data'
            }
        ];
    }

    getFallbackEarthquakeData() {
        // Fallback data when API is unavailable
        return [
            {
                magnitude: 4.2,
                depth: 12.5,
                location: 'Malaysia',
                timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
                source: 'Fallback Data'
            }
        ];
    }

    getFallbackMeteorologicalData() {
        return {
            warnings: this.getFallbackWeatherWarnings(),
            earthquakes: this.getFallbackEarthquakeData(),
            timestamp: new Date().toISOString(),
            location: null,
            source: 'Fallback Data'
        };
    }
}

module.exports = WeatherAPIService;
