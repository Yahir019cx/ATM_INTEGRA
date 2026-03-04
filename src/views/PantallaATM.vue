<script setup>
import Overlay from '@/components/Overlay.vue'
import OverlayRFC from '@/components/OverlayRFC.vue'
import KioskButton from '@/components/KioskButton.vue'
import ServicioModal from '@/components/ServicioModal.vue'
import DialogoErrorServicio from '@/components/DialogAlert.vue'
import DialogoNotificacion from '@/components/DialogoNotificacion.vue'
import FormularioFacturacion from '@/components/FormularioFacturacion.vue'
import Card from '@/assets/animations/CardC.json'
import Service from '@/assets/animations/Service.json'
import Document from '@/assets/animations/Document.json'
import Bot from '@/assets/animations/Chatbot.json'
import ShopCar from '@/assets/animations/CarParts.json'
import CarruselPublicidad from '@/components/CarruselPublicidad.vue'
import WarningMessage from '@/components/WarningMessage.vue'
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import FacturasModal from '@/components/FacturasModal.vue'
import { enviarSolicitudTelegram, actualizarPago, getClienteListByRFC, getArdocInvoices, insArdoc } from '@/services/api'
import axios from 'axios'

import { usePublicidad } from '@/composables/usePublicidad'
import { useInactivityTimer } from '@/composables/useInactivityTimer'
import { useQRScanner } from '@/composables/useQRScanner'
import { usePaymentFlow } from '@/composables/usePaymentFlow'

const { t, locale } = useI18n()

// Detectar si viene de 3D Secure o tiene pago de facturas pendiente
const urlParams = new URLSearchParams(window.location.search)
const viene3DSecure = urlParams.has('id')
const tienePendingFacturas = !!localStorage.getItem('pendingFacturas')

// Estado principal
const mostrarCarrusel = ref(!viene3DSecure && !tienePendingFacturas)
const mostrandoOverlay = ref(false)
const overlayTipo = ref('ScanQR')
const mostrarModalServicio = ref(false)
const mostrarOverlayRFC = ref(false)
const overlayRFCModo = ref('input')
const datosServicio = ref({})
const servicioModalRef = ref(null)
const mostrarModalFacturas = ref(false)
const facturasCliente = ref([])
const clienteActual = ref({})
const clienteEmpresaClaveActual = ref('')

// Variables para diálogos
const mostrarDialogoError = ref(false)
const mensajeError = ref('')
const mostrarDialogoAsistencia = ref(false)
const cargandoAsistencia = ref(false)
const tipoNotificacionAsistencia = ref('success')
const tituloAsistencia = ref('')
const mensajeAsistencia = ref('')
const submensajeAsistencia = ref('')

// Composables
const {
  logoUrl, publicidadFiltrada, empresa, carruselKey,
  refrescarPublicidad, iniciarSSE
} = usePublicidad()

const {
  qrCodeValue, qrInput, tipoServicioSeleccionado,
  enfocarInputQR, onQRScan, resetearEstados, extraerDatosXML
} = useQRScanner({
  mostrandoOverlay, overlayTipo, mostrarAdvertencia: computed(() => inactivity.mostrarAdvertencia.value),
  mostrarModalServicio, datosServicio, mostrarDialogoError, mensajeError
})

const payment = usePaymentFlow({
  datosServicio, mostrandoOverlay, overlayTipo,
  mostrarCarrusel, mostrarModalServicio, extraerDatosXML
})

const overlayActivo = computed(() => mostrandoOverlay.value && !inactivity.mostrarAdvertencia.value)

