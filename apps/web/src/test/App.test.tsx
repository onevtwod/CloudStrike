import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'
import { fetchEvents, subscribeToAlerts } from '../utils/api'

// Mock the API utilities
vi.mock('../utils/api', () => ({
  fetchEvents: vi.fn(),
  subscribeToAlerts: vi.fn(),
}))

const mockFetchEvents = vi.mocked(fetchEvents)
const mockSubscribeToAlerts = vi.mocked(subscribeToAlerts)

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders disaster events title', async () => {
    mockFetchEvents.mockResolvedValueOnce([])

    render(<App />)
    
    expect(screen.getByText('Disaster Events')).toBeInTheDocument()
    expect(screen.getByText('Verified incidents from social + meteo signals')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('No Events Found')).toBeInTheDocument()
    })
  })

  it('displays loading state initially', () => {
    mockFetchEvents.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    render(<App />)
    
    expect(screen.getByText('Loading events...')).toBeInTheDocument()
    expect(screen.getByText('Fetching data from API')).toBeInTheDocument()
  })

  it('displays events when loaded successfully', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        text: 'Flood warning in downtown area',
        location: 'downtown',
        eventType: 'flood',
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'event-2',
        text: 'Fire at warehouse district',
        location: 'warehouse district',
        eventType: 'fire',
        createdAt: '2024-01-01T01:00:00Z'
      }
    ]

    mockFetchEvents.mockResolvedValueOnce(mockEvents)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('flood')).toBeInTheDocument()
      expect(screen.getByText('Flood warning in downtown area')).toBeInTheDocument()
      expect(screen.getByText('downtown')).toBeInTheDocument()
    })

    expect(screen.getByText('fire')).toBeInTheDocument()
    expect(screen.getByText('Fire at warehouse district')).toBeInTheDocument()
  })

  it('displays error message when API fails', async () => {
    mockFetchEvents.mockRejectedValueOnce(new Error('Network error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Error Loading Events')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows troubleshooting info on error', async () => {
    mockFetchEvents.mockRejectedValueOnce(new Error('API not found'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Troubleshooting:')).toBeInTheDocument()
      expect(screen.getByText('Check if VITE_API_BASE_URL is set in .env file')).toBeInTheDocument()
    })
  })

  it('handles email subscription', async () => {
    mockFetchEvents.mockResolvedValueOnce([])
    mockSubscribeToAlerts.mockResolvedValueOnce({ message: 'Subscription requested' })

    render(<App />)

    const emailInput = screen.getByPlaceholderText('Email')
    const subscribeButton = screen.getByText('Subscribe Email')

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(subscribeButton)

    await waitFor(() => {
      expect(screen.getByText('Subscription requested')).toBeInTheDocument()
    })

    expect(mockSubscribeToAlerts).toHaveBeenCalledWith('', 'email', 'test@example.com')
  })

  it('handles SMS subscription', async () => {
    mockFetchEvents.mockResolvedValueOnce([])
    mockSubscribeToAlerts.mockResolvedValueOnce({ message: 'Subscription requested' })

    render(<App />)

    const phoneInput = screen.getByPlaceholderText('+15551234567')
    const subscribeButton = screen.getByText('Subscribe SMS')

    fireEvent.change(phoneInput, { target: { value: '+15551234567' } })
    fireEvent.click(subscribeButton)

    await waitFor(() => {
      expect(screen.getByText('Subscription requested')).toBeInTheDocument()
    })

    expect(mockSubscribeToAlerts).toHaveBeenCalledWith('', 'sms', '+15551234567')
  })

  it('shows error message for empty subscription', async () => {
    mockFetchEvents.mockResolvedValueOnce([])

    render(<App />)

    const subscribeButton = screen.getByText('Subscribe Email')
    fireEvent.click(subscribeButton)

    await waitFor(() => {
      expect(screen.getByText('Enter a value')).toBeInTheDocument()
    })
  })

  it('shows error message for subscription failure', async () => {
    mockFetchEvents.mockResolvedValueOnce([])
    mockSubscribeToAlerts.mockRejectedValueOnce(new Error('Invalid email'))

    render(<App />)

    const emailInput = screen.getByPlaceholderText('Email')
    const subscribeButton = screen.getByText('Subscribe Email')

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(subscribeButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
    })
  })

  it('shows no events message when array is empty', async () => {
    mockFetchEvents.mockResolvedValueOnce([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('No Events Found')).toBeInTheDocument()
      expect(screen.getByText('No disaster events have been reported yet.')).toBeInTheDocument()
    })
  })
})