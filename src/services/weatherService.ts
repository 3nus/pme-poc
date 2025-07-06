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
   * Get point metadata for a given location
   * @param location - Latitude and longitude
   * @returns Promise with point data including forecast URLs
   */
  async getPointData(location: Location): Promise<any> {
    const lat = location.latitude.toFixed(4)
    const lon = location.longitude.toFixed(4)
    
    const response = await this.axiosInstance.get(
      `/points/${lat},${lon}`
    )
    return response.data
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
          limit
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
   * Convert temperature from grid data format
   */
  private convertTemperatureFromGrid(value: number | null, uom: string): number | null {
    if (value === null) return null
    
    if (uom === 'wmoUnit:degC') {
      return value
    }
    if (uom === 'wmoUnit:degF') {
      return this.fahrenheitToCelsius(value)
    }
    if (uom === 'wmoUnit:K') {
      return value - 273.15 // Kelvin to Celsius
    }
    return value
  }

  /**
   * Convert wind speed from grid data format
   */
  private convertWindSpeedFromGrid(value: number | null, uom: string): number | null {
    if (value === null) return null
    
    if (uom === 'wmoUnit:km_h-1') {
      return value / 3.6 // km/h to m/s
    }
    if (uom === 'wmoUnit:mi_h-1') {
      return value * 0.44704 // mph to m/s
    }
    if (uom === 'wmoUnit:m_s-1') {
      return value // Already in m/s
    }
    return value
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
      // Get point metadata first (this is the correct weather.gov API flow)
      const pointData = await this.getPointData(location)
      
      if (!pointData || !pointData.properties) {
        throw new Error('No weather data available for the specified location')
      }

      // Get gridpoints data which contains current observations
      const gridX = pointData.properties.gridX
      const gridY = pointData.properties.gridY
      const gridId = pointData.properties.gridId
      
      if (!gridX || !gridY || !gridId) {
        throw new Error('Invalid grid data from weather service')
      }

      // Get current conditions from gridpoints
      const gridResponse = await this.axiosInstance.get(
        `/gridpoints/${gridId}/${gridX},${gridY}`
      )
      
      if (!gridResponse.data || !gridResponse.data.properties) {
        throw new Error('No current weather data available')
      }

      const gridData = gridResponse.data.properties
      
      // Extract temperature data
      const tempData = gridData.temperature
      const currentTemp = tempData && tempData.values && tempData.values.length > 0 
        ? this.convertTemperatureFromGrid(tempData.values[0].value, tempData.uom) 
        : 20

      // For daily min/max, we'll use a simple estimation since gridpoints gives us current conditions
      const maxTemp = currentTemp + 5
      const minTemp = currentTemp - 5

      // Extract humidity data
      const humidityData = gridData.relativeHumidity
      const relativeHumidity = humidityData && humidityData.values && humidityData.values.length > 0
        ? humidityData.values[0].value
        : 50

      // Extract wind speed data
      const windData = gridData.windSpeed
      const windSpeed = windData && windData.values && windData.values.length > 0
        ? this.convertWindSpeedFromGrid(windData.values[0].value, windData.uom)
        : 2

      const processedData: ProcessedWeatherData = {
        maxTemperature: maxTemp,
        minTemperature: minTemp,
        relativeHumidity: relativeHumidity,
        windSpeed: windSpeed,
        solarRadiation: undefined, // Solar radiation not available from weather.gov, needs to be estimated
        station: {
          id: gridId,
          name: `Weather Grid ${gridId} (${gridX},${gridY})`,
          latitude: location.latitude,
          longitude: location.longitude,
          elevation: pointData.properties.relativeLocation?.properties?.distance?.value || 0
        },
        timestamp: new Date().toISOString()
      }

      return processedData
      
    } catch (error) {
      console.error('Weather service error:', error)
      
      if (error instanceof Error) {
        // Check for CORS or network errors
        if (error.message.includes('CORS') || error.message.includes('Network Error') || error.message.includes('ERR_NETWORK')) {
          throw new Error('Failed to get weather data: CORS error - weather.gov API may not be accessible from browser. This API typically requires server-side access.')
        }
        throw new Error(`Failed to get weather data: ${error.message}`)
      }
      
      // Check if it's our custom WeatherServiceError
      if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
        const weatherError = error as WeatherServiceError
        throw new Error(`Failed to get weather data: ${weatherError.message} (Code: ${weatherError.code})`)
      }
      
      throw new Error('Failed to get weather data: Unknown error - check browser console for details')
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