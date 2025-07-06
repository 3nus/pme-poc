<script setup lang="ts">
import { ref, computed } from 'vue'

const showInfo = ref(false)
const value1 = ref<number>(0)
const value2 = ref<number>(0)

const toggleInfo = () => {
  showInfo.value = !showInfo.value
}

const sum = computed(() => {
  return value1.value + value2.value
})
</script>

<template>
  <main>
    <h1><a href="#" @click="toggleInfo">Penman-Monteith</a> equation calculator</h1>
    
    <div class="calculator-section">
      <div class="input-group">
        <label for="value1">Value 1:</label>
        <input 
          id="value1" 
          v-model.number="value1" 
          type="number" 
          step="0.01" 
          placeholder="Enter first value"
        />
      </div>
      
      <div class="input-group">
        <label for="value2">Value 2:</label>
        <input 
          id="value2" 
          v-model.number="value2" 
          type="number" 
          step="0.01" 
          placeholder="Enter second value"
        />
      </div>
      
      <div class="result">
        <strong>Sum: {{ sum }}</strong>
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
.calculator-section {
  margin: 2rem 0;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.input-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}

.result {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #2563eb;
  color: white;
  border-radius: 8px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
