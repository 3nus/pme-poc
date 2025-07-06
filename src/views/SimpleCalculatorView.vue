<script setup lang="ts">
import { ref, computed } from 'vue'

const value1 = ref<number>(0)
const value2 = ref<number>(0)

const sum = computed(() => {
  return value1.value + value2.value
})
</script>

<template>
  <main>
    <h1>Simple Calculator</h1>
    
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
</style>