<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { URL_Proxy } from '@/urls'
import Overlay from '@/components/Overlay.vue'
import {
  getCPList,
  getEstadoList,
  getMunicipioList,
  getCiudadList,
  getAsentamientoList,
  enviarDatosFacturacion,
  guardarClienteLocal,
  consultarInfoServicioVenta,
  crearServicioXML,
  timbrarFactura,
  closeService
} from '@/services/api'

const route = useRoute()

// Estado de carga inicial
const cargandoDatos = ref(true)
const errorCarga = ref(false)
const mensajeError = ref('')

// Datos del servicio obtenidos del QR
const datosServicio = ref({})

// Datos del payload para crear XML
const payloadQR = ref({
  tipo: '',
  cpnyId: '',
  serviceCallId: ''
})

// Formulario
const form = ref({
  custId: '',
  razonSocial: '',
  rfc: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nombre: '',
  codigoPostal: '',
  calle: '',
  noExterior: '',
  noInterior: '',
  colonia: '',
  estado: '',
  municipio: '',
  ciudad: '',
  country: '',
  clave: '',
  telefono: '',
  ladaTelefono: '',
  telefonoCelular: '',
  email: '',
  genero: '',
  usoCFDI: '',
  regimenFiscal: ''
})

const usosCFDI = ref([])
const regimenesFiscales = ref([])
const loadingSepomex = ref(false)
const loading = ref(false)
const cpUuid = ref(null)
const estados = ref([])
const municipios = ref([])
const ciudades = ref([])
const colonias = ref([])

// Dialog de resultado
const resultDialog = ref(false)
const resultData = ref({
  icon: 'success',
  title: '',
  message: ''
})

// Cargar catálogos CFDI
const cargarCatalogos = async () => {
  try {
    const [usos, regimenes] = await Promise.all([
      axios.get(`${URL_Proxy}/billing/usos-cfdi`),
      axios.get(`${URL_Proxy}/billing/regimenes-fiscales`)
    ])
    usosCFDI.value = usos.data || []
    regimenesFiscales.value = regimenes.data || []
  } catch (error) {
    console.error('Error al cargar catálogos CFDI:', error)
  }
}

// Extraer datos del XML
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

// Cargar datos del QR desde los parámetros de URL
const cargarDatosQR = async () => {
  try {
    cargandoDatos.value = true
    errorCarga.value = false

    // Obtener parámetros de la URL
    const tipo = route.query.tipo
    const cpnzid = route.query.cpnzid
    const id = route.query.id
    const custid = route.query.custid 

    if (!tipo || !cpnzid || !id) {
      throw new Error('Parámetros incompletos en la URL')
    }

    const payload = {
      Tipo: tipo,
      CpnyId: cpnzid,
      Servicecallid: id,
      custid: custid
    }

    // Guardar datos para crear XML después
    payloadQR.value = {
      tipo: tipo,
      cpnyId: cpnzid,
      serviceCallId: id,
    }

    // Limpiar parámetros de la URL (ocultar datos sensibles)
    window.history.replaceState({}, document.title, window.location.pathname)

    // Consultar información del servicio
    const res = await consultarInfoServicioVenta(payload)

    // Parsear XML
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(res, 'application/xml')

    datosServicio.value = extraerDatosXML(xmlDoc)

    // Prellenar formulario con datos del cliente
    if (datosServicio.value.cliente) {
      const c = datosServicio.value.cliente
      form.value.custId = c.CustId || ''
      form.value.razonSocial = c.RazonSocial || ''
      form.value.rfc = c.RFC || ''
      form.value.apellidoPaterno = c.ApellidoPaterno || ''
      form.value.apellidoMaterno = c.ApellidoMaterno || ''
      form.value.nombre = c.Nombre || ''
      form.value.codigoPostal = c.CodigoPostal || ''
      form.value.calle = c.Calle || ''
      form.value.noExterior = c.NoExterior || ''
      form.value.noInterior = c.NoInterior || ''
      form.value.colonia = c.Colonia || ''
      form.value.estado = c.Estado || ''
      form.value.municipio = c.Municipio || ''
      form.value.ciudad = c.Ciudad || ''
      form.value.country = c.Country || 'MEX'
      form.value.clave = c.Clave || ''
      const tel = c.TelefonoCelular || c.Telefono || ''
      form.value.telefono = tel
      form.value.ladaTelefono = c.LadaTelefono || tel.substring(0, 3)
      form.value.telefonoCelular = tel
      form.value.email = c.EMail || ''
      form.value.genero = c.Genero || ''
      form.value.usoCFDI = c.UsoCfdi || ''
      form.value.regimenFiscal = c.Regimen || ''
    }

    // Cargar catálogos
    await cargarCatalogos()

  } catch (error) {
    console.error('Error al cargar datos:', error)
    errorCarga.value = true
    mensajeError.value = error.message || 'Error al cargar los datos del servicio'
  } finally {
    cargandoDatos.value = false
  }
}

