import { generateId, fetchMeteorologicalSignal, computeAlternativeRoutes } from '../index';

// Mock fetch globally
global.fetch = jest.fn();

describe('shared utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.MAPS_API_KEY;
    });

    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(0);
        });
    });

    describe('fetchMeteorologicalSignal', () => {
        it('should return stub data when no coordinates', async () => {
            const result = await fetchMeteorologicalSignal();

            expect(result).toEqual({
                severity: 0.6,
                source: 'stub-malaysia-weather'
            });
        });

        it('should call Malaysian weather API when coordinates provided', async () => {
            const coords = { lat: 3.1390, lng: 101.6869 }; // Kuala Lumpur coordinates

            const mockWarningsResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([])
            };

            const mockForecastsResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([
                    {
                        location: { location_id: 'St001', location_name: 'Kuala Lumpur' },
                        date: '2023-12-01',
                        morning_forecast: 'Tiada hujan',
                        afternoon_forecast: 'Hujan di satu dua tempat',
                        night_forecast: 'Tiada hujan',
                        summary_forecast: 'Hujan di satu dua tempat',
                        summary_when: 'Petang',
                        min_temp: 24,
                        max_temp: 32
                    }
                ])
            };

            const mockEarthquakeResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([])
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce(mockWarningsResponse)
                .mockResolvedValueOnce(mockForecastsResponse)
                .mockResolvedValueOnce(mockEarthquakeResponse);

            const result = await fetchMeteorologicalSignal(coords);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('api.data.gov.my/weather/warning')
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('api.data.gov.my/weather/forecast')
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('api.data.gov.my/weather/warning/earthquake')
            );
            expect(result.source).toBe('malaysia-weather');
            expect(result.severity).toBeGreaterThan(0);
        });

        it('should detect storm conditions from forecasts', async () => {
            const coords = { lat: 3.1390, lng: 101.6869 };

            const mockWarningsResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([])
            };

            const mockForecastsResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([
                    {
                        location: { location_id: 'St001', location_name: 'Kuala Lumpur' },
                        date: '2023-12-01',
                        morning_forecast: 'Tiada hujan',
                        afternoon_forecast: 'Ribut petir di beberapa tempat',
                        night_forecast: 'Tiada hujan',
                        summary_forecast: 'Ribut petir di beberapa tempat',
                        summary_when: 'Petang',
                        min_temp: 24,
                        max_temp: 32
                    }
                ])
            };

            const mockEarthquakeResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue([])
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce(mockWarningsResponse)
                .mockResolvedValueOnce(mockForecastsResponse)
                .mockResolvedValueOnce(mockEarthquakeResponse);

            const result = await fetchMeteorologicalSignal(coords);

            expect(result.source).toBe('malaysia-storms');
            expect(result.severity).toBeGreaterThan(0.3);
        });

        it('should handle API errors gracefully', async () => {
            const coords = { lat: 3.1390, lng: 101.6869 };

            // Mock Promise.allSettled to throw an error
            const originalAllSettled = Promise.allSettled;
            Promise.allSettled = jest.fn().mockRejectedValue(new Error('Network error'));

            const result = await fetchMeteorologicalSignal(coords);

            expect(result).toEqual({
                severity: 0.5,
                source: 'malaysia-weather-error'
            });

            // Restore original function
            Promise.allSettled = originalAllSettled;
        });
    });

    describe('computeAlternativeRoutes', () => {
        it('should return stub data when no API key', async () => {
            const origin = { lat: 40.7128, lng: -74.0060 };
            const destination = { lat: 40.7589, lng: -73.9851 };

            const result = await computeAlternativeRoutes(origin, destination);

            expect(result).toEqual([{
                polyline: 'encoded-polyline',
                durationMins: 12
            }]);
        });

        it('should call Google Maps API when key provided', async () => {
            process.env.MAPS_API_KEY = 'test-key';
            const origin = { lat: 40.7128, lng: -74.0060 };
            const destination = { lat: 40.7589, lng: -73.9851 };

            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    routes: [
                        {
                            overview_polyline: { points: 'encoded-route-1' },
                            legs: [{ duration: { value: 600 } }]
                        },
                        {
                            overview_polyline: { points: 'encoded-route-2' },
                            legs: [{ duration: { value: 900 } }]
                        }
                    ]
                })
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await computeAlternativeRoutes(origin, destination);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('maps.googleapis.com')
            );
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                polyline: 'encoded-route-1',
                durationMins: 10
            });
            expect(result[1]).toEqual({
                polyline: 'encoded-route-2',
                durationMins: 15
            });
        });

        it('should handle API errors gracefully', async () => {
            process.env.MAPS_API_KEY = 'test-key';
            const origin = { lat: 40.7128, lng: -74.0060 };
            const destination = { lat: 40.7589, lng: -73.9851 };

            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const result = await computeAlternativeRoutes(origin, destination);

            expect(result).toEqual([{
                polyline: 'error',
                durationMins: 15
            }]);
        });

        it('should handle non-200 responses', async () => {
            process.env.MAPS_API_KEY = 'test-key';
            const origin = { lat: 40.7128, lng: -74.0060 };
            const destination = { lat: 40.7589, lng: -73.9851 };

            const mockResponse = {
                ok: false,
                status: 403
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await computeAlternativeRoutes(origin, destination);

            expect(result).toEqual([{
                polyline: 'fallback',
                durationMins: 15
            }]);
        });
    });
});
