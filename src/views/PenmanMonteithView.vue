<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import weatherService from '@/services/weatherService'
import geocodingService from '@/services/geocodingService'
import type { ProcessedWeatherData, Location } from '@/types/weather'
import type { Address, GeocodeResult, LocationInputMode } from '@/types/geocoding'

// Meteorological Data (stored in base units - Celsius for temp, meters for altitude, m/s for wind)
const maxTemp = ref<number>(0)
const minTemp = ref<number>(0)
const baseMaxTemp = ref<number>(0) // Always in Celsius
const baseMinTemp = ref<number>(0) // Always in Celsius
const relativeHumidity = ref<number>(0)
const windSpeed = ref<number>(0)
const baseWindSpeed = ref<number>(0) // Always in m/s
const solarRadiation = ref<number>(0)

// Site-Specific Data
const altitude = ref<number>(0)
const baseAltitude = ref<number>(0) // Always in meters
const latitude = ref<number>(0)

// Key Parameters (calculated or estimated)
const netRadiation = ref<number>(0)
const soilHeatFlux = ref<number>(0)
const vaporPressureDeficit = ref<number>(0)
const psychrometricConstant = ref<number>(0)
const slopeVaporPressure = ref<number>(0)

// Resistance Factors
const aerodynamicResistance = ref<number>(0)
const surfaceResistance = ref<number>(0)

// Crop Factors (optional)
const cropCoefficient = ref<number>(1)
const stressCoefficient = ref<number>(1)

// Location input mode
const locationMode = ref<LocationInputMode>({ type: 'address' })

// Unit preferences
const temperatureUnit = ref<'C' | 'F'>('C')
const altitudeUnit = ref<'m' | 'ft'>('m')
const windSpeedUnit = ref<'m/s' | 'mph'>('m/s')

// Manual location input
const locationLat = ref<number>(0)
const locationLon = ref<number>(0)

// Address-based location input
const addressInput = ref<Address>({
  street: '',
  city: '',
  state: '',
  country: 'United States',
})

// Location services state
const weatherData = ref<ProcessedWeatherData | null>(null)
const geocodeResult = ref<GeocodeResult | null>(null)
const loadingWeather = ref<boolean>(false)
const loadingGeocode = ref<boolean>(false)
const loadingLocation = ref<boolean>(false)
const weatherError = ref<string>('')
const geocodeError = ref<string>('')
const locationError = ref<string>('')

// Panel state
const locationPanelMinimized = ref<boolean>(false)

// Modal state
const showTemperatureModal = ref<boolean>(false)
const showUnitsModal = ref<boolean>(false)

// Source data visibility
const showSourceData = ref<boolean>(false)

// Address geocoding
const geocodeAddress = async () => {
  if (!geocodingService.validateAddress(addressInput.value)) {
    geocodeError.value = 'Please enter at least city and state'
    return
  }

  loadingGeocode.value = true
  geocodeError.value = ''

  try {
    const result = await geocodingService.geocodeAddress(addressInput.value)
    geocodeResult.value = result

    // Update manual lat/lon fields
    locationLat.value = result.latitude
    locationLon.value = result.longitude
  } catch (error) {
    geocodeError.value = error instanceof Error ? error.message : 'Failed to geocode address'
    geocodeResult.value = null
  } finally {
    loadingGeocode.value = false
  }
}