const mostrarResultado = (icon, title, message) => {
  resultData.value = { icon, title, message }
  resultDialog.value = true
}

const enviar = async () => {
  try {
    loading.value = true

    // 1. Enviar datos al ERP
    const resp = await enviarDatosFacturacion(form.value)

    if (resp?.result !== 200) {
      loading.value = false
      mostrarResultado('warning', 'Atención', resp?.message || 'Ocurrió un problema al procesar la facturación.')
      return
    }

    // 2. Guardar cliente
    const custId = resp.message?.trim()
    await guardarClienteLocal(custId, form.value)

    // 3. Crear XML de servicio para timbrado
    const xmlResponse = await crearServicioXML({
      custIdOri: form.value.custId,
      custIdCh: custId,
      serviceCallId: payloadQR.value.serviceCallId,
      cpnyId: payloadQR.value.cpnyId,
      usoCFDI: form.value.usoCFDI,
      regimenFiscal: form.value.regimenFiscal,
      formaPago: '04', // Tarjeta de crédito por defecto
      monto: parseFloat(datosServicio.value.orden?.totales?.Total) || 0,
      auth: '' // Sin autorización bancaria en web
    })

    if (xmlResponse?.result !== 200) {
      loading.value = false
      mostrarResultado('warning', 'Atención', xmlResponse?.message || 'Error al crear XML de facturación.')
      return
    }

    // Parsear la respuesta del XML 
    const xmlData = typeof xmlResponse.data === 'string'
      ? JSON.parse(xmlResponse.data)
      : xmlResponse.data


    // 4. Timbrar factura
    const timbradoResponse = await timbrarFactura({
      rutaArchivo: xmlData.ruta,
      custIdOr: form.value.custId,
      custIdCh: custId,
      cpnyId: payloadQR.value.cpnyId,
      cadenaOriginal: xmlData.cadenaoriginal
    })


    // Verificar que el timbrado fue exitoso
    if (timbradoResponse?.Estatus !== 200) {
      loading.value = false
      mostrarResultado('warning', 'Atención', timbradoResponse?.Mensaje || 'Error al timbrar la factura.')
      return
    }

    const timbrado = timbradoResponse.Timbrado

    // 5. Cerrar servicio
    const closeResponse = await closeService({
      cpnyId: payloadQR.value.cpnyId,
      shipperId: payloadQR.value.serviceCallId,
      cadenaOriginal: xmlData.cadenaoriginal,
      numeroSerieCer: timbrado.NoCertificado,
      selloDigital: timbrado.SelloCFD,
      rutaXML: xmlData.ruta,
      uuid: timbrado.UUID,
      fechaTimbrado: timbrado.FechaTimbrado,
      selloSat: timbrado.SelloSAT,
      cadenaOriginalComple: xmlData.cadenaoriginal,
      noCertificadoSat: timbrado.NoCertificadoSAT,
      imgQR: timbrado.ImgQR,
      custId: custId
    })

    loading.value = false
    mostrarResultado('success', 'Factura generada con éxito', 'Su factura ha sido timbrada correctamente. Recibirá su factura en el correo registrado.')
  } catch (error) {
    loading.value = false
    mostrarResultado('error', 'Error al facturar', error.message || 'No se pudo completar la operación.')
  }
}

const cerrarResultado = () => {
  resultDialog.value = false
}

