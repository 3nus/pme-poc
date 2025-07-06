// Weather.gov API TypeScript interfaces

export interface WeatherStation {
  id: string
  name: string
  latitude: number
  longitude: number
  elevation: number
}

export interface WeatherObservation {
  timestamp: string
  temperature: {
    value: number | null
    unitCode: string
  }
  dewpoint: {
    value: number | null
    unitCode: string
  }
  windDirection: {
    value: number | null
    unitCode: string
  }
  windSpeed: {
    value: number | null
    unitCode: string
  }
  windGust: {
    value: number | null
    unitCode: string
  }
  barometricPressure: {
    value: number | null
    unitCode: string
  }
  visibility: {
    value: number | null
    unitCode: string
  }
  maxTemperatureLast24Hours: {
    value: number | null
    unitCode: string
  }
  minTemperatureLast24Hours: {
    value: number | null
    unitCode: string
  }
  precipitationLastHour: {
    value: number | null
    unitCode: string
  }
  precipitationLast3Hours: {
    value: number | null
    unitCode: string
  }
  precipitationLast6Hours: {
    value: number | null
    unitCode: string
  }
  relativeHumidity: {
    value: number | null
    unitCode: string
  }
  windChill: {
    value: number | null
    unitCode: string
  }
  heatIndex: {
    value: number | null
    unitCode: string
  }
  cloudLayers: Array<{
    base: {
      value: number | null
      unitCode: string
    }
    amount: string
  }>
}

export interface WeatherStationResponse {
  id: string
  type: string
  geometry: {
    type: string
    coordinates: [number, number]
  }
  properties: {
    '@id': string
    '@type': string
    elevation: {
      value: number
      unitCode: string
    }
    stationIdentifier: string
    name: string
    timeZone: string
    forecast: string
    county: string
    fireWeatherZone: string
  }
}

export interface WeatherObservationResponse {
  '@context': Record<string, unknown>
  id: string
  type: string
  geometry: {
    type: string
    coordinates: [number, number]
  }
  properties: WeatherObservation
}

export interface WeatherStationsResponse {
  '@context': Record<string, unknown>
  type: string
  features: WeatherStationResponse[]
}

export interface WeatherObservationsResponse {
  '@context': Record<string, unknown>
  type: string
  features: WeatherObservationResponse[]
}

// Processed weather data for Penman-Monteith calculations
export interface ProcessedWeatherData {
  maxTemperature: number // °C
  minTemperature: number // °C
  relativeHumidity: number // %
  windSpeed: number // m/s
  solarRadiation?: number // MJ/m²/day (may need to be estimated)
  station: {
    id: string
    name: string
    latitude: number
    longitude: number
    elevation: number
  }
  timestamp: string
}

// Location for weather station lookup
export interface Location {
  latitude: number
  longitude: number
}

// Weather service error types
export interface WeatherServiceError {
  message: string
  code: string
  details?: Record<string, unknown>
}