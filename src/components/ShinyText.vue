<script setup lang="ts">
import { computed } from 'vue'

interface ShinyTextProps {
  text: string
  disabled?: boolean
  speed?: number
  className?: string
  
}

const props = withDefaults(defineProps<ShinyTextProps>(), {
  text: '',
  disabled: false,
  speed: 5,
  className: ''
})

const animationDuration = computed(() => `${props.speed}s`)
</script>

<template>
  <div
    :class="`text-[#0e0e0e] bg-clip-text inline-block ${!props.disabled ? 'animate-shine' : ''} ${props.className}`"
    :style="{
      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0) 70%)',
      backgroundSize: '200% 100%',
      WebkitBackgroundClip: 'text',
      animationDuration: animationDuration
    }"
  >
    {{ props.text }}
  </div>
</template>

<style scoped>
@keyframes shine {
  0% {
    background-position: 100%;
  }
  100% {
    background-position: -100%;
  }
}

.animate-shine {
  animation: shine 0.2ms linear infinite;
}
</style>
