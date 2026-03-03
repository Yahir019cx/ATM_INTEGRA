<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  tipo: {
    type: String,
    default: 'success',
    validator: value => ['success', 'error'].includes(value)
  },
  titulo: {
    type: String,
    default: ''
  },
  mensaje: {
    type: String,
    default: ''
  },
  submensaje: {
    type: String,
    default: ''
  },
  textoBoton: {
    type: String,
    default: 'Entendido'
  }
})

const emit = defineEmits(['update:modelValue', 'cerrar'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Configuración según el tipo
const configuracion = computed(() => {
  const configs = {
    success: {
      colorTexto: 'text-success',
      colorBoton: 'success'
    },
    error: {
      colorTexto: 'text-error',
      colorBoton: 'error'
    }
  }
  return configs[props.tipo] || configs.success
})

function cerrarDialogo() {
  emit('cerrar')
  visible.value = false
}
</script>

<template>
  <v-dialog
    v-model="visible"
    max-width="500"
    persistent
    transition="dialog-top-transition"
    class="notificacion-dialog"
  >
    <v-card rounded="xl">
      <v-card-title class="text-h4 font-weight-bold py-4 text-center" :class="configuracion.colorTexto">
        {{ titulo }}
      </v-card-title>

      <v-card-text class="text-center px-8">
        <div class="text-h6 font-weight-medium mb-4">
          {{ mensaje }}
        </div>
        <div v-if="submensaje" class="text-body-1 text-grey-darken-1">
          {{ submensaje }}
        </div>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn
          :color="configuracion.colorBoton"
          variant="flat"
          height="50"
          width="200"
          rounded="lg"
          class="font-weight-bold text-white mb-6"
          @click="cerrarDialogo"
        >
          {{ textoBoton }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
:deep(.notificacion-dialog) {
  z-index: 10001 !important;
  position: fixed !important;
}
</style>