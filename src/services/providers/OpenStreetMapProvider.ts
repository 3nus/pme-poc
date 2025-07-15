import type { GeocodeResult } from '@/types/geocoding'
import type { GeocodingProvider } from '../geocodingService'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
    postcode?: string
  }
}

export class OpenStreetMapProvider implements GeocodingProvider {
  readonly name = 'OpenStreetMap (Nominatim)'
  readonly priority = 5
  
  private readonly nominatimBaseURL = 'https://nominatim.openstreetmap.org'
  private readonly userAgent = 'PME-POC Weather App (contact@example.com)'

  isAvailable(): boolean {
    // OpenStreetMap is always available as it's free and doesn't require an API key
    return true
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async searchLocations(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    try {
      const encodedQuery = encodeURIComponent(query.trim())
      const url = `${this.nominatimBaseURL}/search?` +
        `q=${encodedQuery}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=${limit}&` +
        `countrycodes=us&` +
        `accept-language=en`

      const results = await this.makeRequest<NominatimResult[]>(url)

      if (!results || results.length === 0) {
        return []
      }

      return results.map((result): GeocodeResult => ({
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
      console.error('OpenStreetMap search failed:', error)
      throw error
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    try {
      const url = `${this.nominatimBaseURL}/reverse?` +
        `lat=${latitude}&` +
        `lon=${longitude}&` +
        `format=json&` +
        `addressdetails=1`

      const result = await this.makeRequest<NominatimResult>(url)

      if (!result) {
        throw new Error('No address found for the provided coordinates')
      }

      return {
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
    } catch (error) {
      console.error('OpenStreetMap reverse geocoding failed:', error)
      throw error
    }
  }
}