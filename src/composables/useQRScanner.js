import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { consultarInfoServicioVenta } from '@/services/api'

const tiposServicio = {
  servicio: { codigo: 'S', key: 'pagarServicio' },
  anticipo: { codigo: 'A', key: 'pagoAnticipo' },
  refaccion: { codigo: 'E', key: 'pagarRefaccion' },
  factura: { codigo: 'F', key: 'abonoFactura' }
}

export function useQRScanner({ mostrandoOverlay, overlayTipo, mostrarAdvertencia, mostrarModalServicio, datosServicio, mostrarDialogoError, mensajeError }) {
  const { t } = useI18n()
  const qrCodeValue = ref('')
  const qrInput = ref(null)
  const tipoServicioSeleccionado = ref('')

  function enfocarInputQR() {
    nextTick(() => {
      const inputElement = qrInput.value?.$el?.querySelector('input')
      if (inputElement) {
        inputElement.focus()
        inputElement.addEventListener('blur', () => {
          setTimeout(() => {
            if (mostrandoOverlay.value && !mostrarAdvertencia.value) {
              inputElement.focus()
            }
          }, 100)
        })
      }
    })
  }

  function onQRScan() {
    const code = qrCodeValue.value || ''
    qrCodeValue.value = ''
    procesarCodigoEscaneado(code)
  }

  function obtenerNombreServicioPorCodigo(codigo) {
    const servicio = Object.values(tiposServicio).find(tipo => tipo.codigo === codigo)
    return servicio?.key ? t(servicio.key) : t('qr.servicioDesconocido')
  }

  function resetearEstados() {
    mostrandoOverlay.value = false
    overlayTipo.value = 'ScanQR'
    tipoServicioSeleccionado.value = ''
  }

  async function procesarCodigoEscaneado(code) {
    try {
      const url = new URL(code)
      const tipoQR = url.searchParams.get('tipo')
      const tipoSeleccionado = tiposServicio[tipoServicioSeleccionado.value]?.codigo

      if (tipoQR !== tipoSeleccionado) {
        const nombreCorrectoServicio = obtenerNombreServicioPorCodigo(tipoQR)
        mensajeError.value = t('qr.servicioIncorrecto', { servicio: nombreCorrectoServicio })
        mostrarDialogoError.value = true
        resetearEstados()
        return
      }

      const payload = {
        Tipo: tipoQR,
        CpnyId: url.searchParams.get('cpnzid'),
        Servicecallid: url.searchParams.get('id'),
        CustId: url.searchParams.get('custid')
      }

      localStorage.setItem('qrPayload', JSON.stringify(payload))

      overlayTipo.value = 'Load'
      const res = await consultarInfoServicioVenta(payload)

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(res, 'application/xml')

      datosServicio.value = extraerDatosXML(xmlDoc)
      overlayTipo.value = 'ScanSF'

      setTimeout(() => {
        resetearEstados()
        mostrarModalServicio.value = true
      }, 2240)

    } catch (e) {
      console.error('Error procesando QR:', e)
      mensajeError.value = 'Error al procesar el código QR. Por favor, intente nuevamente.'
      mostrarDialogoError.value = true
      resetearEstados()
    }
  }

  function extraerDatosXML(xmlDoc) {
    const clienteNode = xmlDoc.querySelector('Cliente')
    const camposCliente = ['CustId', 'RazonSocial', 'RFC', 'ApellidoPaterno', 'ApellidoMaterno',
      'Nombre', 'CodigoPostal', 'Calle', 'NoExterior', 'NoInterior', 'Colonia', 'Estado',
      'EMail', 'Telefono', 'Municipio', 'Ciudad', 'UsoCfdi', 'Regimen', 'Country', 'Clave',
      'LadaTelefono', 'TelefonoCelular', 'Genero']
    const cliente = {}
    camposCliente.forEach(campo => {
      cliente[campo] = clienteNode?.querySelector(campo)?.textContent || ''
    })

    const contenedor = xmlDoc.querySelector('Orden') || xmlDoc.querySelector('Embarque')
    const cargosNodes = contenedor?.querySelectorAll('Cargos') || []
    const cargos = Array.from(cargosNodes).map(cargo => ({
      CodigoInterv: cargo.querySelector('CodigoInterv')?.textContent || cargo.querySelector('NoArticulo')?.textContent || '',
      Descripcion: cargo.childNodes[1]?.nodeValue?.trim() || '',
      TotalInterv: cargo.querySelector('TotalInterv')?.textContent || cargo.querySelector('Total')?.textContent || ''
    }))

    const orden = {
      Orden: contenedor?.querySelector('Orden')?.textContent || contenedor?.querySelector('Embarque')?.textContent || '',
      Asesor: contenedor?.querySelector('Asesor')?.textContent || '',
      Placas: contenedor?.querySelector('Placas')?.textContent || '',
      Serie: contenedor?.querySelector('Serie')?.textContent || '',
      Marca: contenedor?.querySelector('Marca')?.textContent || '',
      Modelo: contenedor?.querySelector('Modelo')?.textContent || '',
      AnoAuto: contenedor?.querySelector('AnoAuto')?.textContent || '',
      cargos,
      totales: {
        Subtotal: contenedor?.querySelector('Totales Subtotal')?.textContent || '',
        Impuesto: contenedor?.querySelector('Totales Impuesto')?.textContent || '',
        Total: contenedor?.querySelector('Totales Total')?.textContent || ''
      }
    }

    return { cliente, orden }
  }

  return {
    tiposServicio,
    qrCodeValue,
    qrInput,
    tipoServicioSeleccionado,
    enfocarInputQR,
    onQRScan,
    resetearEstados,
    extraerDatosXML
  }
}
