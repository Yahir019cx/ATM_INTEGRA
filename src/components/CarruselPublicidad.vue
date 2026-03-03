<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import { URL_IMG } from '../urls'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['click'])

defineProps<{
  imagenes: { Imagen: string }[]
}>()

const autoplay = {
  delay: 4000,
  disableOnInteraction: false
} as any
</script>

<template>
  <div class="carrusel-overlay" @click="emit('click')">
    <swiper
      :modules="[Autoplay, EffectFade]"
      :autoplay="autoplay"
      effect="fade"
      :loop="imagenes.length > 1"
      class="swiper-container"
    >
      <swiper-slide v-for="(img, i) in imagenes" :key="i">
        <img :src="`${URL_IMG}/Documentos/Inv/${img.Imagen}`" />
      </swiper-slide>
    </swiper>

    <!-- Indicador para tocar pantalla -->
    <div class="tap-indicator">
      <span class="shimmer-text">{{ t('tocaParaIniciar') }}</span>
    </div>
  </div>
</template>

<style scoped>
.carrusel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: black;
  cursor: pointer;
}

.swiper-container {
  width: 100%;
  height: 100%;
}

.swiper-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tap-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.shimmer-text {
  font-size: 42px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.15);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.9) 45%,
    rgba(255, 255, 255, 0.9) 55%,
    rgba(255, 255, 255, 0.25) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  50% {
    background-position: -100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

body {
  overflow: hidden;
}
</style>
