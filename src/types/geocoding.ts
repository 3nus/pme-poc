// Geocoding service types

export interface Address {
  street?: string
  city: string
  state: string
  country?: string
  postalCode?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress: string
  addressComponents: {
    street?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }
}

export interface GeocodingServiceError {
  message: string
  code: string
  details?: Record<string, unknown>
}

// For free geocoding services like OpenStreetMap Nominatim
export interface NominatimResult {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  boundingbox: string[]
  lat: string
  lon: string
  display_name: string
  class: string
  type: string
  importance: number
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    county?: string
    state?: string
    postcode?: string
    country?: string
    country_code?: string
  }
}

export interface LocationInputMode {
  type: 'manual' | 'address'
}