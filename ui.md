# UI Notes

## Design Principles
- Mobile/web clients consume `GET /events` and show routes from origin to affected area
- Avoid yellow; use modern web3 aesthetics; prefer iconography over emojis
- Use clear alert severity indicators and map overlays for affected zones and routes
- Public disaster alert system (no authentication required)

## UI Components
- **Event List**: Display verified disaster events with severity indicators
- **Map Integration**: Google Maps embed showing affected locations
- **Alert Severity**: Color-coded indicators (High/Medium/Low)
- **Real-time Updates**: Auto-refresh for new disaster events
- **Route Planning**: Alternative routes from user location to affected areas

## Data Sources
- **Text Analysis**: Amazon Comprehend entity extraction results
- **Image Analysis**: Amazon Rekognition visual disaster detection
- **Social Media**: Twitter, Reddit, News API integration
- **Meteorological**: Malaysian government weather data
- **Maps**: Google Maps API for location and routing

## Responsive Design
- **Mobile-first**: Optimized for emergency responders on mobile devices
- **Dark Theme**: Modern web3 aesthetic with blue gradient backgrounds
- **Accessibility**: Clear contrast and readable typography
- **Performance**: Fast loading with efficient data fetching

## Cost Optimization
- **No User Authentication**: Public access reduces complexity and costs
- **English-Only**: Simplified language processing
- **Cached Data**: Efficient data retrieval from DynamoDB
- **Minimal Dependencies**: Streamlined frontend architecture
