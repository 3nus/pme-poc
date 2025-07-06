<script setup lang="ts">
import { ref } from 'vue'

const showInfo = ref(false)

const toggleInfo = () => {
  showInfo.value = !showInfo.value
}
</script>

<template>
  <main>
    <h1><a href="#" @click="toggleInfo">Penman-Monteith</a> Equation Calculator</h1>
    
    <div class="welcome-section">
      <p>Welcome to the Penman-Monteith equation calculator. Choose from the options below:</p>
      
      <div class="calculator-options">
        <RouterLink to="/simple-calculator" class="calculator-card">
          <h3>Simple Calculator</h3>
          <p>Basic addition calculator for testing</p>
        </RouterLink>
        
        <RouterLink to="/penman-monteith" class="calculator-card">
          <h3>Penman-Monteith Calculator</h3>
          <p>Full evapotranspiration calculator with all meteorological inputs</p>
        </RouterLink>
      </div>
    </div>
    
    <div v-if="showInfo" class="info-section">
      <button @click="toggleInfo" class="close-btn">✕ Close</button>
      <iframe 
        src="https://en.wikipedia.org/wiki/Penman%E2%80%93Monteith_equation"
        width="100%"
        height="600"
        frameborder="0">
      </iframe>
    </div>
  </main>
</template>

<style scoped>
.welcome-section {
  margin: 2rem 0;
  text-align: center;
}

.welcome-section p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  color: #666;
}

.calculator-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.calculator-card {
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
}

.calculator-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  background: #f0f0f0;
}

.calculator-card h3 {
  margin: 0 0 1rem 0;
  color: #2563eb;
  font-size: 1.3rem;
}

.calculator-card p {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.info-section {
  margin-top: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.close-btn {
  background: #f0f0f0;
  border: none;
  padding: 10px 15px;
  cursor: pointer;
  width: 100%;
  text-align: right;
  font-size: 16px;
}

.close-btn:hover {
  background: #e0e0e0;
}

iframe {
  display: block;
}
</style>
