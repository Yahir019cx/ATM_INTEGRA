<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// State
const ordenId = ref('')
const clienteNombre = ref('')
const vehiculo = ref('')
const vehiculoSerie = ref('')
const isLoaded = ref(false)

// Computed
const infoItems = computed(() => [
  {
    label: 'Orden de Servicio',
    value: ordenId.value || 'N/A'
  },
  {
    label: 'Cliente',
    value: clienteNombre.value || 'N/A'
  },
  {
    label: 'Vehículo',
    value: vehiculo.value || 'N/A'
  },
  {
    label: 'Serie',
    value: vehiculoSerie.value || 'N/A'
  }
])

const fechaActual = computed(() => {
  return new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const currentYear = computed(() => new Date().getFullYear())

// Lifecycle
onMounted(() => {
  ordenId.value = route.query.orden || ''
  clienteNombre.value = route.query.cliente || ''
  vehiculo.value = route.query.vehiculo || ''
  vehiculoSerie.value = route.query.serie || ''

  setTimeout(() => {
    isLoaded.value = true
  }, 100)
})
</script>

<template>
  <v-container fluid class="fill-height pa-3 pa-sm-4">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="11" md="9" class="px-2 px-sm-4">
        <v-scale-transition>
          <v-card v-if="isLoaded" elevation="8" rounded="xl" class="card-main">
            <!-- Header -->
            <v-card-title class="header-section text-center pa-6 pa-sm-8">
              <v-row justify="center" no-gutters>
                <v-col cols="12">
                  <h1 class="text-h5 text-sm-h4 font-weight-bold text-white mb-1">
                    Autorización de Entrega
                  </h1>
                  <p class="text-body-2 text-white mb-0" style="opacity: 0.9">
                    Vehículo listo para recoger
                  </p>
                </v-col>
              </v-row>
            </v-card-title>

            <!-- Content -->
            <v-card-text class="pa-4 pa-sm-6">
              <!-- Info Items -->
              <v-sheet color="background" rounded="lg" class="mb-4">
                <v-list bg-color="transparent" class="py-2">
                  <template v-for="(item, index) in infoItems" :key="index">
                    <v-list-item class="px-3 px-sm-4 py-2 text-center">
                      <div class="w-100">
                        <v-list-item-title class="text-caption text-grey-darken-1 mb-1 font-weight-medium text-uppercase" style="font-size: 0.7rem !important;">
                          {{ item.label }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-body-1 text-sm-h6 font-weight-bold text-primary mt-1 text-wrap">
                          {{ item.value }}
                        </v-list-item-subtitle>
                      </div>
                    </v-list-item>
                    <v-divider v-if="index < infoItems.length - 1" :key="`divider-${index}`" class="mx-3 mx-sm-4"></v-divider>
                  </template>
                </v-list>
              </v-sheet>

              <!-- Authorization Box -->
              <v-sheet color="info-light" rounded="lg" class="pa-4 pa-sm-5 text-center">
                <v-icon size="32" color="primary" class="mb-2">mdi-lock-check-outline</v-icon>
                <p class="text-body-2 text-primary font-weight-medium mb-0 px-2">
                  Este documento autoriza la entrega del vehículo al cliente titular de la orden de servicio.
                </p>
              </v-sheet>
            </v-card-text>

            <!-- Footer -->
            <v-divider></v-divider>
            <v-card-actions class="pa-3 pa-sm-4 justify-center bg-light">
              <v-chip size="small" variant="text" class="text-grey">
                <v-icon start size="14">mdi-clock-outline</v-icon>
                <span class="text-caption">{{ fechaActual }}</span>
              </v-chip>
            </v-card-actions>
          </v-card>
        </v-scale-transition>

        <!-- Copyright -->
        <v-fade-transition>
          <v-row v-if="isLoaded" justify="center" class="mt-4 mt-sm-6" no-gutters>
            <v-col cols="12" class="text-center">
              <p class="text-caption text-grey ma-0">
                &copy; {{ currentYear }} Integrame. Todos los derechos reservados.
              </p>
            </v-col>
          </v-row>
        </v-fade-transition>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.header-section {
  background: #0058A4;
}

.card-main {
  overflow: hidden;
  max-width: 550px;
  margin: 0 auto;
}

.bg-light {
  background-color: #F4F6F7;
}

.text-grey {
  color: #96999B !important;
}

.text-grey-darken-1 {
  color: #96999B !important;
}

.text-primary {
  color: #0058A4 !important;
}

.info-light {
  background-color: #CDE3F1 !important;
}

.background {
  background-color: #F4F6F7 !important;
}

.text-wrap {
  white-space: normal !important;
  word-break: break-word !important;
}

.w-100 {
  width: 100%;
}
</style>
