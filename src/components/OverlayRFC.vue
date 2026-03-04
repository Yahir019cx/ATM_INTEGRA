<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import Document from '@/assets/animations/Document.json'
import Load from '@/assets/animations/Load.json'
import ScanSF from '@/assets/animations/ScanSF.json'
import { useI18n } from 'vue-i18n'
import { obtenerCpnyId } from '@/services/api'

const { t } = useI18n()

const props = defineProps({
  visible: Boolean,
  rfcPrellenado: { type: String, default: '' },
  modo: { type: String, default: 'input' }
})

const emit = defineEmits(['confirmar', 'cancelar'])

const rfc = ref('')
const rfcError = ref('')
const rfcInputRef = ref(null)
const isTextVisible = ref(false)
const textRef = ref(null)
let observer = null

const splitTitle = computed(() => t('rfc.titulo').split(''))

function initTextAnimation() {
  if (!textRef.value) return
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isTextVisible.value) {
        setTimeout(() => { isTextVisible.value = true }, 300)
      }
    })
  }, { threshold: 0.1 })
  observer.observe(textRef.value)
}

function cleanup() {
  if (observer) { observer.disconnect(); observer = null }
  isTextVisible.value = false
}

watch(() => props.visible, (val) => {
  if (val) {
    rfc.value = props.rfcPrellenado || ''
    rfcError.value = ''
    obtenerCpnyId().catch(console.error)
    setTimeout(() => {
      initTextAnimation()
      nextTick(() => {
        const el = rfcInputRef.value?.$el?.querySelector('input')
        el?.focus()
      })
    }, 150)
  } else {
    cleanup()
    rfc.value = ''
    rfcError.value = ''
  }
}, { immediate: true })

function validarRFC(value) {
  const v = value.trim().toUpperCase()
  return v.length >= 12 && v.length <= 13 && /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(v)
}

function onRFCInput(value) {
  rfc.value = value.toUpperCase()
  rfcError.value = ''
}

function confirmar() {
  rfcError.value = ''
  if (!rfc.value.trim()) {
    rfcError.value = t('rfc.errorRequerido')
    return
  }
  if (!validarRFC(rfc.value)) {
    rfcError.value = t('rfc.errorFormato')
    return
  }

  emit('confirmar', rfc.value.trim().toUpperCase())
}

function cancelar() {
  emit('cancelar')
}
</script>

<template>
  <div v-if="visible" class="overlay-rfc">

    <!-- ── Formulario de ingreso RFC ── -->
    <div v-if="props.modo === 'input'" class="rfc-content">

      <!-- Icono animado con anillos pulsantes -->
      <div class="icon-wrapper">
        <div class="pulse-ring pulse-ring--outer" />
        <div class="pulse-ring pulse-ring--inner" />
        <Vue3Lottie
          :animationData="Document"
          :loop="true"
          :autoplay="true"
          class="lottie-doc"
        />
      </div>

      <!-- Título con animación split-char -->
      <div ref="textRef" class="split-text-container">
        <span
          v-for="(char, idx) in splitTitle"
          :key="idx"
          :class="['split-char', { 'is-visible': isTextVisible }]"
          :style="{ transitionDelay: `${idx * 40}ms` }"
        >
          {{ char === ' ' ? '\u00A0' : char }}
        </span>
      </div>

      <!-- Subtítulo -->
      <p class="rfc-subtitle">{{ t('rfc.subtitulo') }}</p>

      <!-- Input RFC -->
      <v-text-field
        ref="rfcInputRef"
        :model-value="rfc"
        @update:model-value="onRFCInput"
        :label="t('rfc.label')"
        :placeholder="t('rfc.placeholder')"
        :error-messages="rfcError"
        :maxlength="13"
        variant="outlined"
        rounded="lg"
        base-color="#93C2E0"
        color="#93C2E0"
        bg-color="rgba(147, 194, 224, 0.07)"
        prepend-inner-icon="mdi-card-account-details-outline"
        class="rfc-input"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter="confirmar"
      />

      <!-- Botones lado a lado -->
      <div class="rfc-actions">
        <v-btn
          variant="flat"
          rounded="lg"
          size="large"
          color="rgba(220, 38, 38, 0.85)"
          class="btn-cancelar"
          @click="cancelar"
        >
          {{ t('common.cancelar') }}
        </v-btn>

        <v-btn
          variant="flat"
          rounded="lg"
          size="large"
          color="#0356A9"
          class="btn-consultar"
          :disabled="!rfc.trim()"
          @click="confirmar"
        >
          {{ t('rfc.consultar') }}
        </v-btn>
      </div>

    </div>

    <!-- ── Animación cargando / éxito (igual que Overlay.vue) ── -->
    <div v-else class="anim-content">
      <Vue3Lottie
        :animationData="props.modo === 'cargando' ? Load : ScanSF"
        :loop="true"
        :autoplay="true"
        style="width: 500px; height: 500px"
      />
    </div>

  </div>
