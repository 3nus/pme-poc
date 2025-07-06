import axios from 'axios'
import type {
  WeatherStationsResponse,
  WeatherObservationsResponse,
  ProcessedWeatherData,
  Location,
  WeatherServiceError
} from '@/types/weather'

class WeatherService {
  private readonly baseURL = 'https://api.weather.gov'
  private readonly userAgent = 'PME-POC Weather App (contact@example.com)'

  private axiosInstance = axios.create({
    baseURL: this.baseURL,
    timeout: 10000,
    headers: {
      'User-Agent': this.userAgent,
      'Accept': 'application/json'
    }
  })

  constructor() {
    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const weatherError: WeatherServiceError = {
          message: error.message || 'Weather service error',
          code: error.response?.status?.toString() || 'UNKNOWN',
          details: error.response?.data
        }
        throw weatherError
      }
    )
  }

  /**
   * Find weather stations near a given location
   * @param location - Latitude and longitude
   * @param limit - Maximum number of stations to return
   * @returns Promise<WeatherStationsResponse>
   */
  async findNearbyStations(location: Location, limit: number = 10): Promise<WeatherStationsResponse> {
    const response = await this.axiosInstance.get<WeatherStationsResponse>(
      `/stations`,
      {
        params: {
          limit,
          // Sort by distance from point
          point: `${location.latitude},${location.longitude}`
        }
      }
    )
    return response.data
  }

  /**
   * Get the latest observation from a weather station
   * @param stationId - Weather station ID
   * @returns Promise<WeatherObservationsResponse>
   */
  async getLatestObservation(stationId: string): Promise<WeatherObservationsResponse> {
    const response = await this.axiosInstance.get<WeatherObservationsResponse>(
      `/stations/${stationId}/observations/latest`
    )
    return response.data
  }

  /**
   * Get recent observations from a weather station
   * @param stationId - Weather station ID
   * @param limit - Number of observations to retrieve
   * @returns Promise<WeatherObservationsResponse>
   */
  async getRecentObservations(stationId: string, limit: number = 24): Promise<WeatherObservationsResponse> {
    const response = await this.axiosInstance.get<WeatherObservationsResponse>(
      `/stations/${stationId}/observations`,
      {
        params: { limit }
      }
    )
    return response.data
  }

  /**
   * Convert Celsius to Fahrenheit
   */
  private celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  private fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5/9
  }

  /**
   * Convert temperature value based on unit code
   */
  private convertTemperature(value: number | null, unitCode: string): number | null {
    if (value === null) return null
    
    if (unitCode === 'wmoUnit:degF') {
      return this.fahrenheitToCelsius(value)
    }
    return value // Already in Celsius
  }

  /**
   * Convert wind speed to m/s
   */
  private convertWindSpeed(value: number | null, unitCode: string): number | null {
    if (value === null) return null
    
    if (unitCode === 'wmoUnit:km_h-1') {
      return value / 3.6 // km/h to m/s
    }
    if (unitCode === 'wmoUnit:mi_h-1') {
      return value * 0.44704 // mph to m/s
    }
    return value // Already in m/s
  }

  /**
   * Calculate relative humidity from temperature and dewpoint
   */
  private calculateRelativeHumidity(temperature: number, dewpoint: number): number {
    // Using Magnus formula approximation
    const a = 17.625
    const b = 243.04
    
    const alpha = Math.log(Math.exp((a * dewpoint) / (b + dewpoint)) / Math.exp((a * temperature) / (b + temperature)))
    return Math.exp(alpha) * 100
  }

  /**
   * Get processed weather data for Penman-Monteith calculations
   * @param location - Latitude and longitude
   * @returns Promise<ProcessedWeatherData>
   */
  async getProcessedWeatherData(location: Location): Promise<ProcessedWeatherData> {
    try {
      // Find nearest weather station
      const stationsResponse = await this.findNearbyStations(location, 1)
      
      if (!stationsResponse.features || stationsResponse.features.length === 0) {
        throw new Error('No weather stations found near the specified location')
      }

      const nearestStation = stationsResponse.features[0]
      
      // Get recent observations to calculate daily min/max
      const observationsResponse = await this.getRecentObservations(nearestStation.properties.stationIdentifier, 24)
      
      if (!observationsResponse.features || observationsResponse.features.length === 0) {
        throw new Error('No weather observations available from the nearest station')
      }

      const observations = observationsResponse.features
      const latestObservation = observations[0].properties

      // Calculate daily temperature extremes from recent observations
      const temperatures = observations
        .map(obs => this.convertTemperature(obs.properties.temperature.value, obs.properties.temperature.unitCode))
        .filter(temp => temp !== null) as number[]

      const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 
        this.convertTemperature(latestObservation.temperature.value, latestObservation.temperature.unitCode) || 20

      const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 
        this.convertTemperature(latestObservation.temperature.value, latestObservation.temperature.unitCode) || 10

      // Get current conditions
      const currentTemp = this.convertTemperature(latestObservation.temperature.value, latestObservation.temperature.unitCode) || 15
      const dewpoint = this.convertTemperature(latestObservation.dewpoint.value, latestObservation.dewpoint.unitCode)
      
      // Calculate relative humidity
      let relativeHumidity = latestObservation.relativeHumidity.value
      if (relativeHumidity === null && dewpoint !== null) {
        relativeHumidity = this.calculateRelativeHumidity(currentTemp, dewpoint)
      }
      
      // Convert wind speed
      const windSpeed = this.convertWindSpeed(latestObservation.windSpeed.value, latestObservation.windSpeed.unitCode) || 2

      const processedData: ProcessedWeatherData = {
        maxTemperature: maxTemp,
        minTemperature: minTemp,
        relativeHumidity: relativeHumidity || 50, // Default to 50% if unavailable
        windSpeed: windSpeed,
        solarRadiation: undefined, // Solar radiation not available from weather.gov, needs to be estimated
        station: {
          id: nearestStation.properties.stationIdentifier,
          name: nearestStation.properties.name,
          latitude: nearestStation.geometry.coordinates[1],
          longitude: nearestStation.geometry.coordinates[0],
          elevation: nearestStation.properties.elevation.value
        },
        timestamp: latestObservation.timestamp
      }

      return processedData
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get weather data: ${error.message}`)
      }
      throw new Error('Failed to get weather data: Unknown error')
    }
  }

  /**
   * Estimate solar radiation based on location and date
   * This is a simplified estimation - in a real application, you'd want to use
   * a more sophisticated model or additional data sources
   */
  estimateSolarRadiation(latitude: number, dayOfYear: number): number {
    // Simplified solar radiation estimation (MJ/m²/day)
    // This is a very basic approximation
    const solarConstant = 1367 // W/m²
    const latRad = latitude * Math.PI / 180
    const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * Math.PI / 180
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination))
    
    const extraterrestrialRadiation = (24 * 60 / Math.PI) * solarConstant * 
      (hourAngle * Math.sin(latRad) * Math.sin(declination) + 
       Math.cos(latRad) * Math.cos(declination) * Math.sin(hourAngle)) / 1000000
    
    // Assume 70% of extraterrestrial radiation reaches surface (simplified)
    return extraterrestrialRadiation * 0.7
  }
}

export const weatherService = new WeatherService()
export default weatherService