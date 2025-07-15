import type { GeocodeResult } from '@/types/geocoding'
import type { GeocodingProvider } from '../geocodingService'

export class GooglePlacesProvider implements GeocodingProvider {
  readonly name = 'Google Places (Modern API)'
  readonly priority = 10

  private isLoaded = false
  private loadingPromise: Promise<void> | null = null

  isAvailable(): boolean {
    return !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && 
           import.meta.env.VITE_GOOGLE_MAPS_API_KEY !== 'demo'
  }

  private async ensureApiLoaded(): Promise<void> {
    if (this.isLoaded) return
    
    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = this.loadGoogleMapsApi()
    await this.loadingPromise
  }

  private async loadGoogleMapsApi(): Promise<void> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    console.log('🔑 Google Maps API Key available:', !!apiKey && apiKey !== 'demo')
    
    if (!apiKey || apiKey === 'demo') {
      console.warn('❌ Google Places API key not configured or is demo key')
      throw new Error('Google Places API key not configured')
    }

    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      console.log('✅ Google Maps already loaded')
      this.isLoaded = true
      return
    }

    console.log('📡 Loading Google Maps JavaScript API...')
    
    // Set up a global callback function
    const callbackName = `googleMapsCallback_${Date.now()}`
    
    return new Promise((resolve, reject) => {
      // Create global callback function
      ;(window as unknown as Record<string, unknown>)[callbackName] = () => {
        console.log('📥 Google Maps callback triggered')
        
        // Wait a bit for the libraries to initialize
        setTimeout(() => {
          if (window.google?.maps?.places) {
            console.log('✅ Google Maps Places library ready')
            this.isLoaded = true
            delete (window as unknown as Record<string, unknown>)[callbackName] // Clean up
            resolve()
          } else {
            console.error('❌ Google Maps Places library not available after callback')
            delete (window as unknown as Record<string, unknown>)[callbackName] // Clean up
            reject(new Error('Google Maps Places library failed to load'))
          }
        }, 100)
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`
      script.async = true
      script.defer = true

      script.onerror = (error) => {
        console.error('❌ Failed to load Google Maps JavaScript API:', error)
        delete (window as unknown as Record<string, unknown>)[callbackName] // Clean up
        reject(new Error('Failed to load Google Maps JavaScript API'))
      }

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (!this.isLoaded) {
          console.error('❌ Google Maps API loading timed out')
          delete (window as unknown as Record<string, unknown>)[callbackName] // Clean up
          reject(new Error('Google Maps API loading timed out'))
        }
      }, 10000) // 10 second timeout

      document.head.appendChild(script)
    })
  }

  async searchLocations(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    if (!query || query.trim().length < 2) {
      return []
    }


    try {
      await this.ensureApiLoaded()

      // Try using the new AutocompleteSuggestion API first
      if (google.maps.places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        const request = {
          input: query.trim(),
          includedRegionCodes: ['US']
        }

        const response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)

        if (response?.suggestions?.length > 0) {
          
          const results: GeocodeResult[] = []
          const limitedSuggestions = response.suggestions.slice(0, limit)

          for (const suggestion of limitedSuggestions) {
            if (suggestion.placePrediction?.text?.text) {
              const basicResult = this.createBasicResultFromSuggestion(suggestion)
              if (basicResult) {
                results.push(basicResult)
              }
            }
          }

          return results
        }
      }

      // Fallback to AutocompleteService if new API doesn't work
      return await this.searchWithAutocompleteService(query, limit)

    } catch (error) {
      console.error('❌ Google Places search failed:', error)
      throw error
    }
  }

  private createBasicResultFromSuggestion(suggestion: any): GeocodeResult | null {
    if (suggestion.placePrediction?.text?.text) {
      const text = suggestion.placePrediction.text.text
      const placeId = suggestion.placePrediction.placeId
      
      return {
        latitude: 0, // Will be fetched on demand
        longitude: 0, // Will be fetched on demand
        formattedAddress: text,
        addressComponents: {},
        _placeId: placeId
      }
    }
    return null
  }

  private async searchWithAutocompleteService(query: string, limit: number): Promise<GeocodeResult[]> {
    return new Promise((resolve) => {
      const service = new google.maps.places.AutocompleteService()
      
      const request = {
        input: query.trim(),
        componentRestrictions: { country: 'us' },
        types: ['geocode']
      }


      service.getPlacePredictions(request, (predictions, status) => {

        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          // Convert predictions to basic results (without coordinates)
          const results: GeocodeResult[] = predictions.slice(0, limit).map(prediction => ({
            latitude: 0, // Will be fetched on demand
            longitude: 0, // Will be fetched on demand
            formattedAddress: prediction.description,
            addressComponents: {},
            _placeId: prediction.place_id
          }))

          resolve(results)
        } else {
          resolve([])
        }
      })
    })
  }

  // New method to get coordinates for a specific address when selected
  async getCoordinatesForAddress(address: string, placeId?: string): Promise<{ latitude: number; longitude: number } | null> {
    console.log('🎯 getCoordinatesForAddress called with:', { address, placeId })
    
    try {
      console.log('🔄 Ensuring API is loaded...')
      await this.ensureApiLoaded()
      console.log('✅ API loaded, checking Geocoder availability...')
      
      if (!google?.maps?.Geocoder) {
        console.error('❌ Google Maps Geocoder not available')
        throw new Error('Google Maps Geocoder not available')
      }
      
      console.log('✅ Geocoder available, creating instance...')
      const geocoder = new google.maps.Geocoder()
      
      // Prepare geocoding request
      const request: any = {}
      
      if (placeId) {
        request.placeId = placeId
      } else {
        request.address = address
      }

      console.log('📤 Geocoding Request:', request)
      
      const response = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode(request, (results, status) => {
          console.log('📥 Geocoding Response:', { status, results })
          
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            resolve(results)
          } else {
            reject(new Error(`Geocoding failed: ${status}`))
          }
        })
      })

      const result = response[0]
      const location = result.geometry.location
      
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng

      if (typeof lat === 'number' && typeof lng === 'number') {
        return { latitude: lat, longitude: lng }
      }

      return null
    } catch (error) {
      console.error('❌ Failed to get coordinates:', error)
      return null
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    await this.ensureApiLoaded()

    try {
      const geocoder = new google.maps.Geocoder()
      const latlng = { lat: latitude, lng: longitude }

      const response = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode({ location: latlng }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            resolve(results)
          } else {
            reject(new Error(`Reverse geocoding failed: ${status}`))
          }
        })
      })

      const result = response[0]
      return {
        latitude,
        longitude,
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components)
      }
    } catch (error) {
      console.error('Google reverse geocoding failed:', error)
      throw error
    }
  }

  private parseAddressComponents(components: any[]): {
    street?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  } {
    const result = {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    }

    if (!components) return result

    for (const component of components) {
      const types = component.types || []
      const longText = component.longText || component.long_name || ''
      const shortText = component.shortText || component.short_name || ''

      if (types.includes('street_number')) {
        result.street = longText
      } else if (types.includes('route')) {
        result.street = result.street ? `${result.street} ${longText}` : longText
      } else if (types.includes('locality') || types.includes('sublocality')) {
        result.city = longText
      } else if (types.includes('administrative_area_level_1')) {
        result.state = shortText
      } else if (types.includes('country')) {
        result.country = longText
      } else if (types.includes('postal_code')) {
        result.postalCode = longText
      }
    }

    return result
  }
}

// Global type definitions for Google Maps
declare global {
  interface Window {
    google: {
      maps: {
        places: {
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions(request: {
              input: string
              includedRegionCodes?: string[]
            }): Promise<{
              suggestions: Array<{
                placePrediction?: {
                  placeId: string
                  text: { text: string }
                  structuredFormat?: {
                    mainText?: { text: string }
                    secondaryText?: { text: string }
                  }
                }
              }>
            }>
          }
          AutocompleteService: new () => {
            getPlacePredictions(
              request: {
                input: string
                componentRestrictions?: { country: string }
                types?: string[]
              },
              callback: (predictions: Array<{
                place_id: string
                description: string
                structured_formatting: {
                  main_text: string
                  secondary_text: string
                }
              }> | null, status: string) => void
            ): void
          }
          PlacesServiceStatus: {
            OK: string
            ZERO_RESULTS: string
            OVER_QUERY_LIMIT: string
            REQUEST_DENIED: string
            INVALID_REQUEST: string
            NOT_FOUND: string
          }
        }
        Geocoder: new () => {
          geocode(
            request: { location: { lat: number; lng: number } } | { address: string } | { placeId: string },
            callback: (results: any[] | null, status: string) => void
          ): void
        }
        GeocoderStatus: {
          OK: string
          ZERO_RESULTS: string
          OVER_QUERY_LIMIT: string
          REQUEST_DENIED: string
          INVALID_REQUEST: string
        }
      }
    }
  }
  
  const google: Window['google']
}

// Extend GeocodeResult type to include optional placeId
declare module '@/types/geocoding' {
  interface GeocodeResult {
    _placeId?: string
  }
}