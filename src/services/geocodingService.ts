import axios from 'axios'
import type {
  Address,
  GeocodeResult,
  GeocodingServiceError,
  NominatimResult
} from '@/types/geocoding'

class GeocodingService {
  private readonly nominatimBaseURL = 'https://nominatim.openstreetmap.org'
  private readonly userAgent = 'PME-POC Weather App (contact@example.com)'

  private axiosInstance = axios.create({
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
        const geocodingError: GeocodingServiceError = {
          message: error.message || 'Geocoding service error',
          code: error.response?.status?.toString() || 'UNKNOWN',
          details: error.response?.data
        }
        throw geocodingError
      }
    )
  }

  /**
   * Geocode an address using OpenStreetMap Nominatim (free service)
   * @param address - Address components
   * @returns Promise<GeocodeResult>
   */
  async geocodeAddress(address: Address): Promise<GeocodeResult> {
    try {
      // Build query string from address components
      const queryParts: string[] = []
      
      if (address.street) {
        queryParts.push(address.street)
      }
      if (address.city) {
        queryParts.push(address.city)
      }
      if (address.state) {
        queryParts.push(address.state)
      }
      if (address.country) {
        queryParts.push(address.country)
      } else {
        queryParts.push('United States') // Default to US
      }
      
      const query = queryParts.join(', ')
      
      if (!query.trim()) {
        throw new Error('Address is required for geocoding')
      }

      const response = await this.axiosInstance.get<NominatimResult[]>(
        `${this.nominatimBaseURL}/search`,
        {
          params: {
            q: query,
            format: 'json',
            addressdetails: 1,
            limit: 1,
            countrycodes: address.country === 'United States' ? 'us' : undefined
          }
        }
      )

      if (!response.data || response.data.length === 0) {
        throw new Error('No results found for the provided address')
      }

      const result = response.data[0]
      
      const geocodeResult: GeocodeResult = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        addressComponents: {
          street: result.address?.road || result.address?.house_number 
            ? `${result.address.house_number || ''} ${result.address.road || ''}`.trim()
            : undefined,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postalCode: result.address?.postcode
        }
      }

      return geocodeResult

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Geocoding failed: ${error.message}`)
      }
      throw new Error('Geocoding failed: Unknown error')
    }
  }

  /**
   * Reverse geocode coordinates to get address
   * @param latitude - Latitude coordinate
   * @param longitude - Longitude coordinate
   * @returns Promise<GeocodeResult>
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    try {
      const response = await this.axiosInstance.get<NominatimResult>(
        `${this.nominatimBaseURL}/reverse`,
        {
          params: {
            lat: latitude,
            lon: longitude,
            format: 'json',
            addressdetails: 1
          }
        }
      )

      if (!response.data) {
        throw new Error('No address found for the provided coordinates')
      }

      const result = response.data
      
      const geocodeResult: GeocodeResult = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        addressComponents: {
          street: result.address?.road || result.address?.house_number 
            ? `${result.address.house_number || ''} ${result.address.road || ''}`.trim()
            : undefined,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postalCode: result.address?.postcode
        }
      }

      return geocodeResult

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Reverse geocoding failed: ${error.message}`)
      }
      throw new Error('Reverse geocoding failed: Unknown error')
    }
  }

  /**
   * Validate address components
   * @param address - Address to validate
   * @returns boolean
   */
  validateAddress(address: Address): boolean {
    return !!(address.city && address.state)
  }

  /**
   * Format address for display
   * @param address - Address components
   * @returns string
   */
  formatAddress(address: Address): string {
    const parts: string[] = []
    
    if (address.street) parts.push(address.street)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    if (address.postalCode) parts.push(address.postalCode)
    
    return parts.join(', ')
  }

  /**
   * Search for locations with autocomplete suggestions
   * @param query - Search query string
   * @param limit - Maximum number of results (default: 5)
   * @returns Promise<GeocodeResult[]>
   */
  async searchLocations(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    try {
      const response = await this.axiosInstance.get<NominatimResult[]>(
        `${this.nominatimBaseURL}/search`,
        {
          params: {
            q: query.trim(),
            format: 'json',
            addressdetails: 1,
            limit: limit,
            countrycodes: 'us', // Limit to US for weather.gov compatibility
            'accept-language': 'en'
          }
        }
      )

      if (!response.data || response.data.length === 0) {
        return []
      }

      return response.data.map((result): GeocodeResult => ({
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        addressComponents: {
          street: result.address?.road || result.address?.house_number 
            ? `${result.address.house_number || ''} ${result.address.road || ''}`.trim()
            : undefined,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postalCode: result.address?.postcode
        }
      }))

    } catch (error) {
      console.warn('Location search failed:', error)
      return []
    }
  }
}

export const geocodingService = new GeocodingService()
export default geocodingService