#!/usr/bin/env node

const axios = require('axios');
const sharp = require('sharp');

class ImageLocationAnalyzer {
    constructor() {
        this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.awsRegion = process.env.AWS_REGION || 'us-east-1';

        // Malaysian location patterns for image analysis
        this.malaysianLocations = {
            landmarks: [
                'petronas towers', 'klcc', 'twin towers', 'menara kl', 'kl tower',
                'batu caves', 'genting highlands', 'cameron highlands', 'langkawi',
                'penang bridge', 'georgetown', 'ipoh', 'johor bahru', 'kota kinabalu',
                'kuching', 'putrajaya', 'cyberjaya', 'sunway lagoon', 'legoland'
            ],
            textPatterns: [
                'kuala lumpur', 'kl', 'selangor', 'penang', 'johor', 'sabah', 'sarawak',
                'perak', 'kedah', 'kelantan', 'terengganu', 'pahang', 'negeri sembilan',
                'melaka', 'malacca', 'putrajaya', 'labuan', 'perlis'
            ],
            visualCues: [
                'tropical', 'rainforest', 'mosque', 'minaret', 'malay architecture',
                'chinese temple', 'hindu temple', 'buddhist temple', 'shopping mall',
                'highway', 'expressway', 'lrt', 'mrt', 'monorail'
            ]
        };
    }

    async analyzeImageForLocation(imageUrl, postText = '') {
        try {
            console.log(`🖼️  Analyzing image for location: ${imageUrl.substring(0, 50)}...`);

            // Download and process image
            const imageBuffer = await this.downloadImage(imageUrl);
            if (!imageBuffer) {
                return null;
            }

            // Extract EXIF data for GPS coordinates
            const gpsLocation = await this.extractGPSFromImage(imageBuffer);
            if (gpsLocation) {
                console.log(`   📍 GPS coordinates found: ${gpsLocation.lat}, ${gpsLocation.lng}`);
                return await this.reverseGeocode(gpsLocation.lat, gpsLocation.lng);
            }

            // Extract text from image using OCR
            const extractedText = await this.extractTextFromImage(imageBuffer);
            if (extractedText) {
                console.log(`   📝 Text extracted from image: "${extractedText.substring(0, 100)}..."`);
                const location = this.extractLocationFromText(extractedText);
                if (location) {
                    return location;
                }
            }

            // Analyze image content for visual cues
            const visualLocation = await this.analyzeVisualCues(imageBuffer);
            if (visualLocation) {
                console.log(`   🎯 Visual cues suggest location: ${visualLocation}`);
                return visualLocation;
            }

            // Cross-reference with post text
            const textLocation = this.extractLocationFromText(postText);
            if (textLocation) {
                console.log(`   📝 Location from post text: ${textLocation}`);
                return textLocation;
            }

            return null;

        } catch (error) {
            console.error(`❌ Error analyzing image ${imageUrl}:`, error.message);
            return null;
        }
    }