</template>

<style scoped>
.overlay-rfc {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.88);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rfc-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 560px;
  padding: 32px 28px;
  color: #FFFDFC;
}

/* ── Icono con anillos pulsantes ── */
.icon-wrapper {
  position: relative;
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 2px solid #93C2E0;
  transform: translate(-50%, -50%);
  animation: pulse-expand 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.pulse-ring--outer {
  width: 220px;
  height: 220px;
  opacity: 0.45;
  animation-delay: 0s;
}

.pulse-ring--inner {
  width: 174px;
  height: 174px;
  opacity: 0.25;
  animation-delay: 0.8s;
}

@keyframes pulse-expand {
  0%   { transform: translate(-50%, -50%) scale(0.94); opacity: 0.55; }
  50%  { transform: translate(-50%, -50%) scale(1.07); opacity: 0.12; }
  100% { transform: translate(-50%, -50%) scale(0.94); opacity: 0.55; }
}

.lottie-doc {
  width: 185px;
  height: 185px;
}

/* ── Split-char title ── */
.split-text-container {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  color: #FFFDFC;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.01em;
}

.split-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(32px);
  transition: all 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.split-char.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Subtítulo ── */
.rfc-subtitle {
  font-size: 1rem;
  color: #93C2E0;
  text-align: center;
  margin: 0;
  letter-spacing: 0.01em;
}

/* ── Input RFC ── */
.rfc-input {
  width: 100%;
}

.rfc-input :deep(.v-field__input) {
  color: #FFFDFC !important;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  caret-color: #C7E0EA;
}

.rfc-input :deep(.v-label) {
  color: #93C2E0 !important;
  font-size: 0.95rem;
}

.rfc-input :deep(.v-field--focused .v-label) {
  color: #C7E0EA !important;
}

.rfc-input :deep(.v-messages__message) {
  color: #ff8a80 !important;
  font-size: 0.85rem;
}

/* ── Botones lado a lado ── */
.rfc-actions {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 4px;
}

.btn-cancelar {
  flex: 1;
  height: 52px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #FFFDFC !important;
  transition: box-shadow 0.2s ease;
}

.btn-cancelar:hover {
  box-shadow: 0 6px 18px rgba(220, 38, 38, 0.5);
}

.btn-consultar {
  flex: 1;
  height: 52px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #FFFDFC !important;
  transition: box-shadow 0.2s ease;
}

.btn-consultar:not(:disabled):hover {
  box-shadow: 0 6px 22px rgba(3, 86, 169, 0.55);
}

.rfc-input :deep(.v-icon) {
  color: #93C2E0 !important;
}

.rfc-input :deep(.v-field--focused .v-icon) {
  color: #C7E0EA !important;
}

/* ── Sección de animación (Load / ScanSF) ── */
.anim-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>
