import axios from 'axios'
import type {
  WeatherStationsResponse,
  WeatherObservationsResponse,
  ProcessedWeatherData,
  Location,
  WeatherServiceError,
  WeatherDataSource,
} from '@/types/weather'

class WeatherService {
  private readonly baseURL = 'https://api.weather.gov'
  private readonly userAgent = 'PME-POC Weather App (contact@example.com)'

  private axiosInstance = axios.create({
    baseURL: this.baseURL,
    timeout: 10000,
    headers: {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
    },
  })

  constructor() {
    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const weatherError: WeatherServiceError = {
          message: error.message || 'Weather service error',
          code: error.response?.status?.toString() || 'UNKNOWN',
          details: error.response?.data,
        }
        throw weatherError
      },
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

    const response = await this.axiosInstance.get(`/points/${lat},${lon}`)
    return response.data
  }

  /**
   * Find weather stations near a given location
   * @param location - Latitude and longitude
   * @param limit - Maximum number of stations to return
   * @returns Promise<WeatherStationsResponse>
   */
  async findNearbyStations(
    location: Location,
    limit: number = 10,
  ): Promise<WeatherStationsResponse> {
    const response = await this.axiosInstance.get<WeatherStationsResponse>(`/stations`, {
      params: {
        limit,
      },
    })
    return response.data
  }

  /**
   * Get the latest observation from a weather station
   * @param stationId - Weather station ID
   * @returns Promise<WeatherObservationsResponse>
   */
  async getLatestObservation(stationId: string): Promise<WeatherObservationsResponse> {
    const response = await this.axiosInstance.get<WeatherObservationsResponse>(
      `/stations/${stationId}/observations/latest`,
    )
    return response.data
  }

  /**
   * Get recent observations from a weather station
   * @param stationId - Weather station ID
   * @param limit - Number of observations to retrieve
   * @returns Promise<WeatherObservationsResponse>
   */
  async getRecentObservations(
    stationId: string,
    limit: number = 24,
  ): Promise<WeatherObservationsResponse> {
    const response = await this.axiosInstance.get<WeatherObservationsResponse>(
      `/stations/${stationId}/observations`,
      {
        params: { limit },
      },
    )
    return response.data
  }

  /**
   * Convert Celsius to Fahrenheit
   */
  private celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9) / 5 + 32
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  private fahrenheitToCelsius(fahrenheit: number): number {
    return ((fahrenheit - 32) * 5) / 9
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

    const alpha = Math.log(
      Math.exp((a * dewpoint) / (b + dewpoint)) / Math.exp((a * temperature) / (b + temperature)),
    )
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
      const lat = location.latitude.toFixed(4)
      const lon = location.longitude.toFixed(4)
      const pointDataUrl = `${this.baseURL}/points/${lat},${lon}`
      const pointData = await this.getPointData(location)

      if (!pointData || !pointData.properties) {
        throw new Error('No weather data available for the specified location')
      }

      // Get gridpoints data which contains current observations
      const gridX = pointData.properties.gridX
      const gridY = pointData.properties.gridY
      const gridId = pointData.properties.gridId
      const forecastUrl = pointData.properties.forecast

      if (!gridX || !gridY || !gridId || !forecastUrl) {
        throw new Error('Invalid grid data from weather service')
      }

      // Get forecast data for daily min/max temperatures and other averages
      const forecastResponse = await this.axiosInstance.get(forecastUrl)
      
      if (!forecastResponse.data || !forecastResponse.data.properties || !forecastResponse.data.properties.periods) {
        throw new Error('No forecast data available')
      }

      // Get today's forecast periods (day and night)
      const periods = forecastResponse.data.properties.periods
      const todayPeriods = periods.slice(0, 2) // Today's day and night periods
      
      // Extract temperatures from today's periods with source data
      // Note: weather.gov forecast API returns temperatures in Fahrenheit for US locations
      const temperatureSources = todayPeriods.map((period: any) => ({
        value: period.temperature, // Keep original F value for display
        valueCelsius: this.fahrenheitToCelsius(period.temperature), // Convert to C for calculations
        date: period.startTime,
        source: 'NWS Forecast',
        period: period.name,
        url: forecastUrl
      }))
      const temperaturesC = temperatureSources.map((t: any) => t.valueCelsius)
      const maxTemp = Math.max(...temperaturesC) // Max in Celsius
      const minTemp = Math.min(...temperaturesC) // Min in Celsius

      // Extract humidity from today's periods and calculate daily average
      const humidityValues = todayPeriods
        .map((period: any) => period.relativeHumidity?.value || period.relativeHumidity)
        .filter((humidity: any) => humidity !== null && humidity !== undefined && !isNaN(humidity))
      
      const avgHumidity = humidityValues.length > 0 
        ? humidityValues.reduce((sum: number, val: number) => sum + val, 0) / humidityValues.length
        : null

      // Humidity sources with details
      const humiditySources = todayPeriods
        .map((period: any) => {
          const humidity = period.relativeHumidity?.value || period.relativeHumidity
          return humidity !== null && humidity !== undefined && !isNaN(humidity) ? {
            value: humidity,
            date: period.startTime,
            source: 'NWS Forecast',
            period: period.name,
            url: forecastUrl
          } : null
        })
        .filter((item: any) => item !== null)

      // Extract wind speed from today's periods and calculate daily average
      const windSpeedSources = todayPeriods
        .map((period: any) => {
          const windSpeedText = period.windSpeed || ''
          // Extract numeric value from strings like "10 mph", "15 to 20 mph", etc.
          const match = windSpeedText.match(/(\d+)/)
          const windSpeedMph = match ? parseInt(match[1]) : null
          return windSpeedMph !== null ? {
            value: windSpeedMph * 0.44704, // Convert to m/s
            date: period.startTime,
            source: 'NWS Forecast',
            period: period.name,
            url: forecastUrl
          } : null
        })
        .filter((item: any) => item !== null)
      
      const windSpeedValues = windSpeedSources.map((w: any) => w.value)
      const avgWindSpeed = windSpeedValues.length > 0 
        ? windSpeedValues.reduce((sum: number, val: number) => sum + val, 0) / windSpeedValues.length
        : null

      // Use forecast values if available, otherwise fall back to gridpoints data
      let relativeHumidity: number
      let windSpeed: number
      let finalHumiditySources = humiditySources
      
      if (avgHumidity !== null) {
        relativeHumidity = avgHumidity
      } else {
        // Fallback to gridpoints current humidity data
        const gridResponse = await this.axiosInstance.get(`/gridpoints/${gridId}/${gridX},${gridY}`)
        const gridData = gridResponse.data.properties
        const humidityData = gridData.relativeHumidity
        const gridHumidity = humidityData && humidityData.values && humidityData.values.length > 0
          ? humidityData.values[0].value
          : 50 // Final fallback
        
        relativeHumidity = gridHumidity
        
        // Add gridpoints humidity source to the sources array
        finalHumiditySources = [{
          value: gridHumidity,
          date: new Date().toISOString(),
          source: gridHumidity === 50 ? 'Default Value (50%)' : 'NWS Gridpoint Data',
          period: 'Current',
          url: `${this.baseURL}/gridpoints/${gridId}/${gridX},${gridY}`
        }]
      }

      if (avgWindSpeed !== null) {
        windSpeed = avgWindSpeed
      } else {
        // Fallback to gridpoints current wind speed data
        const gridResponse = await this.axiosInstance.get(`/gridpoints/${gridId}/${gridX},${gridY}`)
        const gridData = gridResponse.data.properties
        const windData = gridData.windSpeed
        const windSpeedValue = windData && windData.values && windData.values.length > 0
          ? this.convertWindSpeedFromGrid(windData.values[0].value, windData.uom)
          : 2 // Final fallback: 2 m/s
        windSpeed = windSpeedValue || 2
      }

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
          elevation: pointData.properties.elevation?.value || 0,
        },
        timestamp: new Date().toISOString(),
        sourceData: {
          temperatures: temperatureSources,
          humidity: finalHumiditySources,
          windSpeed: windSpeedSources,
          forecastDate: todayPeriods[0]?.startTime || new Date().toISOString(),
          forecastUrl: forecastUrl,
          pointDataUrl: pointDataUrl
        }
      }

      return processedData
    } catch (error) {
      console.error('Weather service error:', error)

      if (error instanceof Error) {
        // Check for CORS or network errors
        if (
          error.message.includes('CORS') ||
          error.message.includes('Network Error') ||
          error.message.includes('ERR_NETWORK')
        ) {
          throw new Error(
            'Failed to get weather data: CORS error - weather.gov API may not be accessible from browser. This API typically requires server-side access.',
          )
        }
        throw new Error(`Failed to get weather data: ${error.message}`)
      }

      // Check if it's our custom WeatherServiceError
      if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
        const weatherError = error as WeatherServiceError
        throw new Error(
          `Failed to get weather data: ${weatherError.message} (Code: ${weatherError.code})`,
        )
      }

      throw new Error(
        'Failed to get weather data: Unknown error - check browser console for details',
      )
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
    const latRad = (latitude * Math.PI) / 180
    const declination = (23.45 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365) * Math.PI) / 180
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination))

    const extraterrestrialRadiation =
      (((24 * 60) / Math.PI) *
        solarConstant *
        (hourAngle * Math.sin(latRad) * Math.sin(declination) +
          Math.cos(latRad) * Math.cos(declination) * Math.sin(hourAngle))) /
      1000000

    // Assume 70% of extraterrestrial radiation reaches surface (simplified)
    return extraterrestrialRadiation * 0.7
  }
}

export const weatherService = new WeatherService()
export default weatherService
