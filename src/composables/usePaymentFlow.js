import { ref } from 'vue'
import { consultarInfoServicioVenta, actualizarPago, enviarEmailConQR } from '@/services/api'

export function usePaymentFlow({ datosServicio, mostrandoOverlay, overlayTipo, mostrarCarrusel, mostrarModalServicio, extraerDatosXML, hayPendingFacturas }) {
  const mostrarPreguntaFactura = ref(false)
  const mostrarFormularioFactura = ref(false)
  const mostrarPagoExitoso = ref(false)

  const datosPagoTemporal = ref(null)
  const payloadTemporal = ref(null)
  const emailGuardadoTemporal = ref('')

  const transactionIdPago = ref('')
  const emailEnviado = ref(false)
  const emailError = ref(false)
  const emailDestinatario = ref('')

  async function handlePagoCompletado(data) {
    const qrPayloadStr = localStorage.getItem('qrPayload')

    if (!qrPayloadStr) {
      console.error('No se encontró el payload del QR')
      mostrarCarrusel.value = hayPendingFacturas ? !hayPendingFacturas() : true
      return
    }

    try {
      mostrandoOverlay.value = true
      overlayTipo.value = 'Load'

      const payload = JSON.parse(qrPayloadStr)
      const res = await consultarInfoServicioVenta(payload)

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(res, 'application/xml')

      datosServicio.value = extraerDatosXML(xmlDoc)

      const emailGuardado = localStorage.getItem('paymentEmail') || data.email || 'N/A'

      const registroId = localStorage.getItem('registroId')
      if (registroId) {
        try {
          await actualizarPago(registroId, data.transactionId, emailGuardado, 'completed')
        } catch (error) {
          console.error('Error al actualizar registro de pago:', error)
        }
      }

      mostrandoOverlay.value = false

      datosPagoTemporal.value = data
      payloadTemporal.value = payload
      emailGuardadoTemporal.value = emailGuardado
      mostrarPreguntaFactura.value = true

    } catch (error) {
      console.error('Error al consultar XML:', error)
      mostrandoOverlay.value = false
      limpiarLocalStorage()
      mostrarCarrusel.value = hayPendingFacturas ? !hayPendingFacturas() : true
    }
  }

  async function responderFactura(quiereFactura) {
    mostrarPreguntaFactura.value = false

    if (quiereFactura) {
      mostrarFormularioFactura.value = true
    } else {
      await continuarFlujoPostFactura()
    }
  }

  async function continuarFlujoPostFactura() {
    mostrandoOverlay.value = true
    overlayTipo.value = 'Load'

    const datosEmail = {
      ordenId: datosServicio.value.orden?.Orden || 'N/A',
      clienteNombre: datosServicio.value.cliente?.Nombre
        ? `${datosServicio.value.cliente.Nombre} ${datosServicio.value.cliente.ApellidoPaterno} ${datosServicio.value.cliente.ApellidoMaterno}`.trim()
        : 'N/A',
      clienteEmail: emailGuardadoTemporal.value,
      vehiculo: `${datosServicio.value.orden?.Marca || ''} ${datosServicio.value.orden?.Modelo || ''} ${datosServicio.value.orden?.AnoAuto || ''}`.trim() || 'N/A',
      vehiculoSerie: datosServicio.value.orden?.Serie || 'N/A'
    }

    try {
      await enviarEmailConQR(datosEmail)
      emailEnviado.value = true
      emailError.value = false
      emailDestinatario.value = datosEmail.clienteEmail
    } catch (emailErrorCatch) {
      console.error('Error al enviar email:', emailErrorCatch)
      emailEnviado.value = false
      emailError.value = true
      emailDestinatario.value = datosEmail.clienteEmail
    }

    mostrandoOverlay.value = false

    limpiarLocalStorage()

    transactionIdPago.value = datosPagoTemporal.value?.transactionId || ''

    datosPagoTemporal.value = null
    payloadTemporal.value = null
    emailGuardadoTemporal.value = ''

    mostrarPagoExitoso.value = true
  }

  function cerrarPagoExitoso() {
    mostrarPagoExitoso.value = false
    transactionIdPago.value = ''
    emailEnviado.value = false
    emailError.value = false
    emailDestinatario.value = ''
    mostrarCarrusel.value = hayPendingFacturas ? !hayPendingFacturas() : true
  }

  function resetearPaymentFlow() {
    mostrarPreguntaFactura.value = false
    mostrarFormularioFactura.value = false
    mostrarPagoExitoso.value = false
    datosPagoTemporal.value = null
    payloadTemporal.value = null
    emailGuardadoTemporal.value = ''
    transactionIdPago.value = ''
    emailEnviado.value = false
    emailError.value = false
    emailDestinatario.value = ''
  }

  function limpiarLocalStorage() {
    localStorage.removeItem('qrPayload')
    localStorage.removeItem('pendingPayment')
    localStorage.removeItem('registroId')
    localStorage.removeItem('paymentEmail')
  }

  return {
    mostrarPreguntaFactura,
    mostrarFormularioFactura,
    mostrarPagoExitoso,
    datosPagoTemporal,
    payloadTemporal,
    emailGuardadoTemporal,
    transactionIdPago,
    emailEnviado,
    emailError,
    emailDestinatario,
    handlePagoCompletado,
    responderFactura,
    continuarFlujoPostFactura,
    cerrarPagoExitoso,
    resetearPaymentFlow,
    limpiarLocalStorage
  }
}
