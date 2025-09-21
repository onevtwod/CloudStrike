import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock environment variables
vi.mock('import.meta', () => ({
    env: {
        VITE_API_BASE_URL: 'https://test-api.example.com'
    }
}))