// Watch para código postal
watch(
  () => form.value.codigoPostal,
  async (cp) => {
    if (!/^\d{5}$/.test(cp)) return

    // Reset dependencias
    form.value.estado = ''
    form.value.municipio = ''
    form.value.ciudad = ''
    form.value.colonia = ''

    estados.value = []
    municipios.value = []
    ciudades.value = []
    colonias.value = []
    cpUuid.value = null

    try {
      loadingSepomex.value = true

      const cpRes = await getCPList(cp)
      const cpList = cpRes.data?.GetCPListResult || []
      if (!cpList.length) {
        console.warn('No se encontró información para el CP:', cp)
        return
      }

      cpUuid.value = cpList[0].CPUuid

      const estadoRes = await getEstadoList(cpUuid.value)
      estados.value = estadoRes.data?.GetEstadoListResult || []
      if (!estados.value.length) {
        console.warn('No se encontraron estados para el CP:', cp)
        return
      }

      const estadoSel = estados.value[0]
      form.value.estado = estadoSel.Clave

      const municipioRes = await getMunicipioList(
        estadoSel.EstadoUuid,
        cpUuid.value
      )
      municipios.value = municipioRes.data?.GetMunicipioEstadoListResult || []
      if (!municipios.value.length) {
        console.warn('No se encontraron municipios')
        return
      }

      const municipioSel = municipios.value[0]
      form.value.municipio = municipioSel.Municipio

      const ciudadRes = await getCiudadList(
        municipioSel.MunicipioEstadoUuid,
        cpUuid.value
      )
      ciudades.value = ciudadRes.data?.GetCiudadMunicipioListResult || []
      if (!ciudades.value.length) {
        console.warn('No se encontraron ciudades')
        return
      }

      form.value.ciudad = ciudades.value[0].Ciudad

      const asentRes = await getAsentamientoList(
        municipioSel.MunicipioEstadoUuid,
        cpUuid.value
      )

      colonias.value = (asentRes.data?.GetAsentamientoCiudadListResult || []).map(
        a => a.Asentamiento
      )

      if (colonias.value.length) {
        form.value.colonia = colonias.value[0]
      }
    } catch (err) {
      console.error('Error al resolver CP:', err)
    } finally {
      loadingSepomex.value = false
    }
  }
)

onMounted(() => {
  cargarDatosQR()
})
</script>

