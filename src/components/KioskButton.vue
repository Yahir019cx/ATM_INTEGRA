<script setup >
import { ref, computed } from 'vue'
import Service from '@/assets/animations/Service.json'
import Bot from '@/assets/animations/Chatbot.json'
import ShopCar from '@/assets/animations/ShopCar.json'
import Card from '@/assets/animations/CardC.json'
import ShinyText from '@/components/ShinyText.vue'
const props = defineProps({
  icon: [String, Object],
  text: String,
  block: Boolean,
  textOffset: {
    type: String,
    default: '50px',
  },
})

const pressed = ref(false)

const isLottie = computed(() => typeof props.icon !== 'string')
const isServiceIcon = computed(() => props.icon === Service)
const isBotIcon = computed(() => props.icon === Bot)
const isShopCarIcon = computed(() => props.icon === ShopCar)
const isCardIcon = computed(() => props.icon === Card)
</script>

<template>
  <v-card
    :ripple="false"
    :elevation="pressed ? 12 : 3"
    class="d-flex flex-column align-center kiosk-btn position-relative"
    @mousedown="pressed = true"
    @mouseup="pressed = false"
    @mouseleave="pressed = false"
    @click="$emit('click')"
    :class="{ 'kiosk-btn--pressed': pressed, 'kiosk-btn--block': block }"
  >
    <!-- Mostrar animación Lottie centrada -->
    <Vue3Lottie
      v-if="isLottie"
      :animationData="icon"
      :loop="true"
      :autoplay="true"
      class="lottie-center"
      :style="{
        width: isServiceIcon
          ? '260px'
          : isBotIcon
            ? '200px'
            : isShopCarIcon
              ? '200px'
              : isCardIcon
                ? '220px'
                : '310px',
        height: isServiceIcon ? '260px' : isBotIcon ? '150px' : '310px',
        top: isServiceIcon ? '20px' : isBotIcon ? '30px' : '10px',
      }"
    />

    <!-- Mostrar ícono normal -->
    <v-icon v-else :icon="icon" size="88" class="mb-2" />

   <ShinyText
  :text="props.text"
  :speed="2"
  :disabled="false"
  className="kiosk-label"
  :style="{ marginBottom: props.textOffset }"
/>

  </v-card>
</template>

<style scoped>
.kiosk-btn {
  width: 380px;
  height: 380px;
  cursor: pointer;
  transition: all 0.1s ease;
  touch-action: manipulation;
}

.kiosk-btn--block {
  width: 100%;
  height: 290px;
  padding-top: 16px;
  padding-bottom: 16px;
  touch-action: manipulation;
}

.kiosk-btn--pressed {
  border: 5px solid #fcd500;
}

.lottie-center {
  position: absolute;
}

.kiosk-label {
  margin-top: auto;
  margin-bottom: 50px;
  text-align: center;
  font-weight: bold;
  font-size: 2.2rem;
}
</style>
