// API utility functions with comprehensive error handling

export interface ApiError {
    message: string;
    status?: number;
    type: 'network' | 'http' | 'parse' | 'validation';
}

export async function apiRequest<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const defaultHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);

        // Check if response is ok
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            if (response.status === 404) {
                errorMessage = 'API endpoint not found. Please check if the backend is deployed.';
            } else if (response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (response.status === 401) {
                errorMessage = 'Unauthorized. Please check your API configuration.';
            } else if (response.status === 403) {
                errorMessage = 'Forbidden. Please check your permissions.';
            }

            throw new ApiError(errorMessage, response.status, 'http');
        }

        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new ApiError(
                'Invalid response format. Expected JSON but received HTML or other format.',
                response.status,
                'parse'
            );
        }

        // Parse JSON
        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        // Network or other errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new ApiError(
                'Network error. Please check your connection and API URL.',
                undefined,
                'network'
            );
        }

        throw new ApiError(
            error instanceof Error ? error.message : 'Unknown error occurred',
            undefined,
            'network'
        );
    }
}

export class ApiError extends Error {
    status?: number;
    type: 'network' | 'http' | 'parse' | 'validation';

    constructor(message: string, status?: number, type: 'network' | 'http' | 'parse' | 'validation' = 'network') {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.type = type;
    }
}

// Specific API functions
export async function fetchEvents(apiBase: string): Promise<any[]> {
    if (!apiBase) {
        throw new ApiError('API URL not configured. Please set VITE_API_BASE_URL in .env file.', undefined, 'validation');
    }

    const data = await apiRequest<any[]>(`${apiBase}/events`);

    if (!Array.isArray(data)) {
        throw new ApiError('Invalid response format. Expected array of events.', undefined, 'parse');
    }

    return data;
}

export async function subscribeToAlerts(
    apiBase: string,
    kind: 'email' | 'sms',
    value: string
): Promise<{ message: string }> {
    if (!apiBase) {
        throw new ApiError('API URL not configured. Please set VITE_API_BASE_URL in .env file.', undefined, 'validation');
    }

    if (!value) {
        throw new ApiError('Enter a value', undefined, 'validation');
    }

    const data = await apiRequest<{ message: string }>(`${apiBase}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ kind, value }),
    });

    if (!data || typeof data !== 'object' || typeof data.message !== 'string') {
        throw new ApiError('Invalid response format. Expected JSON object with message.', undefined, 'parse');
    }

    return data;
}