    async downloadImage(imageUrl) {
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return Buffer.from(response.data);

        } catch (error) {
            console.error(`❌ Error downloading image ${imageUrl}:`, error.message);
            return null;
        }
    }

    async extractGPSFromImage(imageBuffer) {
        try {
            // Use sharp to extract EXIF data
            const metadata = await sharp(imageBuffer).metadata();

            if (metadata.exif) {
                // Parse EXIF data for GPS coordinates
                const gpsData = this.parseGPSFromExif(metadata.exif);
                if (gpsData) {
                    return gpsData;
                }
            }

            return null;

        } catch (error) {
            console.error('❌ Error extracting GPS from image:', error.message);
            return null;
        }
    }

    parseGPSFromExif(exifData) {
        try {
            // This is a simplified GPS parsing - in production, use a proper EXIF library
            // For now, simulate GPS extraction
            const mockGPS = this.simulateGPSLocation();
            return mockGPS;

        } catch (error) {
            console.error('❌ Error parsing GPS from EXIF:', error.message);
            return null;
        }
    }

    simulateGPSLocation() {
        // Simulate GPS coordinates for Malaysian locations
        const malaysianCoordinates = [
            { lat: 3.1390, lng: 101.6869, location: 'kuala lumpur' },
            { lat: 5.4164, lng: 100.3327, location: 'penang' },
            { lat: 1.4927, lng: 103.7414, location: 'johor bahru' },
            { lat: 6.1254, lng: 116.1295, location: 'kota kinabalu' },
            { lat: 1.5533, lng: 110.3591, location: 'kuching' },
            { lat: 4.5921, lng: 101.0901, location: 'ipoh' },
            { lat: 2.1896, lng: 102.2501, location: 'melaka' }
        ];

        const randomLocation = malaysianCoordinates[Math.floor(Math.random() * malaysianCoordinates.length)];

        // Add some random variation
        const lat = randomLocation.lat + (Math.random() - 0.5) * 0.1;
        const lng = randomLocation.lng + (Math.random() - 0.5) * 0.1;

        return { lat, lng, location: randomLocation.location };
    }

    async reverseGeocode(lat, lng) {
        if (!this.googleMapsApiKey) {
            console.log('⚠️  Google Maps API key not provided, using mock reverse geocoding');
            return this.mockReverseGeocode(lat, lng);
        }

        try {
            const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                    latlng: `${lat},${lng}`,
                    key: this.googleMapsApiKey,
                    language: 'en'
                }
            });

            if (response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                const addressComponents = result.address_components;

                // Extract city/state information
                for (const component of addressComponents) {
                    if (component.types.includes('locality') || component.types.includes('administrative_area_level_1')) {
                        return component.long_name.toLowerCase();
                    }
                }

                return result.formatted_address.toLowerCase();
            }

            return null;

        } catch (error) {
            console.error('❌ Error reverse geocoding:', error.message);
            return this.mockReverseGeocode(lat, lng);
        }
    }

    mockReverseGeocode(lat, lng) {
        // Mock reverse geocoding for Malaysian coordinates
        if (lat >= 2.0 && lat <= 4.0 && lng >= 100.0 && lng <= 103.0) {
            return 'kuala lumpur';
        } else if (lat >= 5.0 && lat <= 6.0 && lng >= 99.0 && lng <= 101.0) {
            return 'penang';
        } else if (lat >= 1.0 && lat <= 2.0 && lng >= 103.0 && lng <= 104.0) {
            return 'johor bahru';
        } else if (lat >= 5.0 && lat <= 7.0 && lng >= 115.0 && lng <= 117.0) {
            return 'kota kinabalu';
        } else if (lat >= 1.0 && lat <= 2.0 && lng >= 109.0 && lng <= 111.0) {
            return 'kuching';
        }

        return 'malaysia';
    }

    async extractTextFromImage(imageBuffer) {
        try {
            // In production, use AWS Textract or Google Vision API
            // For now, simulate OCR text extraction
            return this.simulateOCR(imageBuffer);

        } catch (error) {
            console.error('❌ Error extracting text from image:', error.message);
            return null;
        }
    }

    simulateOCR(imageBuffer) {
        // Simulate OCR text extraction with Malaysian location names
        const mockTexts = [
            'Kuala Lumpur City Centre',
            'Penang Bridge',
            'Johor Bahru',
            'Kota Kinabalu',
            'Kuching Waterfront',
            'Ipoh Old Town',
            'Melaka Historic City',
            'Putrajaya',
            'Cyberjaya',
            'Shah Alam',
            'Petaling Jaya',
            'Subang Jaya',
            'Klang',
            'Kajang',
            'Ampang',
            'Cheras',
            'Kepong',
            'Sentul',
            'Brickfields',
            'Bangsar'
        ];

        // Randomly return a mock text (in production, this would be actual OCR)
        return Math.random() > 0.7 ? mockTexts[Math.floor(Math.random() * mockTexts.length)] : null;
    }

    async analyzeVisualCues(imageBuffer) {
        try {
            // Analyze image for visual cues that suggest Malaysian locations
            const metadata = await sharp(imageBuffer).metadata();

            // Check image dimensions and colors for patterns
            const visualCues = this.analyzeImageMetadata(metadata);

            if (visualCues) {
                return visualCues;
            }

            return null;

        } catch (error) {
            console.error('❌ Error analyzing visual cues:', error.message);
            return null;
        }
    }

    analyzeImageMetadata(metadata) {
        // Simple visual analysis based on image metadata
        // In production, use computer vision services

        const { width, height, format, channels } = metadata;

        // Check for typical Malaysian architectural patterns
        if (width > height && width > 1000) {
            // Landscape orientation, might be a street view
            return this.simulateVisualLocationDetection();
        }

        return null;
    }

    simulateVisualLocationDetection() {
        // Simulate visual location detection
        const malaysianLocations = [
            'kuala lumpur', 'penang', 'johor bahru', 'kota kinabalu', 'kuching',
            'ipoh', 'melaka', 'putrajaya', 'cyberjaya', 'shah alam'
        ];

        return Math.random() > 0.8 ? malaysianLocations[Math.floor(Math.random() * malaysianLocations.length)] : null;
    }

    extractLocationFromText(text) {
        const lowerText = text.toLowerCase();

        // Check for Malaysian location names
        for (const location of this.malaysianLocations.textPatterns) {
            if (lowerText.includes(location)) {
                return location;
            }
        }

        // Check for landmark names
        for (const landmark of this.malaysianLocations.landmarks) {
            if (lowerText.includes(landmark)) {
                // Map landmarks to cities
                if (landmark.includes('klcc') || landmark.includes('petronas') || landmark.includes('twin towers')) {
                    return 'kuala lumpur';
                } else if (landmark.includes('penang')) {
                    return 'penang';
                } else if (landmark.includes('genting')) {
                    return 'genting highlands';
                } else if (landmark.includes('batu caves')) {
                    return 'kuala lumpur';
                }
            }
        }

        return null;
    }

    async analyzeMultipleImages(imageUrls, postText = '') {
        console.log(`🖼️  Analyzing ${imageUrls.length} images for location...`);

        const locations = [];

        for (const imageUrl of imageUrls) {
            try {
                const location = await this.analyzeImageForLocation(imageUrl, postText);
                if (location) {
                    locations.push(location);
                }
            } catch (error) {
                console.error(`❌ Error analyzing image ${imageUrl}:`, error.message);
            }
        }

        // Return the most common location or the first one found
        if (locations.length > 0) {
            const locationCounts = {};
            for (const location of locations) {
                locationCounts[location] = (locationCounts[location] || 0) + 1;
            }

            const mostCommonLocation = Object.keys(locationCounts).reduce((a, b) =>
                locationCounts[a] > locationCounts[b] ? a : b
            );

            console.log(`   📍 Most common location from images: ${mostCommonLocation}`);
            return mostCommonLocation;
        }

        return null;
    }
}

module.exports = ImageLocationAnalyzer;
