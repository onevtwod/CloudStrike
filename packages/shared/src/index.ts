export type Coordinates = { lat: number; lng: number };
export type DisasterEvent = {
    id: string;
    text: string;
    location?: string;
    coordinates?: Coordinates;
    eventType?: string;
    verified: number; // 1 or 0 for GSI
    createdAt: string;
};

// Types for Malaysian Weather API responses
type WeatherForecast = {
    location: {
        location_id: string;
        location_name: string;
    };
    date: string;
    morning_forecast: string;
    afternoon_forecast: string;
    night_forecast: string;
    summary_forecast: string;
    summary_when: string;
    min_temp: number;
    max_temp: number;
};

type WeatherWarning = {
    warning_issue: {
        issued: string;
        title_bm: string;
        title_en: string;
    };
    valid_from: string;
    valid_to: string;
    heading_en: string;
    text_en: string;
    instruction_en: string;
    heading_bm: string;
    text_bm: string;
    instruction_bm: string;
};

type EarthquakeWarning = {
    utcdatetime: string;
    localdatetime: string;
    lat: number;
    lon: number;
    depth: number;
    location: string;
    location_original: string;
    n_distancemas: string;
    n_distancerest: string;
    nbm_distancemas: string;
    nbm_distancerest: string;
    magdefault: number;
    magtypedefault: string;
    status: string;
    visible: boolean;
    lat_vector: string;
    lon_vector: string;
};

export async function fetchMeteorologicalSignal(coords?: Coordinates): Promise<{ severity: number; source: string }> {
    try {
        // No API key required for data.gov.my - it's a public API
        if (!coords) {
            return { severity: 0.6, source: 'stub-malaysia-weather' };
        }

        // Fetch current weather warnings and forecasts
        const [warningsRes, forecastsRes, earthquakeRes] = await Promise.allSettled([
            fetch('https://api.data.gov.my/weather/warning?limit=10'),
            fetch('https://api.data.gov.my/weather/forecast?limit=5'),
            fetch('https://api.data.gov.my/weather/warning/earthquake?limit=5')
        ]);

        let severity = 0.3; // Base severity
        let source = 'malaysia-weather';

        // Process active weather warnings
        if (warningsRes.status === 'fulfilled' && warningsRes.value.ok) {
            const warningsData = await warningsRes.value.json();
            if (Array.isArray(warningsData) && warningsData.length > 0) {
                // Check for active warnings (valid now)
                const now = new Date();
                const activeWarnings = warningsData.filter((warning: WeatherWarning) => {
                    const validFrom = new Date(warning.valid_from);
                    const validTo = new Date(warning.valid_to);
                    return now >= validFrom && now <= validTo;
                });

                // Increase severity based on warning count and type
                if (activeWarnings.length > 0) {
                    severity += 0.4; // Significant increase for active warnings
                    source = 'malaysia-warnings';
                }
            }
        }

        // Process earthquake warnings
        if (earthquakeRes.status === 'fulfilled' && earthquakeRes.value.ok) {
            const earthquakeData = await earthquakeRes.value.json();
            if (Array.isArray(earthquakeData) && earthquakeData.length > 0) {
                // Check for recent earthquakes (within last 24 hours)
                const now = new Date();
                const recentEarthquakes = earthquakeData.filter((eq: EarthquakeWarning) => {
                    const earthquakeTime = new Date(eq.localdatetime);
                    const hoursDiff = (now.getTime() - earthquakeTime.getTime()) / (1000 * 60 * 60);
                    return hoursDiff <= 24 && eq.magdefault >= 4.0; // Magnitude 4.0 or higher
                });

                if (recentEarthquakes.length > 0) {
                    severity += 0.3; // Increase severity for recent significant earthquakes
                    source = 'malaysia-earthquake';
                }
            }
        }

        // Process weather forecasts for storm conditions
        if (forecastsRes.status === 'fulfilled' && forecastsRes.value.ok) {
            const forecastsData = await forecastsRes.value.json();
            if (Array.isArray(forecastsData) && forecastsData.length > 0) {
                // Look for storm-related forecasts in the data
                const stormKeywords = [
                    'ribut petir', // thunderstorm
                    'ribut', // storm
                    'hujan lebat', // heavy rain
                    'angin kencang' // strong wind
                ];

                const hasStormConditions = forecastsData.some((forecast: WeatherForecast) => {
                    const forecastText = [
                        forecast.morning_forecast,
                        forecast.afternoon_forecast,
                        forecast.night_forecast,
                        forecast.summary_forecast
                    ].join(' ').toLowerCase();

                    return stormKeywords.some(keyword => forecastText.includes(keyword));
                });

                if (hasStormConditions) {
                    severity += 0.2; // Moderate increase for storm conditions
                    source = 'malaysia-storms';
                }
            }
        }

        // Cap severity at 1.0
        severity = Math.min(1.0, severity);

        return { severity, source };
    } catch {
        return { severity: 0.5, source: 'malaysia-weather-error' };
    }
}

export async function computeAlternativeRoutes(origin: Coordinates, destination: Coordinates): Promise<Array<{ polyline: string; durationMins: number }>> {
    try {
        const apiKey = process.env.MAPS_API_KEY;
        if (!apiKey) {
            return [{ polyline: 'encoded-polyline', durationMins: 12 }];
        }
        const params = new URLSearchParams({
            origin: `${origin.lat},${origin.lng}`,
            destination: `${destination.lat},${destination.lng}`,
            mode: 'driving',
            alternatives: 'true',
            key: apiKey,
        });
        const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) return [{ polyline: 'fallback', durationMins: 15 }];
        const data: any = await res.json();
        const routes = Array.isArray(data?.routes) ? data.routes : [];
        return routes.map((r: any) => ({ polyline: r?.overview_polyline?.points ?? 'n/a', durationMins: Math.round((r?.legs?.[0]?.duration?.value ?? 900) / 60) }));
    } catch {
        return [{ polyline: 'error', durationMins: 15 }];
    }
}

export function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Export logger
export { Logger, LogLevel, createLogger, logger } from './logger';