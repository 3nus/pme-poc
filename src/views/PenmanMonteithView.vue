<script setup lang="ts">
import { ref, computed } from 'vue'
import weatherService from '@/services/weatherService'
import geocodingService from '@/services/geocodingService'
import type { ProcessedWeatherData, Location } from '@/types/weather'
import type { Address, GeocodeResult, LocationInputMode } from '@/types/geocoding'

// Meteorological Data
const maxTemp = ref<number>(0)
const minTemp = ref<number>(0)
const relativeHumidity = ref<number>(0)
const windSpeed = ref<number>(0)
const solarRadiation = ref<number>(0)

// Site-Specific Data
const altitude = ref<number>(0)
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

// Manual location input
const locationLat = ref<number>(0)
const locationLon = ref<number>(0)

// Address-based location input
const addressInput = ref<Address>({
  street: '',
  city: '',
  state: '',
  country: 'United States'
})

// Location services state
const weatherData = ref<ProcessedWeatherData | null>(null)
const geocodeResult = ref<GeocodeResult | null>(null)
const loadingWeather = ref<boolean>(false)
const loadingGeocode = ref<boolean>(false)
const weatherError = ref<string>('')
const geocodeError = ref<string>('')

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
      longitude: targetLon
    }

    const data = await weatherService.getProcessedWeatherData(location)
    weatherData.value = data

    // Auto-populate meteorological fields
    maxTemp.value = data.maxTemperature
    minTemp.value = data.minTemperature
    relativeHumidity.value = data.relativeHumidity
    windSpeed.value = data.windSpeed
    
    // Estimate solar radiation
    const dayOfYear = new Date().getDayOfYear()
    const estimatedSolarRadiation = weatherService.estimateSolarRadiation(targetLat, dayOfYear)
    solarRadiation.value = estimatedSolarRadiation

    // Auto-populate site-specific data
    altitude.value = data.station.elevation
    latitude.value = data.station.latitude

  } catch (error) {
    weatherError.value = error instanceof Error ? error.message : 'Failed to fetch weather data'
    weatherData.value = null
  } finally {
    loadingWeather.value = false
  }
}

// Toggle location input mode
const toggleLocationMode = () => {
  locationMode.value.type = locationMode.value.type === 'manual' ? 'address' : 'manual'
  // Clear errors when switching modes
  weatherError.value = ''
  geocodeError.value = ''
}

// Add getDayOfYear method to Date prototype
declare global {
  interface Date {
    getDayOfYear(): number
  }
}

Date.prototype.getDayOfYear = function() {
  const start = new Date(this.getFullYear(), 0, 0)
  const diff = this.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

// For Kieran: Simple ET0 calculation placeholder
const et0 = computed(() => {
  // This is a simplified calculation for demonstration
  // In a real implementation, you'd use the full Penman-Monteith equation
  const avgTemp = (maxTemp.value + minTemp.value) / 2
  const tempFactor = avgTemp * 0.1
  const radiationFactor = solarRadiation.value * 0.05
  const windFactor = windSpeed.value * 0.02
  const humidityFactor = relativeHumidity.value * 0.01

  return Math.max(0, tempFactor + radiationFactor + windFactor - humidityFactor)
})
</script>

<template>
  <main>
    <h1>Penman-Monteith ET₀ Calculator</h1>

    <div class="calculator-container">
      <!-- Weather Data Fetching Section -->
      <div class="input-section">
        <h2>Location & Weather Data</h2>
        
        <!-- Location Input Mode Toggle -->
        <div class="location-mode-toggle">
          <button 
            @click="toggleLocationMode"
            class="mode-toggle-btn"
          >
            {{ locationMode.type === 'address' ? 'Switch to Manual Coordinates' : 'Switch to Address Lookup' }}
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
          
          <button 
            @click="geocodeAddress" 
            :disabled="loadingGeocode"
            class="geocode-btn"
          >
            {{ loadingGeocode ? 'Looking up...' : 'Find Coordinates' }}
          </button>
          
          <div v-if="geocodeError" class="error-message">
            {{ geocodeError }}
          </div>
          
          <div v-if="geocodeResult" class="geocode-info">
            <h4>Found Location:</h4>
            <p>{{ geocodeResult.formattedAddress }}</p>
            <p>Coordinates: {{ geocodeResult.latitude.toFixed(6) }}, {{ geocodeResult.longitude.toFixed(6) }}</p>
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
            <h3>Weather Station: {{ weatherData.station.name }}</h3>
            <p>Data automatically populated below from latest observations</p>
          </div>
        </div>
      </div>

      <!-- Meteorological Data Section -->
      <div class="input-section">
        <h2>Meteorological Data</h2>

        <div class="input-group">
          <label for="maxTemp">Maximum Temperature (°C):</label>
          <input
            id="maxTemp"
            v-model.number="maxTemp"
            type="number"
            step="0.1"
            placeholder="Daily maximum temperature"
          />
        </div>

        <div class="input-group">
          <label for="minTemp">Minimum Temperature (°C):</label>
          <input
            id="minTemp"
            v-model.number="minTemp"
            type="number"
            step="0.1"
            placeholder="Daily minimum temperature"
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
          <label for="windSpeed">Wind Speed (m/s):</label>
          <input
            id="windSpeed"
            v-model.number="windSpeed"
            type="number"
            step="0.1"
            min="0"
            placeholder="Wind speed at 2m height"
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
          <label for="altitude">Altitude (m):</label>
          <input
            id="altitude"
            v-model.number="altitude"
            type="number"
            step="1"
            placeholder="Elevation above sea level"
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

.input-section h2 {
  margin: 0 0 1rem 0;
  color: #2563eb;
  font-size: 1.2rem;
  border-bottom: 2px solid #2563eb;
  padding-bottom: 0.5rem;
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

@media (max-width: 768px) {
  .input-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
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
