<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PayModal from './pay/ModalPay.vue'
import { crearRegistroPago, actualizarPago } from '@/services/api'

const { t } = useI18n()

const props = defineProps({
  modelValue: Boolean,
  facturas: { type: Array, default: () => [] },
  cliente: { type: Object, default: () => ({}) },
  clienteEmpresaClave: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'cancelar', 'pago-completado'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})



// Estado de selección: { [index]: { selected: bool, monto: number } }
const seleccion = ref({})

// Inicializar selección cuando cambian las facturas
watch(() => props.facturas, (facturas) => {
  const sel = {}
  facturas.forEach((f, i) => {
    sel[i] = { selected: false, monto: f.Saldo }
  })
  seleccion.value = sel
}, { immediate: true })


const facturasSeleccionadas = computed(() => {
  return props.facturas
    .map((f, i) => ({ ...f, index: i, monto: seleccion.value[i]?.monto || 0 }))
    .filter((_, i) => seleccion.value[i]?.selected)
})

const totalAPagar = computed(() => {
  return facturasSeleccionadas.value.reduce((sum, f) => sum + f.monto, 0)
})

const haySeleccion = computed(() => facturasSeleccionadas.value.length > 0 && totalAPagar.value > 0)

function toggleFactura(index) {
  seleccion.value[index].selected = !seleccion.value[index].selected
}

function actualizarMonto(index, valor) {
  const max = props.facturas[index].Saldo
  const num = parseFloat(valor) || 0
  seleccion.value[index].monto = Math.min(Math.max(0, num), max)
}

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// --- Pago ---
const showPayModal = ref(false)

async function openPayModal() {
  try {
    const nombre = props.cliente.RazonSocial || props.cliente.NombreCompleto || props.cliente.Nombres || ''
    const registroResponse = await crearRegistroPago(
      props.clienteEmpresaClave,
      nombre,
      totalAPagar.value
    )
    if (registroResponse?.registroId) {
      localStorage.setItem('registroId', registroResponse.registroId)
    }
  } catch (error) {
    console.error('Error al crear registro de pago:', error)
  }
  showPayModal.value = true
}

function handlePagoExitoso(data) {
  showPayModal.value = false
  visible.value = false

  const desglose = facturasSeleccionadas.value.map(f => ({
    NoFactura: f.NoFactura,
    monto: f.monto
  }))

  emit('pago-completado', {
    success: true,
    transactionId: data.transactionId,
    amount: data.amount,
    email: data.email,
    desglose
  })
}

async function handlePagoError(data) {
  console.error('Error en el pago:', data)
  const registroId = localStorage.getItem('registroId')
  if (registroId) {
    try {
      await actualizarPago(registroId, 'N/A', 'N/A', 'failed')
    } catch (error) {
      console.error('Error al actualizar registro de pago fallido:', error)
    }
  }
}

watch(() => props.modelValue, (val) => {
  if (!val && showPayModal.value) showPayModal.value = false
})
</script>