// Función central de reset - cierra ABSOLUTAMENTE TODO
function resetearTodo() {
  // Cerrar modal de servicio
  if (mostrarModalServicio.value) cerrarModal()

  // Cerrar sub-diálogos del ServicioModal
  if (servicioModalRef.value?.billingFormDialog?.dialog) {
    servicioModalRef.value.billingFormDialog.dialog = false
  }
  if (servicioModalRef.value?.billingFormDialog?.cerrarResultDialog) {
    servicioModalRef.value.billingFormDialog.cerrarResultDialog()
  }

  // Cerrar overlay y RFC overlay
  mostrandoOverlay.value = false
  overlayTipo.value = 'ScanQR'
  mostrarOverlayRFC.value = false
  overlayRFCModo.value = 'input'

  // Cerrar diálogos de error y asistencia
  mostrarDialogoError.value = false
  mensajeError.value = ''
  mostrarDialogoAsistencia.value = false
  cargandoAsistencia.value = false
  tipoNotificacionAsistencia.value = 'success'
  tituloAsistencia.value = ''
  mensajeAsistencia.value = ''
  submensajeAsistencia.value = ''

  // Resetear QR
  tipoServicioSeleccionado.value = ''
  qrCodeValue.value = ''
  datosServicio.value = {}

  // Resetear flujo de pago completo
  payment.resetearPaymentFlow()

  // Limpiar localStorage
  payment.limpiarLocalStorage()

  // Cancelar speechSynthesis si está hablando
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// Timer de inactividad
const inactivity = useInactivityTimer({
  onTimeout: () => {
    resetearTodo()
    mostrarCarrusel.value = true
  },
  onCancelado: () => {
    if (mostrandoOverlay.value) enfocarInputQR()
  },
  isCarruselVisible: () => mostrarCarrusel.value
})

// Voz de bienvenida
function hablarBienvenida() {
  if ('speechSynthesis' in window && empresa.value) {
    const synth = window.speechSynthesis
    const mensaje = new SpeechSynthesisUtterance(
      `Hola, bienvenido a ${empresa.value}, estamos listos para ayudarte, selecciona una opción para continuar.`
    )
    const voces = synth.getVoices()
    const voz = voces.find(v => v.name.includes('Sabina'))
    if (voz) mensaje.voice = voz
    mensaje.lang = 'es-MX'
    mensaje.rate = 0.8
    mensaje.pitch = 1
    mensaje.volume = 3
    synth.speak(mensaje)
  }
}

function cerrarCarrusel() {
  resetearTodo()
  mostrarCarrusel.value = false
  inactivity.iniciarTimerAdvertencia()
  hablarBienvenida()
}

function toggleLang() {
  locale.value = locale.value === 'es' ? 'en' : 'es'
}

// Funciones principales
function onPress(opcion) {
  if (opcion === 'asistencia') {
    manejarAsistencia()
    return
  }
  if (opcion === 'factura') {
    mostrarOverlayRFC.value = true
    return
  }
  tipoServicioSeleccionado.value = opcion
  qrCodeValue.value = ''
  mostrandoOverlay.value = true
  overlayTipo.value = 'ScanQR'
}

// Asistencia
async function manejarAsistencia() {
  cargandoAsistencia.value = true
  try {
    const exito = await enviarSolicitudTelegram()
    const config = exito
      ? {
          tipo: 'success',
          titulo: t('asistencia.tituloExito'),
          mensaje: t('asistencia.mensajeExito'),
          submensaje: t('asistencia.submensajeExito')
        }
      : {
          tipo: 'error',
          titulo: t('asistencia.tituloError'),
          mensaje: t('asistencia.mensajeError'),
          submensaje: t('asistencia.submensajeError')
        }
    mostrarNotificacionAsistencia(config)
  } catch (error) {
    console.error('Error en manejarAsistencia:', error)
    mostrarNotificacionAsistencia({
      tipo: 'error',
      titulo: t('asistencia.tituloInesperado'),
      mensaje: t('asistencia.mensajeInesperado'),
      submensaje: t('asistencia.submensajeInesperado')
    })
  } finally {
    cargandoAsistencia.value = false
  }
}

function mostrarNotificacionAsistencia(config) {
  tipoNotificacionAsistencia.value = config.tipo
  tituloAsistencia.value = config.titulo
  mensajeAsistencia.value = config.mensaje
  submensajeAsistencia.value = config.submensaje
  mostrarDialogoAsistencia.value = true
}

// Cierre de diálogos
function cerrarDialogoError() {
  mostrarDialogoError.value = false
  mensajeError.value = ''
}

function cerrarDialogoAsistencia() {
  mostrarDialogoAsistencia.value = false
  tipoNotificacionAsistencia.value = 'success'
  tituloAsistencia.value = ''
  mensajeAsistencia.value = ''
  submensajeAsistencia.value = ''
}

function cerrarModal() {
  mostrarModalServicio.value = false
  datosServicio.value = {}
  qrCodeValue.value = ''
  tipoServicioSeleccionado.value = ''
}

async function onConfirmarRFC(_rfc) {
  overlayRFCModo.value = 'cargando'
  try {
    const { cliente, clienteEmpresaClave } = await getClienteListByRFC(_rfc)

    if (!cliente || !clienteEmpresaClave) {
      overlayRFCModo.value = 'input'
      mensajeError.value = 'No se encontró información del cliente con ese RFC.'
      mostrarDialogoError.value = true
      mostrarOverlayRFC.value = false
      return
    }

    const facturas = await getArdocInvoices(clienteEmpresaClave)

    if (!facturas.length) {
      overlayRFCModo.value = 'input'
      mensajeError.value = 'No se encontraron facturas pendientes de pago.'
      mostrarDialogoError.value = true
      mostrarOverlayRFC.value = false
      return
    }

    clienteActual.value = cliente
    clienteEmpresaClaveActual.value = clienteEmpresaClave
    facturasCliente.value = facturas

    overlayRFCModo.value = 'exito'
    setTimeout(() => {
      mostrarOverlayRFC.value = false
      overlayRFCModo.value = 'input'
      mostrarModalFacturas.value = true
    }, 1500)
  } catch (e) {
    console.error('Error al consultar RFC:', e)
    overlayRFCModo.value = 'input'
    mensajeError.value = 'Error al consultar el RFC. Intente nuevamente.'
    mostrarDialogoError.value = true
    mostrarOverlayRFC.value = false
  }
}

function onCancelarRFC() {
  mostrarOverlayRFC.value = false
  overlayRFCModo.value = 'input'
}

async function onPagoFacturasCompletado(data) {
  mostrarModalFacturas.value = false

  mostrandoOverlay.value = true
  overlayTipo.value = 'Load'

  try {
    // Generar Folio (6 dígitos) y Serie (3 letras) al azar
    const folio = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const serie = Array.from({ length: 3 }, () => letras[Math.floor(Math.random() * 26)]).join('')

    const resultado = await insArdoc({
      custId: clienteEmpresaClaveActual.value,
      totalPayment: data.amount,
      formaPago: data.formaPago || '04',
      folio,
      serie,
      facturas: data.desglose
    })

    if (resultado.result !== 200) {
      throw new Error(resultado.message || 'Error al registrar pago en ERP')
    }

    // Actualizar registro de pago local
    const registroId = localStorage.getItem('registroId')
    if (registroId) {
      try {
        await actualizarPago(registroId, data.transactionId, data.email || 'N/A', 'completed')
      } catch (err) {
        console.error('Error al actualizar registro de pago:', err)
      }
    }

    mostrandoOverlay.value = false

    // Todo exitoso, limpiar datos de facturas
    localStorage.removeItem('pendingFacturas')

    // Mostrar éxito y volver al carrusel
    payment.transactionIdPago.value = data.transactionId
    payment.mostrarPagoExitoso.value = true

  } catch (error) {
    console.error('Error al registrar pago en ERP:', error)
    mostrandoOverlay.value = false
    mensajeError.value = error.message || 'Error al registrar el pago en el sistema.'
    mostrarDialogoError.value = true
  } finally {
    localStorage.removeItem('registroId')
    localStorage.removeItem('paymentEmail')
    localStorage.removeItem('pendingPayment')
  }
}

async function onFacturacionCompletada() {
  await payment.continuarFlujoPostFactura()
}

// Manejo de 3D Secure
async function verificar3DSecure() {
  const urlParams = new URLSearchParams(window.location.search)
  const transactionId = urlParams.get('id')
  if (!transactionId) return

  try {
    const response = await axios.post(
      'https://app01.grupomhautomotriz.com:3000/api/transaction_id',
      { id: transactionId },
      { headers: { 'Content-Type': 'application/json' } }
    )

    const isSuccess = response.data.success && response.data.charge?.status === 'completed'

    if (isSuccess) {
      const pendingPaymentStr = localStorage.getItem('pendingPayment')
      const pendingPayment = pendingPaymentStr ? JSON.parse(pendingPaymentStr) : null
      const email = pendingPayment?.email || 'N/A'
      const formaPago = pendingPayment?.formaPago || '04'

      window.history.replaceState({}, document.title, window.location.pathname)
      localStorage.removeItem('pendingPayment')

      // Detectar si es pago de facturas
      const pendingFacturasStr = localStorage.getItem('pendingFacturas')
      if (pendingFacturasStr) {
        const pendingFacturas = JSON.parse(pendingFacturasStr)
        clienteEmpresaClaveActual.value = pendingFacturas.custId

        await onPagoFacturasCompletado({
          success: true,
          transactionId: response.data.charge.id,
          amount: pendingFacturas.totalAPagar,
          email,
          formaPago,
          desglose: pendingFacturas.desglose
        })
        return
      }

      await payment.handlePagoCompletado({
        transactionId: response.data.charge.id,
        amount: response.data.charge.amount,
        email,
        formaPago
      })
    } else {
      console.error('Pago no completado')
      await manejarPagoFallido(transactionId)
    }
  } catch (error) {
    console.error('Error al verificar pago:', error)
    await manejarPagoFallido('N/A')
  }
}

async function manejarPagoFallido(transactionId) {
  const registroId = localStorage.getItem('registroId')
  if (registroId) {
    try {
      await actualizarPago(registroId, transactionId || 'N/A', 'N/A', 'failed')
    } catch (updateError) {
      console.error('Error al actualizar registro de pago fallido:', updateError)
    }
  }
  localStorage.removeItem('pendingFacturas')
  payment.limpiarLocalStorage()
  mostrarCarrusel.value = true
}

// Lifecycle
onMounted(async () => {
  inactivity.registrarEventosGlobales()
  await refrescarPublicidad()
  iniciarSSE()

  // SIEMPRE verificar primero si hay facturas pendientes en localStorage
  const pendingFacturasStr = localStorage.getItem('pendingFacturas')
  if (pendingFacturasStr) {
    const pendingFacturas = JSON.parse(pendingFacturasStr)

    if (pendingFacturas && pendingFacturas.desglose && pendingFacturas.custId) {
      clienteEmpresaClaveActual.value = pendingFacturas.custId

      // Si viene de 3D Secure, verificar el pago primero para obtener transactionId real
      if (viene3DSecure) {
        const urlP = new URLSearchParams(window.location.search)
        const txId = urlP.get('id')
        if (txId) {
          try {
            const response = await axios.post(
              'https://app01.grupomhautomotriz.com:3000/api/transaction_id',
              { id: txId },
              { headers: { 'Content-Type': 'application/json' } }
            )
            window.history.replaceState({}, document.title, window.location.pathname)
            localStorage.removeItem('pendingPayment')

            if (response.data.success && response.data.charge?.status === 'completed') {
              const pendingPayment = JSON.parse(localStorage.getItem('pendingPayment') || 'null')
              pendingFacturas.transactionId = response.data.charge.id
              pendingFacturas.email = pendingPayment?.email || pendingFacturas.email || 'N/A'
              pendingFacturas.formaPago = pendingPayment?.formaPago || pendingFacturas.formaPago || '04'
            } else {
              await manejarPagoFallido(txId)
              return
            }
          } catch (err) {
            console.error('Error verificando 3D Secure:', err)
            await manejarPagoFallido('N/A')
            return
          }
        }
      }

      await onPagoFacturasCompletado({
        success: true,
        transactionId: pendingFacturas.transactionId || 'N/A',
        amount: pendingFacturas.totalAPagar,
        email: pendingFacturas.email || 'N/A',
        formaPago: pendingFacturas.formaPago || '04',
        desglose: pendingFacturas.desglose
      })
    } else {
      localStorage.removeItem('pendingFacturas')
      mostrarCarrusel.value = true
    }
  } else if (viene3DSecure) {
    // Solo servicios (no facturas)
    await verificar3DSecure()
  }
})

// Watch para enfocar input QR
watch(mostrandoOverlay, (nuevoValor) => {
  if (nuevoValor && !inactivity.mostrarAdvertencia.value) {
    nextTick(enfocarInputQR)
  }
}, { flush: 'post' })
</script>

<template>
  <CarruselPublicidad v-if="mostrarCarrusel" :imagenes="publicidadFiltrada" :key="carruselKey"
    @click="cerrarCarrusel" />
  <v-app>
    <Overlay :visible="overlayActivo" :animation="overlayTipo" @close="resetearEstados" />
    <OverlayRFC
      :visible="mostrarOverlayRFC"
      :modo="overlayRFCModo"
      @confirmar="onConfirmarRFC"
      @cancelar="onCancelarRFC"
    />
    <v-text-field v-show="mostrandoOverlay" v-model="qrCodeValue" ref="qrInput" hide-details variant="underlined"
      @keydown.enter="onQRScan" style="opacity: 0; position: fixed; pointer-events: none; z-index: -1"
      autocomplete="off" />
    <WarningMessage :model-value="inactivity.mostrarAdvertencia.value" :countdown="inactivity.countdown.value"
      @update:modelValue="val => inactivity.mostrarAdvertencia.value = val" @cancelWarning="inactivity.cancelarAdvertencia" />
    <ServicioModal ref="servicioModalRef" v-model="mostrarModalServicio" :servicioData="datosServicio" @cancelar="cerrarModal" @pago-completado="payment.handlePagoCompletado"/>
    <FacturasModal
      v-model="mostrarModalFacturas"
      :facturas="facturasCliente"
      :cliente="clienteActual"
      :clienteEmpresaClave="clienteEmpresaClaveActual"
      @cancelar="mostrarModalFacturas = false"
      @pago-completado="onPagoFacturasCompletado"
    />
    <DialogoErrorServicio v-model="mostrarDialogoError" :mensaje="mensajeError" @cerrar="cerrarDialogoError" />

    <!-- Modal de Pregunta Factura -->
    <v-dialog v-model="payment.mostrarPreguntaFactura.value" max-width="500" persistent>
      <v-card rounded="lg">
        <v-card-title class="d-flex justify-center align-center pt-6">
          <div class="text-h5 text-medium-emphasis">¿Requiere factura?</div>
        </v-card-title>
        <v-card-text>
          <div class="py-8 text-center">
            <v-icon class="mb-6" color="primary" icon="mdi-receipt-text-outline" size="100"></v-icon>
            <div class="text-body-1">
              ¿Desea recibir una liga para facturar este servicio en su correo electrónico?
            </div>
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="pa-4 d-flex justify-center ga-4">
          <v-btn size="large" variant="outlined" color="grey" rounded="lg" class="px-8" @click="payment.responderFactura(false)">
            No, gracias
          </v-btn>
          <v-btn size="large" variant="flat" color="primary" rounded="lg" class="px-8" @click="payment.responderFactura(true)">
            Sí, quiero factura
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Modal de Formulario de Facturación -->
    <FormularioFacturacion
      v-model="payment.mostrarFormularioFactura.value"
      :datos-cliente="datosServicio.cliente"
      :service-call-id="datosServicio.orden?.Orden"
      :cpny-id="payment.payloadTemporal.value?.CpnyId"
      :monto="parseFloat(datosServicio.orden?.totales?.Total) || 0"
      :auth="payment.datosPagoTemporal.value?.transactionId"
      :tipo="payment.payloadTemporal.value?.Tipo"
      :forma-pago="payment.datosPagoTemporal.value?.formaPago || '04'"
      @facturacion-completada="onFacturacionCompletada"
      @cancelar="payment.continuarFlujoPostFactura"
    />

    <!-- Modal de Pago Exitoso -->
    <v-dialog v-model="payment.mostrarPagoExitoso.value" max-width="500" persistent>
      <v-card rounded="lg">
        <v-card-title class="d-flex justify-center align-center">
          <div class="text-h5 text-medium-emphasis">¡Pago Exitoso!</div>
        </v-card-title>
        <v-divider class="mb-4"></v-divider>
        <v-card-text>
          <div class="py-12 text-center">
            <v-icon class="mb-6" color="success" icon="mdi-check-circle-outline" size="128"></v-icon>
            <div class="text-h5 font-weight-bold mb-4">Pago procesado correctamente</div>
            <div class="text-body-1">
              ID de transacción: <strong>{{ payment.transactionIdPago.value }}</strong>
            </div>
            <div v-if="payment.emailEnviado.value" class="text-body-2 mt-4 text-success d-flex align-center justify-center">
              Correo enviado con éxito a <strong class="ml-1">{{ payment.emailDestinatario.value }}</strong>
            </div>
            <div v-else-if="payment.emailError.value" class="text-body-2 mt-4 text-error d-flex align-center justify-center">
              Error al enviar correo a <strong class="ml-1">{{ payment.emailDestinatario.value }}</strong>
            </div>
          </div>
        </v-card-text>
        <v-divider class="mt-2"></v-divider>
        <v-card-actions class="my-2 d-flex justify-end">
          <v-btn class="text-none" color="primary" rounded="lg" variant="flat" @click="payment.cerrarPagoExitoso">
            Continuar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo de notificación de asistencia -->
    <DialogoNotificacion v-model="mostrarDialogoAsistencia" :tipo="tipoNotificacionAsistencia"
      :titulo="tituloAsistencia" :mensaje="mensajeAsistencia" :submensaje="submensajeAsistencia"
      @cerrar="cerrarDialogoAsistencia" />

    <v-container class="pa-16 fill-screen" fluid>
      <!-- Logo -->
      <v-row justify="center" class="mt-16">
        <v-img :src="logoUrl" alt="Logo Empresa" height="210" max-width="220" contain />
      </v-row>

      <!-- Título -->
      <v-row justify="center">
        <h1 class="text-h2 font-weight-bold mt-12">{{ $t('bienvenido') }} {{ empresa }}</h1>
      </v-row>

      <!-- Línea amarilla -->
      <v-row justify="center" class="my-12">
        <div class="yellow-divider" />
      </v-row>

      <!-- Botones principales (2x2) -->
      <v-row class="mt-14" justify="center">
        <v-col cols="5" class="d-flex justify-center">
          <KioskButton :icon="Service" :text="$t('pagarServicio')" @click="onPress('servicio')" />
        </v-col>
        <v-col cols="5" class="d-flex justify-center">
          <KioskButton :icon="Card" :text="$t('pagoAnticipo')" @click="onPress('anticipo')" />
        </v-col>
      </v-row>

      <v-row class="mt-14" justify="center">
        <v-col cols="5" class="d-flex justify-center">
          <KioskButton :icon="ShopCar" :text="$t('pagarRefaccion')" @click="onPress('refaccion')" />
        </v-col>
        <v-col cols="5" class="d-flex justify-center">
          <KioskButton :icon="Document" :text="$t('abonoFactura')" @click="onPress('factura')" />
        </v-col>
      </v-row>

      <v-row justify="center" class="mt-14">
        <v-col cols="auto">
          <KioskButton :icon="Bot" :text="$t('recibirAsistencia')" :loading="cargandoAsistencia" block
            style="width: 830px" text-offset="20px" @click="onPress('asistencia')" />
        </v-col>
      </v-row>

      <!-- Cambiar idioma -->
      <v-row justify="center" class="mt-16">
        <v-btn color="white" class="text-h5 font-weight-medium elevation-3 px-16" @click="toggleLang"
          style="touch-action: manipulation;">
          {{ $t('cambiarIdioma') }}
        </v-btn>
      </v-row>
    </v-container>
  </v-app>
</template>

<style scoped>
.fill-screen {
  height: 100vh;
  width: 100vw;
  background-color: white;
}

.yellow-divider {
  width: 80%;
  height: 4px;
  background-color: #fcd500;
  border-radius: 2px;
}
</style>