// Weather data fetching
const fetchWeatherData = async () => {
  let targetLat = locationLat.value
  let targetLon = locationLon.value

  // If in address mode and no coordinates, try to geocode first
  if (locationMode.value.type === 'address' && (targetLat === 0 || targetLon === 0)) {
    await geocodeAddress()
    targetLat = locationLat.value
    targetLon = locationLon.value
  }

  if (targetLat === 0 || targetLon === 0) {
    weatherError.value = 'Please provide valid location coordinates or address'
    return
  }

  loadingWeather.value = true
  weatherError.value = ''

  try {
    const location: Location = {
      latitude: targetLat,
      longitude: targetLon,
    }

    const data = await weatherService.getProcessedWeatherData(location)
    weatherData.value = data

    // Show modal to inform user about temperature source
    showTemperatureModal.value = true

    // Auto-populate base values (always in metric units)
    baseMaxTemp.value = data.maxTemperature
    baseMinTemp.value = data.minTemperature
    baseWindSpeed.value = data.windSpeed
    baseAltitude.value = data.station.elevation
    
    // Set display values using current unit preferences
    maxTemp.value = displayTemperature(data.maxTemperature)
    minTemp.value = displayTemperature(data.minTemperature)
    relativeHumidity.value = data.relativeHumidity
    windSpeed.value = displayWindSpeed(data.windSpeed)
    altitude.value = displayAltitude(data.station.elevation)
    latitude.value = data.station.latitude

    // Estimate solar radiation
    const dayOfYear = new Date().getDayOfYear()
    const estimatedSolarRadiation = weatherService.estimateSolarRadiation(targetLat, dayOfYear)
    solarRadiation.value = estimatedSolarRadiation
  } catch (error) {
    weatherError.value = error instanceof Error ? error.message : 'Failed to fetch weather data'
    weatherData.value = null
  } finally {
    loadingWeather.value = false
  }
}

// Get current location using browser geolocation
const getCurrentLocation = async () => {
  if (!navigator.geolocation) {
    locationError.value = 'Geolocation is not supported by this browser'
    return
  }

  loadingLocation.value = true
  locationError.value = ''

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      })
    })

    // Update coordinates
    locationLat.value = Number(position.coords.latitude.toFixed(6))
    locationLon.value = Number(position.coords.longitude.toFixed(6))

    // Try to reverse geocode to get address
    try {
      const reverseResult = await geocodingService.reverseGeocode(
        position.coords.latitude,
        position.coords.longitude,
      )

      // Update address fields
      addressInput.value = {
        street: reverseResult.addressComponents.street || '',
        city: reverseResult.addressComponents.city || '',
        state: reverseResult.addressComponents.state || '',
        country: reverseResult.addressComponents.country || 'United States',
      }

      geocodeResult.value = reverseResult
    } catch (reverseError) {
      console.warn('Could not reverse geocode current location:', reverseError)
      // Location coordinates are still set, just no address
    }
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationError.value = 'Location access denied. Please enable location permissions.'
          break
        case error.POSITION_UNAVAILABLE:
          locationError.value = 'Location information is unavailable.'
          break
        case error.TIMEOUT:
          locationError.value = 'Location request timed out.'
          break
        default:
          locationError.value = 'An unknown error occurred while getting location.'
          break
      }
    } else {
      locationError.value = 'Failed to get current location'
    }
  } finally {
    loadingLocation.value = false
  }
}

// Toggle location input mode
const toggleLocationMode = () => {
  locationMode.value.type = locationMode.value.type === 'manual' ? 'address' : 'manual'
  // Clear errors when switching modes
  weatherError.value = ''
  geocodeError.value = ''
  locationError.value = ''
}

// Toggle location panel minimized state
const toggleLocationPanel = () => {
  locationPanelMinimized.value = !locationPanelMinimized.value
}

// Temperature conversion functions
const celsiusToFahrenheit = (celsius: number): number => {
  return (celsius * 9) / 5 + 32
}

const fahrenheitToCelsius = (fahrenheit: number): number => {
  return ((fahrenheit - 32) * 5) / 9
}

// Altitude conversion functions
const metersToFeet = (meters: number): number => {
  return meters * 3.28084
}

const feetToMeters = (feet: number): number => {
  return feet / 3.28084
}

// Wind speed conversion functions
const msToMph = (ms: number): number => {
  return ms * 2.237
}

const mphToMs = (mph: number): number => {
  return mph / 2.237
}

// Unit display helpers
const displayTemperature = (tempC: number): number => {
  return temperatureUnit.value === 'F' ? celsiusToFahrenheit(tempC) : tempC
}

const displayAltitude = (meters: number): number => {
  return altitudeUnit.value === 'ft' ? metersToFeet(meters) : meters
}

const displayWindSpeed = (ms: number): number => {
  return windSpeedUnit.value === 'mph' ? msToMph(ms) : ms
}

const convertInputTemperature = (inputValue: number): number => {
  return temperatureUnit.value === 'F' ? fahrenheitToCelsius(inputValue) : inputValue
}

