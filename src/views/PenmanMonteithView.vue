<script setup lang="ts">
import { ref, computed } from 'vue'

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

// Simple ET0 calculation placeholder
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
          <p><em>Note: This is a simplified calculation for demonstration purposes. 
          A complete implementation would use the full FAO-56 Penman-Monteith equation 
          with proper parameter calculations and validations.</em></p>
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