<template>
  <v-app>
    <!-- Overlay de carga inicial -->
    <Overlay :visible="cargandoDatos" animation="Load" :allowCancel="false" />

    <!-- Error de carga -->
    <v-container v-if="errorCarga && !cargandoDatos" class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" md="6">
          <v-card class="rounded-xl pa-8 text-center">
            <v-icon size="100" color="error" class="mb-6">mdi-alert-circle-outline</v-icon>
            <h2 class="text-h4 font-weight-bold mb-4">Error al cargar</h2>
            <p class="text-body-1 text-medium-emphasis mb-6">{{ mensajeError }}</p>
            <v-btn color="primary" size="large" @click="cargarDatosQR">
              Reintentar
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Contenido principal -->
    <v-container v-else-if="!cargandoDatos" class="py-16 mt-16">
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <!-- Header -->
          <div class="text-center mb-8">
            <v-icon size="80" color="primary" class="mb-4">mdi-receipt-text-outline</v-icon>
            <h1 class="text-h3 font-weight-bold mb-2">Facturación</h1>
            <p class="text-body-1 text-medium-emphasis">
              Complete sus datos fiscales para generar su factura
            </p>
          </div>

          <!-- Información del servicio -->
          <v-card v-if="datosServicio.orden" class="rounded-xl mb-6" variant="outlined">
            <v-card-title class="text-h6 font-weight-medium">
              <v-icon class="mr-2">mdi-car</v-icon>
              Información del Servicio
            </v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Orden</div>
                  <div class="text-body-1 font-weight-medium">{{ datosServicio.orden.Orden }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Vehículo</div>
                  <div class="text-body-1 font-weight-medium">
                    {{ datosServicio.orden.Marca }} {{ datosServicio.orden.Modelo }} {{ datosServicio.orden.AnoAuto }}
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Placas</div>
                  <div class="text-body-1 font-weight-medium">{{ datosServicio.orden.Placas || 'N/A' }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Total</div>
                  <div class="text-body-1 font-weight-medium text-success">
                    ${{ parseFloat(datosServicio.orden.totales?.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Formulario -->
          <v-card class="rounded-xl">
            <v-card-title class="text-h5 font-weight-medium pt-6 px-6 pb-2">
              Datos Fiscales
            </v-card-title>

            <v-card-text class="pa-6">
              <!-- Razón Social -->
              <v-text-field
                v-model="form.razonSocial"
                label="Razón Social"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                hide-details="auto"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-domain</v-icon>
                </template>
              </v-text-field>

              <!-- RFC -->
              <v-text-field
                v-model="form.rfc"
                label="RFC"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                hide-details="auto"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-card-account-details</v-icon>
                </template>
              </v-text-field>

              <!-- Nombre completo en una fila -->
              <v-row dense class="mb-4">
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.nombre"
                    label="Nombre(s)"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  >
                    <template v-slot:prepend-inner>
                      <v-icon>mdi-account</v-icon>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.apellidoPaterno"
                    label="Apellido Paterno"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.apellidoMaterno"
                    label="Apellido Materno"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
              </v-row>

              <!-- Contacto -->
              <v-row dense class="mb-4">
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.email"
                    label="Correo Electrónico"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    type="email"
                  >
                    <template v-slot:prepend-inner>
                      <v-icon>mdi-email</v-icon>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.telefonoCelular"
                    label="Teléfono"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    @update:model-value="(val) => { form.telefono = val }"
                  >
                    <template v-slot:prepend-inner>
                      <v-icon>mdi-phone</v-icon>
                    </template>
                  </v-text-field>
                </v-col>
              </v-row>

              <!-- Dirección -->
              <v-text-field
                v-model="form.calle"
                label="Calle"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                hide-details="auto"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-road</v-icon>
                </template>
              </v-text-field>

              <v-row dense class="mb-4">
                <v-col cols="6" md="4">
                  <v-text-field
                    v-model="form.noExterior"
                    label="No. Exterior"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="6" md="4">
                  <v-text-field
                    v-model="form.noInterior"
                    label="No. Interior"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.codigoPostal"
                    label="Código Postal"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  >
                    <template v-slot:prepend-inner>
                      <v-icon>mdi-mailbox</v-icon>
                    </template>
                  </v-text-field>
                </v-col>
              </v-row>

              <v-select
                v-model="form.colonia"
                :items="colonias"
                label="Colonia"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                hide-details="auto"
                :disabled="!colonias.length"
                :loading="loadingSepomex"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-home-group</v-icon>
                </template>
              </v-select>

              <v-row dense class="mb-4">
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.ciudad"
                    :items="ciudades"
                    item-title="Ciudad"
                    item-value="Ciudad"
                    label="Ciudad"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :disabled="!ciudades.length"
                  >
                    <template v-slot:prepend-inner>
                      <v-icon>mdi-city</v-icon>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.municipio"
                    :items="municipios"
                    item-title="Municipio"
                    item-value="Municipio"
                    label="Municipio"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :disabled="!municipios.length"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.estado"
                    :items="estados"
                    item-title="Estado"
                    item-value="Clave"
                    label="Estado"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    disabled
                  />
                </v-col>
              </v-row>

              <!-- Datos Fiscales -->
              <v-select
                v-model="form.regimenFiscal"
                :items="regimenesFiscales"
                item-title="Descripcion"
                item-value="Codigo"
                label="Régimen Fiscal"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                hide-details="auto"
                :menu-props="{ maxHeight: 300 }"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-office-building</v-icon>
                </template>
              </v-select>

              <v-select
                v-model="form.usoCFDI"
                :items="usosCFDI"
                item-title="Descripcion"
                item-value="Codigo"
                label="Uso de CFDI"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                :menu-props="{ maxHeight: 300 }"
              >
                <template v-slot:prepend-inner>
                  <v-icon>mdi-file-certificate</v-icon>
                </template>
              </v-select>
            </v-card-text>

            <v-card-actions class="pa-6 pt-0">
              <v-btn
                color="primary"
                variant="flat"
                size="large"
                block
                @click="enviar"
                :loading="loading"
              >
                Solicitar Factura
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Overlay de envío -->
    <Overlay :visible="loading" animation="Load" :allowCancel="false" />

    <!-- Dialog de resultado -->
    <v-dialog
      v-model="resultDialog"
      max-width="500"
      persistent
    >
      <v-card class="result-dialog rounded-xl pt-16">
        <div class="result-icon-container">
          <div
            class="result-icon-circle"
            :class="{
              'success-circle': resultData.icon === 'success',
              'warning-circle': resultData.icon === 'warning',
              'error-circle': resultData.icon === 'error'
            }"
          >
            <v-icon
              size="64"
              color="white"
            >
              {{ resultData.icon === 'success' ? 'mdi-check-circle' : resultData.icon === 'warning' ? 'mdi-alert-circle' : 'mdi-close-circle' }}
            </v-icon>
          </div>
        </div>

        <v-card-title class="text-h4 font-weight-bold text-center px-6 pt-6 pb-3">
          {{ resultData.title }}
        </v-card-title>

        <v-card-text class="text-body-1 text-center px-8 pb-6">
          {{ resultData.message }}
        </v-card-text>

        <v-card-actions class="justify-center pb-6 px-6">
          <v-btn
            color="#06a573"
            variant="flat"
            size="large"
            class="px-12"
            @click="cerrarResultado"
          >
            Aceptar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Footer -->
    <v-footer class="footer-copy bg-transparent">
      <v-container>
        <div class="text-center text-medium-emphasis text-body-2">
          © {{ new Date().getFullYear() }} <strong>Integrame</strong>. Todos los derechos reservados.
        </div>
      </v-container>
    </v-footer>
  </v-app>
</template>

<style scoped>
.result-dialog {
  overflow: visible;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.result-icon-container {
  display: flex;
  justify-content: center;
  margin-top: -50px;
}

.result-icon-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  animation: scaleIn 0.3s ease-out;
}

.success-circle {
  background: linear-gradient(135deg, #06a573 0%, #059669 100%);
}

.warning-circle {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
}

.error-circle {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.footer-copy {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