const convertInputAltitude = (inputValue: number): number => {
  return altitudeUnit.value === 'ft' ? feetToMeters(inputValue) : inputValue
}

const convertInputWindSpeed = (inputValue: number): number => {
  return windSpeedUnit.value === 'mph' ? mphToMs(inputValue) : inputValue
}

// Units modal functions
const openUnitsModal = () => {
  showUnitsModal.value = true
}

const closeUnitsModal = () => {
  showUnitsModal.value = false
}

// Unit toggle functions (watchers handle the conversion automatically)
const toggleTemperatureUnit = () => {
  temperatureUnit.value = temperatureUnit.value === 'C' ? 'F' : 'C'
}

const toggleAltitudeUnit = () => {
  altitudeUnit.value = altitudeUnit.value === 'm' ? 'ft' : 'm'
}

const toggleWindSpeedUnit = () => {
  windSpeedUnit.value = windSpeedUnit.value === 'm/s' ? 'mph' : 'm/s'
}

// Add getDayOfYear method to Date prototype
declare global {
  interface Date {
    getDayOfYear(): number
  }
}

Date.prototype.getDayOfYear = function () {
  const start = new Date(this.getFullYear(), 0, 0)
  const diff = this.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

// Computed properties for source data access
const hasSourceData = computed(() => weatherData.value?.sourceData != null)
const sourceData = computed(() => weatherData.value?.sourceData)

// Reactive computed properties to sync display values with base values
watch(temperatureUnit, () => {
  maxTemp.value = displayTemperature(baseMaxTemp.value)
  minTemp.value = displayTemperature(baseMinTemp.value)
})

watch(altitudeUnit, () => {
  altitude.value = displayAltitude(baseAltitude.value)
})

watch(windSpeedUnit, () => {
  windSpeed.value = displayWindSpeed(baseWindSpeed.value)
})

// Watch for manual input changes to update base values
watch(maxTemp, (newVal) => {
  baseMaxTemp.value = convertInputTemperature(newVal)
})

watch(minTemp, (newVal) => {
  baseMinTemp.value = convertInputTemperature(newVal)
})

watch(altitude, (newVal) => {
  baseAltitude.value = convertInputAltitude(newVal)
})

watch(windSpeed, (newVal) => {
  baseWindSpeed.value = convertInputWindSpeed(newVal)
})

// For Kieran: Simple ET0 calculation placeholder
const et0 = computed(() => {
  // This is a simplified calculation for demonstration
  // In a real implementation, you'd use the full Penman-Monteith equation

  // Use base values in metric units for calculation
  const avgTemp = (baseMaxTemp.value + baseMinTemp.value) / 2
  const tempFactor = avgTemp * 0.1
  const radiationFactor = solarRadiation.value * 0.05
  const windFactor = baseWindSpeed.value * 0.02
  const humidityFactor = relativeHumidity.value * 0.01

  return Math.max(0, tempFactor + radiationFactor + windFactor - humidityFactor)
})
</script>

<template>
  <main>
    <h1>Penman-Monteith ET₀ Calculator</h1>

    <div class="calculator-container">
      <!-- Weather Data Fetching Section -->
      <div class="input-section location-panel" :class="{ minimized: locationPanelMinimized }">
        <div class="panel-header">
          <h2>Location & Weather Data</h2>
          <div class="header-controls">
            <button
              @click="getCurrentLocation"
              :disabled="loadingLocation"
              class="current-location-btn"
              title="Use current location"
            >
              {{ loadingLocation ? '📍...' : '📍 Current Location' }}
            </button>
            <button
              @click="toggleLocationPanel"
              class="minimize-btn"
              :title="locationPanelMinimized ? 'Expand panel' : 'Minimize panel'"
            >
              {{ locationPanelMinimized ? '▲' : '▼' }}
            </button>
          </div>
        </div>

        <div v-if="locationError" class="error-message">
          {{ locationError }}
        </div>

        <div v-show="!locationPanelMinimized" class="panel-content">
          <!-- Location Input Mode Toggle -->
          <div class="location-mode-toggle">
            <button @click="toggleLocationMode" class="mode-toggle-btn">
              {{
                locationMode.type === 'address'
                  ? 'Switch to Manual Coordinates'
                  : 'Switch to Address Lookup'
              }}
            </button>
          </div>

          <!-- Address Input Mode -->
          <div v-if="locationMode.type === 'address'" class="address-inputs">
            <h3>Address Lookup</h3>

            <div class="input-group">
              <label for="street">Street Address (optional):</label>
              <input
                id="street"
                v-model="addressInput.street"
                type="text"
                placeholder="e.g., 123 Main Street"
              />
            </div>

            <div class="input-row">
              <div class="input-group">
                <label for="city">City:</label>
                <input
                  id="city"
                  v-model="addressInput.city"
                  type="text"
                  placeholder="e.g., New York"
                  required
                />
              </div>

              <div class="input-group">
                <label for="state">State:</label>
                <input
                  id="state"
                  v-model="addressInput.state"
                  type="text"
                  placeholder="e.g., NY"
                  required
                />
              </div>
            </div>

            <button @click="geocodeAddress" :disabled="loadingGeocode" class="geocode-btn">
              {{ loadingGeocode ? 'Looking up...' : 'Find Coordinates' }}
            </button>

            <div v-if="geocodeError" class="error-message">
              {{ geocodeError }}
            </div>

            <div v-if="geocodeResult" class="geocode-info">
              <h4>Found Location:</h4>
              <p>{{ geocodeResult.formattedAddress }}</p>
              <p>
                Coordinates: {{ geocodeResult.latitude.toFixed(6) }},
                {{ geocodeResult.longitude.toFixed(6) }}
              </p>
            </div>
          </div>

          <!-- Manual Coordinates Input Mode -->
          <div v-if="locationMode.type === 'manual'" class="manual-inputs">
            <h3>Manual Coordinates</h3>

            <div class="input-row">
              <div class="input-group">
                <label for="locationLat">Latitude:</label>
                <input
                  id="locationLat"
                  v-model.number="locationLat"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  placeholder="e.g., 40.7128"
                />
              </div>

              <div class="input-group">
                <label for="locationLon">Longitude:</label>
                <input
                  id="locationLon"
                  v-model.number="locationLon"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>
          </div>

          <!-- Weather Data Fetch Button -->
          <div class="weather-fetch-section">
            <button
              @click="fetchWeatherData"
              :disabled="loadingWeather || loadingGeocode"
              class="weather-fetch-btn"
            >
              {{ loadingWeather ? 'Loading Weather...' : 'Fetch Weather Data' }}
            </button>

            <div v-if="weatherError" class="error-message">
              {{ weatherError }}
            </div>

            <div v-if="weatherData" class="weather-info">
              <div class="weather-info-header">
                <div>
                  <h3>Weather Station: {{ weatherData.station.name }}</h3>
                  <p>Data automatically populated below from latest observations</p>
                </div>
                <button 
                  v-if="hasSourceData"
                  @click="showSourceData = !showSourceData"
                  class="source-data-btn"
                >
                  {{ showSourceData ? 'Hide' : 'Show' }} Source Data
                </button>
              </div>
              
              <!-- Source Data Details -->
              <div v-if="showSourceData && hasSourceData" class="source-data-panel">
                <h4>📊 Detailed Source Data</h4>
                <p><strong>Forecast Date:</strong> {{ new Date(sourceData?.forecastDate || '').toLocaleDateString() }}</p>
                
                <!-- API Source URLs -->
                <div class="source-urls">
                  <h5>🔗 Data Source URLs</h5>
                  <div class="url-links">
                    <div v-if="sourceData?.forecastUrl" class="url-item">
                      <strong>Forecast Data:</strong> 
                      <a :href="sourceData?.forecastUrl" target="_blank" rel="noopener noreferrer">
                        {{ sourceData?.forecastUrl }}
                      </a>
                    </div>
                    <div v-if="sourceData?.pointDataUrl" class="url-item">
                      <strong>Point Data (Elevation):</strong> 
                      <a :href="sourceData?.pointDataUrl" target="_blank" rel="noopener noreferrer">
                        {{ sourceData?.pointDataUrl }}
                      </a>
                    </div>
                  </div>
                </div>
                
                <!-- Temperature Sources -->
                <div class="source-section">
                  <h5>🌡️ Temperature Data</h5>
                  <div class="source-items">
                    <div 
                      v-for="(temp, index) in sourceData?.temperatures || []" 
                      :key="index"
                      class="source-item"
                    >
                      <strong>{{ temp.period }}:</strong> {{ temp.value }}°F
                      <br>
                      <small>{{ new Date(temp.date).toLocaleString() }} - {{ temp.source }}</small>
                      <br>
                      <a v-if="temp.url" :href="temp.url" target="_blank" rel="noopener noreferrer" class="source-link">
                        🔗 View Source
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Humidity Sources -->
                <div class="source-section">
                  <h5>💧 Humidity Data</h5>
                  <div class="source-items">
                    <div 
                      v-for="(humidity, index) in sourceData?.humidity || []" 
                      :key="index"
                      class="source-item"
                    >
                      <strong>{{ humidity.period }}:</strong> {{ humidity.value }}%
                      <br>
                      <small>{{ new Date(humidity.date).toLocaleString() }} - {{ humidity.source }}</small>
                      <br>
                      <a v-if="humidity.url" :href="humidity.url" target="_blank" rel="noopener noreferrer" class="source-link">
                        🔗 View Source
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Wind Speed Sources -->
                <div v-if="(sourceData?.windSpeed || []).length > 0" class="source-section">
                  <h5>💨 Wind Speed Data</h5>
                  <div class="source-items">
                    <div 
                      v-for="(wind, index) in sourceData?.windSpeed || []" 
                      :key="index"
                      class="source-item"
                    >
                      <strong>{{ wind.period }}:</strong> {{ wind.value.toFixed(1) }} m/s
                      <br>
                      <small>{{ new Date(wind.date).toLocaleString() }} - {{ wind.source }}</small>
                      <br>
                      <a v-if="wind.url" :href="wind.url" target="_blank" rel="noopener noreferrer" class="source-link">
                        🔗 View Source
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Meteorological Data Section -->
      <div class="input-section">
        <div class="section-header">
          <h2>Meteorological Data</h2>
          <button @click="openUnitsModal" class="units-settings-btn" title="Unit Settings">
            ⚙️
          </button>
        </div>

        <div class="input-group">
          <label for="maxTemp">Maximum Temperature (°{{ temperatureUnit }}):</label>
          <input
            id="maxTemp"
            v-model.number="maxTemp"
            type="number"
            step="0.1"
            :placeholder="`Daily maximum temperature in °${temperatureUnit}`"
          />
        </div>

        <div class="input-group">
          <label for="minTemp">Minimum Temperature (°{{ temperatureUnit }}):</label>
          <input
            id="minTemp"
            v-model.number="minTemp"
            type="number"
            step="0.1"
            :placeholder="`Daily minimum temperature in °${temperatureUnit}`"
          />
        </div>

        <div class="input-group">
          <label for="relativeHumidity">Relative Humidity (%):</label>
          <input
            id="relativeHumidity"
            v-model.number="relativeHumidity"
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="Relative humidity"
          />
        </div>

        <div class="input-group">
          <label for="windSpeed">Wind Speed ({{ windSpeedUnit }}):</label>
          <input
            id="windSpeed"
            v-model.number="windSpeed"
            type="number"
            step="0.1"
            min="0"
            :placeholder="`Wind speed at 2m height in ${windSpeedUnit}`"
          />
        </div>

        <div class="input-group">
          <label for="solarRadiation">Solar Radiation (MJ/m²/day):</label>
          <input
            id="solarRadiation"
            v-model.number="solarRadiation"
            type="number"
            step="0.1"
            min="0"
            placeholder="Solar radiation"
          />
        </div>
      </div>

      <!-- Site-Specific Data Section -->
      <div class="input-section">
        <h2>Site-Specific Data</h2>

        <div class="input-group">
          <label for="altitude">Altitude ({{ altitudeUnit }}):</label>
          <input
            id="altitude"
            v-model.number="altitude"
            type="number"
            step="1"
            :placeholder="`Elevation above sea level in ${altitudeUnit}`"
          />
        </div>

        <div class="input-group">
          <label for="latitude">Latitude (degrees):</label>
          <input
            id="latitude"
            v-model.number="latitude"
            type="number"
            step="0.01"
            min="-90"
            max="90"
            placeholder="Latitude (+ for North, - for South)"
          />
        </div>

        <div class="input-group">
          <label for="longitude">Longitude (degrees):</label>
          <input
            id="longitude"
            v-model.number="locationLon"
            type="number"
            step="0.01"
            min="-180"
            max="180"
            placeholder="Longitude (+ for East, - for West)"
          />
        </div>
      </div>

      <!-- Key Parameters Section -->
      <div class="input-section">
        <h2>Key Parameters</h2>

        <div class="input-group">
          <label for="netRadiation">Net Radiation (MJ/m²/day):</label>
          <input
            id="netRadiation"
            v-model.number="netRadiation"
            type="number"
            step="0.1"
            placeholder="Net radiation (if known)"
          />
        </div>

        <div class="input-group">
          <label for="soilHeatFlux">Soil Heat Flux (MJ/m²/day):</label>
          <input
            id="soilHeatFlux"
            v-model.number="soilHeatFlux"
            type="number"
            step="0.1"
            placeholder="Soil heat flux (typically 0 for daily)"
          />
        </div>

        <div class="input-group">
          <label for="vaporPressureDeficit">Vapor Pressure Deficit (kPa):</label>
          <input
            id="vaporPressureDeficit"
            v-model.number="vaporPressureDeficit"
            type="number"
            step="0.01"
            placeholder="Vapor pressure deficit"
          />
        </div>

        <div class="input-group">
          <label for="psychrometricConstant">Psychrometric Constant (kPa/°C):</label>
          <input
            id="psychrometricConstant"
            v-model.number="psychrometricConstant"
            type="number"
            step="0.001"
            placeholder="Psychrometric constant"
          />
        </div>

        <div class="input-group">
          <label for="slopeVaporPressure">Slope of Vapor Pressure Curve (kPa/°C):</label>
          <input
            id="slopeVaporPressure"
            v-model.number="slopeVaporPressure"
            type="number"
            step="0.001"
            placeholder="Slope of saturation vapor pressure curve"
          />
        </div>
      </div>

      <!-- Resistance Factors Section -->
      <div class="input-section">
        <h2>Resistance Factors</h2>

        <div class="input-group">
          <label for="aerodynamicResistance">Aerodynamic Resistance (s/m):</label>
          <input
            id="aerodynamicResistance"
            v-model.number="aerodynamicResistance"
            type="number"
            step="0.1"
            placeholder="Aerodynamic resistance"
          />
        </div>

        <div class="input-group">
          <label for="surfaceResistance">Surface Resistance (s/m):</label>
          <input
            id="surfaceResistance"
            v-model.number="surfaceResistance"
            type="number"
            step="0.1"
            placeholder="Surface/stomatal resistance"
          />
        </div>
      </div>

      <!-- Crop Factors Section -->
      <div class="input-section">
        <h2>Crop Factors (Optional)</h2>

        <div class="input-group">
          <label for="cropCoefficient">Crop Coefficient (Kc):</label>
          <input
            id="cropCoefficient"
            v-model.number="cropCoefficient"
            type="number"
            step="0.01"
            min="0"
            placeholder="Crop coefficient (default: 1.0)"
          />
        </div>

        <div class="input-group">
          <label for="stressCoefficient">Stress Coefficient (Ks):</label>
          <input
            id="stressCoefficient"
            v-model.number="stressCoefficient"
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="Stress coefficient (default: 1.0)"
          />
        </div>
      </div>

      <!-- Results Section -->
      <div class="result-section">
        <h2>Results</h2>
        <div class="result">
          <strong>Reference Evapotranspiration (ET₀): {{ et0.toFixed(2) }} mm/day</strong>
        </div>
        <div class="result-note">
          <p>
            <em
              >Note: This is a simplified calculation for demonstration purposes. A complete
              implementation would use the full FAO-56 Penman-Monteith equation with proper
              parameter calculations and validations.</em
            >
          </p>
        </div>
      </div>
    </div>

    <!-- Temperature Data Source Modal -->
    <div v-if="showTemperatureModal" class="modal-overlay" @click="showTemperatureModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📊 Weather Data Sources</h3>
          <button @click="showTemperatureModal = false" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p><strong>Weather Data Information:</strong></p>
          <ul>
            <li>📈 <strong>Maximum Temperature:</strong> Today's forecasted high</li>
            <li>📉 <strong>Minimum Temperature:</strong> Today's forecasted low</li>
            <li>
              💧 <strong>Relative Humidity:</strong> Daily average from today's forecast periods
            </li>
            <li>💨 <strong>Wind Speed:</strong> Daily average from today's forecast periods</li>
            <li>🌡️ <strong>Data Source:</strong> National Weather Service forecast</li>
            <li>📅 <strong>Period:</strong> Current day's forecast</li>
          </ul>
          <p class="note">
            <em
              >Note: Temperature, humidity, and wind speed values are from today's official weather
              forecast, providing more representative daily averages for your Penman-Monteith
              calculations compared to instantaneous readings. Solar radiation is estimated based on
              location and date.</em
            >
          </p>
        </div>
        <div class="modal-footer">
          <button @click="showTemperatureModal = false" class="modal-ok-btn">Got it!</button>
        </div>
      </div>
    </div>

    <!-- Units Settings Modal -->
    <div v-if="showUnitsModal" class="modal-overlay" @click="closeUnitsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>⚙️ Unit Settings</h3>
          <button @click="closeUnitsModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p><strong>Choose your preferred units:</strong></p>
          
          <!-- Temperature Unit Toggle -->
          <div class="unit-toggle-group">
            <label class="unit-toggle-label">🌡️ Temperature:</label>
            <div class="unit-toggle">
              <button 
                @click="toggleTemperatureUnit"
                :class="['unit-btn', 'metric', { active: temperatureUnit === 'C' }]"
              >
                °C
              </button>
              <button 
                @click="toggleTemperatureUnit"
                :class="['unit-btn', 'imperial', { active: temperatureUnit === 'F' }]"
              >
                °F
              </button>
            </div>
          </div>

          <!-- Altitude Unit Toggle -->
          <div class="unit-toggle-group">
            <label class="unit-toggle-label">📏 Altitude:</label>
            <div class="unit-toggle">
              <button 
                @click="toggleAltitudeUnit"
                :class="['unit-btn', 'metric', { active: altitudeUnit === 'm' }]"
              >
                m
              </button>
              <button 
                @click="toggleAltitudeUnit"
                :class="['unit-btn', 'imperial', { active: altitudeUnit === 'ft' }]"
              >
                ft
              </button>
            </div>
          </div>

          <!-- Wind Speed Unit Toggle -->
          <div class="unit-toggle-group">
            <label class="unit-toggle-label">💨 Wind Speed:</label>
            <div class="unit-toggle">
              <button 
                @click="toggleWindSpeedUnit"
                :class="['unit-btn', 'metric', { active: windSpeedUnit === 'm/s' }]"
              >
                m/s
              </button>
              <button 
                @click="toggleWindSpeedUnit"
                :class="['unit-btn', 'imperial', { active: windSpeedUnit === 'mph' }]"
              >
                mph
              </button>
            </div>
          </div>

          <p class="note">
            <em>Note: Changing units will automatically convert your current input values.</em>
          </p>
        </div>
        <div class="modal-footer">
          <button @click="closeUnitsModal" class="modal-ok-btn">Done</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.calculator-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.input-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.input-section h2 {
  margin: 0;
  color: #2563eb;
  font-size: 1.2rem;
  border-bottom: 2px solid #2563eb;
  padding-bottom: 0.5rem;
  flex: 1;
}

.units-settings-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: 1rem;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.units-settings-btn:hover {
  background: #4b5563;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.input-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}

.input-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.result-section {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f0f8ff;
}

.result-section h2 {
  margin: 0 0 1rem 0;
  color: #2563eb;
  font-size: 1.2rem;
}

.result {
  padding: 1.5rem;
  background: #2563eb;
  color: white;
  border-radius: 8px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.result-note {
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
}

.result-note p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.weather-fetch-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 1rem;
}

.weather-fetch-btn:hover:not(:disabled) {
  background: #059669;
}

.weather-fetch-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #dc2626;
  font-size: 0.9rem;
}

.weather-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #e6fffa;
  border: 1px solid #81e6d9;
  border-radius: 4px;
  color: #065f46;
}

