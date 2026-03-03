<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  modelValue: Boolean,
  mensaje: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'cerrar'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function cerrarDialogo() {
  emit('cerrar')
  visible.value = false
}
</script>

<template>
  <v-dialog
    v-model="visible"
    max-width="550"
    persistent
    transition="dialog-top-transition"
    class="error-dialog"
  >
    <v-card rounded="xl">
      <v-card-title class="text-h4 font-weight-bold py-4 text-center text-black">
         {{ t('qr.tituloErrorQR') }}
      </v-card-title>

      <v-card-text class="text-center px-8">
        <div class="text-h6 font-weight-medium mb-6">
          {{ mensaje }}
        </div>
        <div class="text-body-1 text-grey-darken-1">
          {{ t('qr.submensajeErrorQR') }}
        </div>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn
          color="primary"
          variant="flat"
          height="50"
          width="200"
          rounded="lg"
          class="font-weight-bold text-white mb-6"
          @click="cerrarDialogo"
        >
          {{ t('qr.botonCerrar') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
:deep(.error-dialog) {
  z-index: 10001 !important;
  position: fixed !important;
}
</style>