<template>
  <PayModal
    v-model="showPayModal"
    :monto="totalAPagar"
    :datosCliente="cliente"
    :servicioData="{ cliente, facturas: facturasSeleccionadas }"
    @pago-exitoso="handlePagoExitoso"
    @pago-error="handlePagoError"
    @cancelar="showPayModal = false"
  />

  <v-dialog v-model="visible" persistent max-width="900" scrollable>
    <v-card class="elevation-12 rounded-xl">
      <!-- Header -->
      <v-card-title class="gradient-header text-black text-h4 font-weight-medium py-4 mt-5 text-center">
        Facturas Pendientes
      </v-card-title>

      <v-card-text class="pa-6">
        <!-- Info cliente -->
        <div class="info-section mb-4">
          <div class="section-header">
            <v-icon class="mr-2 section-icon">mdi-account</v-icon>
            <h3 class="section-title">
              {{ cliente.RazonSocial || cliente.NombreCompleto || cliente.Nombres || 'Cliente' }}
            </h3>
          </div>
        </div>

        <!-- Lista de facturas -->
        <div class="facturas-container">
          <div
            v-for="(factura, index) in facturas"
            :key="index"
            class="factura-card"
            :class="{ 'factura-selected': seleccion[index]?.selected }"
            @click="toggleFactura(index)"
          >
            <!-- Fila principal -->
            <div class="factura-row">
              <v-checkbox
                :model-value="seleccion[index]?.selected"
                hide-details
                density="compact"
                color="#0a9970"
                class="flex-shrink-0 mt-0 pt-0"
                @click.stop="toggleFactura(index)"
              />
              <div class="factura-info">
                <!-- Línea 1: Número + Tipo + Fecha -->
                <div class="factura-top-row">
                  <span class="factura-numero">#{{ factura.NoFactura }}</span>
                  <v-chip
                    size="x-small"
                    :color="factura.Tipo === 'IN' ? 'primary' : 'warning'"
                    variant="flat"
                  >
                    {{ factura.Tipo }}
                  </v-chip>
                  <span class="factura-fecha">{{ formatDate(factura.FechaFactura) }}</span>
                </div>
                <!-- Línea 2: Montos en cajitas -->
                <div class="factura-montos-row">
                  <div class="monto-box">
                    <span class="monto-box-label">Importe</span>
                    <span class="monto-box-value">${{ formatCurrency(factura.ImporteFactura) }}</span>
                  </div>
                  <div class="monto-box monto-box--saldo">
                    <span class="monto-box-label">Saldo</span>
                    <span class="monto-box-value monto-box-value--saldo">${{ formatCurrency(factura.Saldo) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Monto a pagar (solo si seleccionada) -->
            <v-expand-transition>
              <div v-if="seleccion[index]?.selected" class="monto-input-row" @click.stop>
                <span class="monto-input-label">Monto a pagar:</span>
                <v-text-field
                  :model-value="seleccion[index]?.monto"
                  @update:model-value="actualizarMonto(index, $event)"
                  type="number"
                  prefix="$"
                  variant="outlined"
                  density="compact"
                  hide-details
                  :max="factura.Saldo"
                  :min="0"
                  step="0.01"
                  class="monto-input"
                  color="#0a9970"
                />
              </div>
            </v-expand-transition>
          </div>

          <div v-if="!facturas.length" class="text-center pa-8 text-grey">
            No se encontraron facturas pendientes
          </div>
        </div>

        <!-- Total -->
        <div v-if="haySeleccion" class="total-section">
          <div class="total-card">
            <span class="total-label-text">
              {{ facturasSeleccionadas.length }} factura{{ facturasSeleccionadas.length > 1 ? 's' : '' }} seleccionada{{ facturasSeleccionadas.length > 1 ? 's' : '' }}
            </span>
            <span class="total-amount">${{ formatCurrency(totalAPagar) }}</span>
          </div>
        </div>
      </v-card-text>

      <!-- Botones -->
      <v-card-actions class="action-buttons pa-6">
        <v-btn
          color="error"
          variant="outlined"
          size="large"
          class="flex-1 mr-3 cancel-btn"
          @click="$emit('cancelar')"
        >
          <v-icon class="mr-2">mdi-close</v-icon>
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          size="large"
          class="flex-1 pay-btn"
          :disabled="!haySeleccion"
          @click="openPayModal()"
        >
          <v-icon class="mr-2">mdi-credit-card</v-icon>
          Pagar ${{ formatCurrency(totalAPagar) }}
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
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
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

.facturas-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.facturas-container::-webkit-scrollbar {
  width: 5px;
}

.facturas-container::-webkit-scrollbar-track {
  background: transparent;
}

.facturas-container::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 10px;
}

/* ── Factura card ── */
.factura-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  border: 1.5px solid #edf2f7;
  cursor: pointer;
  transition: all 0.2s ease;
}

.factura-card:hover {
  border-color: #cbd5e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.factura-selected {
  border-color: #0a9970 !important;
  background: #f0fdf8;
}

.factura-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.factura-info {
  flex: 1;
  min-width: 0;
}

/* Línea superior: número, tipo, fecha */
.factura-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.factura-numero {
  font-weight: 700;
  font-size: 15px;
  color: #2c3e50;
}

.factura-fecha {
  color: #94a3b8;
  font-size: 13px;
  margin-left: auto;
}

/* Cajitas de montos */
.factura-montos-row {
  display: flex;
  gap: 10px;
}

.monto-box {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.monto-box--saldo {
  background: #fef2f2;
  border-color: #fecaca;
}

.monto-box-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.monto-box-value {
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}

.monto-box-value--saldo {
  color: #dc2626;
}

.monto-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.monto-input-label {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  white-space: nowrap;
}

.monto-input {
  max-width: 200px;
}

.total-section {
  margin-top: 16px;
}

.total-card {
  background: linear-gradient(135deg, #0a9970 60%, #07b880 100%);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-label-text {
  color: white;
  font-size: 16px;
  font-weight: 500;
}

.total-amount {
  color: white;
  font-size: 24px;
  font-weight: 700;
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