.weather-info h3 {
  margin: 0 0 0.5rem 0;
  color: #047857;
}

.weather-info p {
  margin: 0;
  font-size: 0.9rem;
}

.weather-info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.source-data-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.source-data-btn:hover {
  background: #2563eb;
}

.source-data-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.source-data-panel h4 {
  margin: 0 0 1rem 0;
  color: #1e293b;
  font-size: 1.1rem;
}

.source-section {
  margin-bottom: 1.5rem;
}

.source-section h5 {
  margin: 0 0 0.75rem 0;
  color: #374151;
  font-size: 1rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.25rem;
}

.source-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
}

.source-item {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.source-item strong {
  color: #1f2937;
}

.source-item small {
  color: #6b7280;
  font-size: 0.8rem;
}

.source-urls {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.source-urls h5 {
  margin: 0 0 0.75rem 0;
  color: #374151;
  font-size: 1rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.25rem;
}

.url-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.url-item {
  font-size: 0.9rem;
  line-height: 1.4;
}

.url-item strong {
  color: #1f2937;
  display: inline-block;
  min-width: 120px;
}

.url-item a {
  color: #2563eb;
  text-decoration: none;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.85rem;
}

.url-item a:hover {
  text-decoration: underline;
}

.source-link {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 500;
}

.source-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .weather-info-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .source-items {
    grid-template-columns: 1fr;
  }
}

.location-panel {
  transition: all 0.3s ease;
}

.location-panel.minimized {
  padding-bottom: 1rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  color: #2563eb;
  font-size: 1.2rem;
  border-bottom: 2px solid #2563eb;
  padding-bottom: 0.5rem;
  flex: 1;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.current-location-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.current-location-btn:hover:not(:disabled) {
  background: #059669;
}

.current-location-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.minimize-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 40px;
}

.minimize-btn:hover {
  background: #4b5563;
}

.panel-content {
  animation: fadeIn 0.3s ease;
}

.location-panel.minimized .panel-content {
  display: none;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.location-mode-toggle {
  margin-bottom: 1.5rem;
}

.mode-toggle-btn {
  background: #6366f1;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.mode-toggle-btn:hover {
  background: #4f46e5;
}

.address-inputs,
.manual-inputs {
  margin-bottom: 1.5rem;
}

.address-inputs h3,
.manual-inputs h3 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1.1rem;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.geocode-btn {
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 1rem;
}

.geocode-btn:hover:not(:disabled) {
  background: #7c3aed;
}

.geocode-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.geocode-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #374151;
}

.geocode-info h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.geocode-info p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.weather-fetch-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.3rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
  color: #374151;
  line-height: 1.6;
}

.modal-body ul {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.modal-body li {
  margin: 0.5rem 0;
}

.modal-body .note {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f0f9ff;
  border-left: 4px solid #2563eb;
  border-radius: 4px;
  font-size: 0.95rem;
}

.modal-footer {
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #e5e7eb;
}

.modal-ok-btn {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-ok-btn:hover {
  background: #1d4ed8;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 768px) {
  .input-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .modal-content {
    width: 95%;
    margin: 1rem;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

/* Unit Toggle Styles */
.unit-toggle-group {
  margin-bottom: 1.5rem;
}

.unit-toggle-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #374151;
  font-size: 1rem;
}

.unit-toggle {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  max-width: 200px;
}

.unit-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.unit-btn.metric {
  border-right: 1px solid #e5e7eb;
}

.unit-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.unit-btn.active {
  background: #2563eb;
  color: white;
  font-weight: 600;
}

.unit-btn.metric.active {
  background: #059669;
}

.unit-btn.imperial.active {
  background: #dc2626;
}

@media (min-width: 768px) {
  .calculator-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .result-section {
    grid-column: 1 / -1;
  }
}
</style>
