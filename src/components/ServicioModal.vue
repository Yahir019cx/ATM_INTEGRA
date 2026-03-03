<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PayModal from './pay/ModalPay.vue'
import { crearRegistroPago, actualizarPago } from '@/services/api'

const { t } = useI18n()
const props = defineProps({
  modelValue: Boolean,
  servicioData: Object
})

const showPayModal = ref(false)
const openPayModal = async () => {
  // 💾 Crear registro inicial de pago en BD cuando se presiona "Pagar"
  try {
    const registroResponse = await crearRegistroPago(
      props.servicioData.orden.Orden,
      props.servicioData.cliente.RazonSocial || props.servicioData.cliente.Nombre,
      parseFloat(props.servicioData.orden.totales.Total)
    )

    // Guardar registroId en localStorage
    if (registroResponse?.registroId) {
      localStorage.setItem('registroId', registroResponse.registroId)
      console.log('✅ Registro de pago creado:', registroResponse.registroId)
    }
  } catch (error) {
    console.error('❌ Error al crear registro de pago:', error)
    // No bloqueamos el flujo si falla el registro
  }

  showPayModal.value = true
}

const emit = defineEmits(['update:modelValue', 'cancelar', 'pago-completado'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Cerrar el PayModal cuando se cierra el ServicioModal
watch(() => props.modelValue, (newVal) => {
  if (!newVal && showPayModal.value) {
    showPayModal.value = false
  }
})
// Función para formatear moneda
const formatCurrency = (amount) => {
  if (!amount) return '0.00'
  const num = parseFloat(amount)
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
const clienteConDatos = computed(() => {
  if (!props.servicioData?.cliente) return {}
  
  const cliente = {}
  Object.entries(props.servicioData.cliente).forEach(([campo, valor]) => {
    if (valor && valor.trim() !== '') {
      cliente[campo] = valor
    }
  })
  return cliente
})

const ordenConDatos = computed(() => {
  if (!props.servicioData?.orden) return {}
  
  const orden = {}
  const camposOrden = ['Orden', 'Asesor', 'Marca', 'Modelo', 'AnoAuto', 'Placas', 'Serie']
  
  camposOrden.forEach(campo => {
    const valor = props.servicioData.orden[campo]
    if (valor && valor.trim() !== '') {
      orden[campo] = valor
    }
  })
  
  return orden
})

const vehiculoInfo = computed(() => {
  const { Marca = '', Modelo = '', AnoAuto = '' } = props.servicioData?.orden || {}
  const vehiculo = [Marca, Modelo, AnoAuto].filter(item => item && item.trim() !== '').join(' ')
  return vehiculo || null
})

function EtiquetaCliente(campo) {
  return t(`servicio.etiquetasCliente.${campo}`, campo)
}

function EtiquetaOrden(campo) {
  return t(`servicio.etiquetasOrden.${campo}`, campo)
}

function handlePagoExitoso(data) {
  console.log('Pago exitoso:', data)
  showPayModal.value = false

  // Cerrar el ServicioModal
  visible.value = false

  // Emitir evento para que PantallaATM consulte el XML y abra facturación
  emit('pago-completado', {
    success: true,
    transactionId: data.transactionId,
    amount: data.amount,
    email: data.email // Pasar el email del ModalPay
  })
}

async function handlePagoError(data) {
  console.error('Error en el pago:', data)

  // Actualizar registro como fallido
  const registroId = localStorage.getItem('registroId')
  if (registroId) {
    try {
      await actualizarPago(registroId, 'N/A', 'N/A', 'failed')
      console.log('✅ Registro de pago actualizado como fallido')
    } catch (error) {
      console.error('❌ Error al actualizar registro de pago fallido:', error)
    }
  }
}

defineExpose({ showPayModal })
</script>

<template>
  <!-- PRUEBAS: :monto="1" | PRODUCCIÓN: :monto="servicioData?.orden?.totales?.Total || 0" -->
  <PayModal
    v-model="showPayModal"
    :monto="1"
    :datosCliente="servicioData?.cliente || {}"
    :servicioData="servicioData || {}"
    @pago-exitoso="handlePagoExitoso"
    @pago-error="handlePagoError"
    @cancelar="showPayModal = false"
  />
  <v-dialog v-model="visible" persistent max-width="1000" scrollable>
    <v-card class="elevation-12 rounded-xl">
      <!-- Header -->
      <v-card-title class="gradient-header text-black text-h4 font-weight-medium py-4 mt-5 text-center">
        {{ t('servicio.detalles') }}
      </v-card-title>

      <v-card-text class="pa-8">
        <!-- Layout principal en grid -->
        <v-row class="mb-3">
          <!-- Columna izquierda: Cliente -->
          <v-col cols="6">
            <div class="info-section">
              <div class="section-header">
                <v-icon class="mr-2 section-icon">mdi-account</v-icon>
                <h3 class="section-title">{{ t('servicio.infoCliente') }}</h3>
              </div>
              <div class="info-card">
                <!-- Solo campos con datos -->
                <template v-for="(valor, campo) in clienteConDatos" :key="campo">
                  <v-row class="info-row">
                    <v-col cols="5" class="info-label">
                      {{ EtiquetaCliente(campo) }}
                    </v-col>
                    <v-col cols="7" class="info-value">
                      {{ valor }}
                    </v-col>
                  </v-row>
                </template>
              </div>
            </div>
          </v-col>
          <!-- Columna derecha: Orden + Cargos -->
          <v-col cols="6">
            <!-- Información de la Orden -->
            <div class="info-section">
              <div class="section-header">
                <v-icon class="mr-2 section-icon">mdi-clipboard-text</v-icon>
                <h3 class="section-title">{{ t('servicio.infoOrden') }}</h3>
              </div>
              <div class="info-card">
                <!-- Solo campos de orden con datos -->
                <template v-for="(valor, campo) in ordenConDatos" :key="campo">
                  <!-- Vehículo -->
                  <template v-if="campo === 'Marca'">
                    <div v-if="vehiculoInfo" class="info-row">
                      <div class="info-label">{{ t('servicio.vehiculo') }}:</div>
                      <div class="info-value vehicle-info">{{ vehiculoInfo }}</div>
                    </div>
                  </template>
                  <!-- Otros campos normales-->
                  <template v-else-if="campo !== 'Modelo' && campo !== 'AnoAuto'">
                    <div class="info-row">
                      <div class="info-label">{{ EtiquetaOrden(campo) }}:</div>
                      <div class="info-value" :class="{ 'order-number': campo === 'Orden' }">{{ valor }}</div>
                    </div>
                  </template>
                </template>
              </div>
            </div>

            <!-- Cargos del Servicio -->
            <div class="info-section" v-if="servicioData?.orden?.cargos?.length > 0">
              <div class="section-header">
                <v-icon class="mr-2 section-icon">mdi-cash</v-icon>
                <h3 class="section-title">{{ t('servicio.cargos') }}</h3>
              </div>
              <div class="cargos-container">
                <div 
                  v-for="(cargo, index) in servicioData.orden.cargos" 
                  :key="index" 
                  class="cargo-card mb-2"
                >
                  <div class="cargo-header">
                    <span class="cargo-code">#{{ cargo.CodigoInterv }}</span>
                    <span class="cargo-amount">${{ formatCurrency(cargo.TotalInterv) }}</span>
                  </div>
                  <div class="cargo-description">{{ cargo.Descripcion }}</div>
                </div>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- Totales en formato destacado -->
        <div class="totales-section" v-if="servicioData?.orden?.totales?.Total">
          <div class="section-header totales-header">
            <h3 class="section-title mt-1">{{ t('servicio.resumen') }}</h3>
          </div>
          <div class="totales-card">
            <v-row class="totales-row" v-if="servicioData.orden.totales.Subtotal">
              <v-col cols="4" class="total-label">{{ t('servicio.subtotal') }}:</v-col>
              <v-col cols="8" class="total-value">${{ formatCurrency(servicioData.orden.totales.Subtotal) }}</v-col>
            </v-row>
            <v-row class="totales-row" v-if="servicioData.orden.totales.Impuesto">
              <v-col cols="4" class="total-label">{{ t('servicio.impuesto') }}:</v-col>
              <v-col cols="8" class="total-value">${{ formatCurrency(servicioData.orden.totales.Impuesto) }}</v-col>
            </v-row>
            <v-divider class="my-1"></v-divider>
            <v-row class="totales-row final-total">
              <v-col cols="4" class="total-label-final">{{ t('servicio.total') }}:</v-col>
              <v-col cols="8" class="total-value-final">${{ formatCurrency(servicioData.orden.totales.Total) }}</v-col>
            </v-row>
          </div>
        </div>
      </v-card-text>

      <!-- Botones modernos -->
      <v-card-actions class="action-buttons pa-8">
        <v-btn 
          color="error" 
          variant="outlined" 
          size="large" 
          class="flex-1 mr-3 cancel-btn"
          @click="$emit('cancelar')"
        >
          <v-icon class="mr-2">mdi-close</v-icon>
          {{ t('servicio.cancelar') }}
        </v-btn>
        <v-btn 
          color="primary" 
          variant="elevated" 
          size="large" 
          class="flex-1 pay-btn"
          @click="openPayModal()"
        >
          <v-icon class="mr-2">mdi-credit-card</v-icon>
          {{ t('servicio.pagar') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.gradient-header {
  border-radius: 12px 12px 0 0;
  margin-bottom: -16px;
}

.info-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.section-header.totales-header {
  justify-content: center;
}

.section-icon {
  color: #242424;
  font-size: 23px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.info-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #e9ecef;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #dee2e6;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: #6c757d;
  font-size: 14px;
  flex: 0 0 40%;
}

.info-value {
  color: #2c3e50;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.order-number {
  color: success;
  font-weight: 700;
  font-size: 16px;
}

.vehicle-info {
  font-weight: 600;
  color: #495057;
}

.cargos-container {
  max-height: 480px;
  overflow-y: auto;
  padding-right: 8px;
}

.cargos-container::-webkit-scrollbar {
  width: 6px;
}

.cargos-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.cargos-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.cargos-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.cargo-card {
  background: white;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.cargo-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.cargo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.cargo-code {
  background: linear-gradient(135deg, #0a9970, #059669);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}

.cargo-amount {
  font-size: 18px;
  font-weight: 700;
  color: #28a745;
}

.cargo-description {
  color: #6c757d;
  font-size: 14px;
  line-height: 1.4;
}

.totales-section {
  background: white;
  border-radius: 12px;
  padding: 0;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.totales-card {
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 0 0 12px 12px;
}

.totales-row {
  margin: 0;
  padding: 2px 0;
}

.total-label {
  font-weight: 600;
  color: #6c757d;
  font-size: 16px;
}

.total-value {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  text-align: right;
}

.final-total {
  background: linear-gradient(135deg, #0a9970 60%, #07b880 100%);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
}

.total-label-final {
  font-weight: 700;
  color: white;
  font-size: 18px;
}

.total-value-final {
  font-size: 20px;
  font-weight: 700;
  color: white;
  text-align: right;
}

.action-buttons {
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
  display: flex;
  gap: 16px;
}

.cancel-btn {
  border-radius: 8px;
  text-transform: none;
  font-weight: 600;
}

.pay-btn {
  border-radius: 8px;
  text-transform: none;
  font-weight: 600;
  background: linear-gradient(135deg, #06a573 60%, #06a573 100%);
}

.flex-1 {
  flex: 1;
}
</style>