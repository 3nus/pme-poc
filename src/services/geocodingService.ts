import type { GeocodeResult } from '@/types/geocoding'
import { GooglePlacesProvider } from './providers/GooglePlacesProvider'
import { OpenStreetMapProvider } from './providers/OpenStreetMapProvider'

export interface GeocodingService {
  searchLocations(query: string, limit?: number): Promise<GeocodeResult[]>
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult>
}

export interface GeocodingProvider extends GeocodingService {
  readonly name: string
  readonly priority: number
  isAvailable(): boolean
}

class GeocodeServiceManager implements GeocodingService {
  private providers: GeocodingProvider[] = [
    new GooglePlacesProvider(),
    new OpenStreetMapProvider()
  ]

  constructor() {
    // Sort providers by priority (higher priority first)
    this.providers.sort((a, b) => b.priority - a.priority)
  }

  private getAvailableProvider(): GeocodingProvider {
    const provider = this.providers.find(p => p.isAvailable())
    if (!provider) {
      throw new Error('No geocoding providers available')
    }
    return provider
  }

  async searchLocations(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    const provider = this.getAvailableProvider()
    console.log(`Using ${provider.name} for location search`)
    
    try {
      return await provider.searchLocations(query, limit)
    } catch (error) {
      console.warn(`${provider.name} failed, trying next provider...`)
      
      // Try next available provider
      const remainingProviders = this.providers.filter(p => p !== provider && p.isAvailable())
      if (remainingProviders.length === 0) {
        throw error
      }
      
      const fallbackProvider = remainingProviders[0]
      console.log(`Falling back to ${fallbackProvider.name}`)
      return await fallbackProvider.searchLocations(query, limit)
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    const provider = this.getAvailableProvider()
    console.log(`Using ${provider.name} for reverse geocoding`)
    
    try {
      return await provider.reverseGeocode(latitude, longitude)
    } catch (error) {
      console.warn(`${provider.name} failed, trying next provider...`)
      
      // Try next available provider
      const remainingProviders = this.providers.filter(p => p !== provider && p.isAvailable())
      if (remainingProviders.length === 0) {
        throw error
      }
      
      const fallbackProvider = remainingProviders[0]
      console.log(`Falling back to ${fallbackProvider.name}`)
      return await fallbackProvider.reverseGeocode(latitude, longitude)
    }
  }

  getActiveProvider(): string {
    const provider = this.getAvailableProvider()
    return provider.name
  }

  listAvailableProviders(): string[] {
    return this.providers.filter(p => p.isAvailable()).map(p => p.name)
  }

  getProviders(): GeocodingProvider[] {
    return this.providers
  }
}

export const geocodingService = new GeocodeServiceManager()
export default geocodingService