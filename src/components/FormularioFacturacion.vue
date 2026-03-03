<script setup>
import { ref, watch, computed } from 'vue'
import axios from 'axios'
import { URL_Proxy } from '@/urls'
import {
  getCPList,
  getEstadoList,
  getMunicipioList,
  getCiudadList,
  getAsentamientoList,
  enviarDatosFacturacion,
  guardarClienteLocal,
  crearServicioXML,
  createShipperXML,
  timbrarFactura,
  closeService,
  closeShipper,
  payShipper
} from '@/services/api'

const props = defineProps({
  modelValue: Boolean,
  datosCliente: Object,
  serviceCallId: String,
  cpnyId: String,
  monto: Number,
  auth: String,
  formaPago: {
    type: String,
    default: '04' // Tarjeta de crédito por defecto
  },
  tipo: {
    type: String,
    default: 'S' // S = Servicio, E = Embarque
  }
})

// Computed para verificar si es tipo Embarque
const esEmbarque = computed(() => props.tipo === 'E')

const emit = defineEmits(['update:modelValue', 'facturacion-completada', 'cancelar'])
// facturacion-completada ahora emite los datos del XML: { ruta, servicecallid, cadenaoriginal, ... }

// Variables del formulario
const cargandoFactura = ref(false)
const mostrarDialogoError = ref(false)
const mensajeError = ref('')

const formFactura = ref({
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

// Catálogos
const usosCFDI = ref([])
const regimenesFiscales = ref([])
const loadingSepomex = ref(false)
const cpUuid = ref(null)
const estados = ref([])
const municipios = ref([])
const ciudades = ref([])
const colonias = ref([])

// Cargar catálogos CFDI
async function cargarCatalogosCFDI() {
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

// Prellenar formulario con datos del cliente
function prellenarFormulario() {
  const c = props.datosCliente
  if (!c) return

  formFactura.value.custId = c.CustId || ''
  formFactura.value.razonSocial = c.RazonSocial || ''
  formFactura.value.rfc = c.RFC || ''
  formFactura.value.apellidoPaterno = c.ApellidoPaterno || ''
  formFactura.value.apellidoMaterno = c.ApellidoMaterno || ''
  formFactura.value.nombre = c.Nombre || ''
  formFactura.value.codigoPostal = c.CodigoPostal || ''
  formFactura.value.calle = c.Calle || ''
  formFactura.value.noExterior = c.NoExterior || ''
  formFactura.value.noInterior = c.NoInterior || ''
  formFactura.value.colonia = c.Colonia || ''
  formFactura.value.estado = c.Estado || ''
  formFactura.value.municipio = c.Municipio || ''
  formFactura.value.ciudad = c.Ciudad || ''
  formFactura.value.country = c.Country || 'MEX'
  formFactura.value.clave = c.Clave || ''
  const tel = c.TelefonoCelular || c.Telefono || ''
  formFactura.value.telefono = tel
  formFactura.value.ladaTelefono = c.LadaTelefono || tel.substring(0, 3)
  formFactura.value.telefonoCelular = tel
  formFactura.value.email = c.EMail || ''
  formFactura.value.genero = c.Genero || ''
  formFactura.value.usoCFDI = c.UsoCfdi || ''
  formFactura.value.regimenFiscal = c.Regimen || ''
}

// Enviar facturación
async function enviarFacturacion() {
  try {
    cargandoFactura.value = true

    let xmlData, custId

    if (esEmbarque.value) {
      // Flujo para tipo E (Embarque): sin edición de datos, usar endpoints de Shipper
      // 1. Registrar pago del embarque
      const payResponse = await payShipper({
        cpnyId: props.cpnyId,
        shipperId: props.serviceCallId,
        monto: props.monto,
        auth: props.auth,
        tipoPago: props.formaPago
      })

      console.log('PayShipper:', payResponse)

      if (payResponse?.result !== 200) {
        cargandoFactura.value = false
        mensajeError.value = payResponse?.message || 'Error al registrar pago del embarque.'
        mostrarDialogoError.value = true
        return
      }

      // 2. Crear XML de embarque
      const xmlResponse = await createShipperXML({
        cpnyId: props.cpnyId,
        shipperId: props.serviceCallId
      })

      if (xmlResponse?.result !== 200) {
        cargandoFactura.value = false
        mensajeError.value = xmlResponse?.message || 'Error al crear XML de embarque.'
        mostrarDialogoError.value = true
        return
      }

      xmlData = typeof xmlResponse.data === 'string'
        ? JSON.parse(xmlResponse.data)
        : xmlResponse.data

      console.log('XML Embarque creado:', xmlData)

      // 3. Timbrar factura (mismo endpoint)
      const timbradoResponse = await timbrarFactura({
        rutaArchivo: xmlData.ruta,
        custIdOr: formFactura.value.custId,
        custIdCh: formFactura.value.custId,
        cpnyId: props.cpnyId,
        cadenaOriginal: xmlData.cadenaoriginal
      })

      console.log('Timbrado Embarque:', timbradoResponse)

      if (timbradoResponse?.Estatus !== 200) {
        cargandoFactura.value = false
        mensajeError.value = timbradoResponse?.Mensaje || 'Error al timbrar la factura.'
        mostrarDialogoError.value = true
        return
      }

      const timbrado = timbradoResponse.Timbrado

      // 4. Cerrar embarque con CloseShipper
      const closeResponse = await closeShipper({
        cpnyId: props.cpnyId,
        shipperId: props.serviceCallId,
        cadenaOriginal: xmlData.cadenaoriginal,
        numeroSerieCer: timbrado.NoCertificado,
        selloDigital: timbrado.SelloCFD,
        rutaXML: xmlData.ruta,
        uuid: timbrado.UUID,
        fechaTimbrado: timbrado.FechaTimbrado,
        selloSat: timbrado.SelloSAT,
        cadenaOriginalComple: xmlData.cadenaoriginal,
        noCertificadoSat: timbrado.NoCertificadoSAT,
        rutaPNG: timbrado.ImgQR
      })

      console.log('CloseShipper:', closeResponse)

      cargandoFactura.value = false
      emit('update:modelValue', false)
      emit('facturacion-completada', { xml: xmlData, timbrado: timbradoResponse, close: closeResponse, pay: payResponse })

    } else {
      // Flujo normal para otros tipos (S, A, F)
      // 1. Enviar datos al ERP
      const resp = await enviarDatosFacturacion(formFactura.value)

      if (resp?.result !== 200) {
        cargandoFactura.value = false
        mensajeError.value = resp?.message || 'Ocurrió un problema al procesar la facturación.'
        mostrarDialogoError.value = true
        return
      }

      // 2. Guardar cliente en backend local con el custId devuelto
      custId = resp.message?.trim()
      await guardarClienteLocal(custId, formFactura.value)

      // 3. Crear XML de servicio para timbrado
      const xmlResponse = await crearServicioXML({
        custIdOri: formFactura.value.custId,
        custIdCh: custId,
        serviceCallId: props.serviceCallId,
        cpnyId: props.cpnyId,
        usoCFDI: formFactura.value.usoCFDI,
        regimenFiscal: formFactura.value.regimenFiscal,
        formaPago: props.formaPago,
        monto: props.monto,
        auth: props.auth
      })

      if (xmlResponse?.result !== 200) {
        cargandoFactura.value = false
        mensajeError.value = xmlResponse?.message || 'Error al crear XML de facturación.'
        mostrarDialogoError.value = true
        return
      }

      xmlData = typeof xmlResponse.data === 'string'
        ? JSON.parse(xmlResponse.data)
        : xmlResponse.data

      console.log('XML creado:', xmlData)

      // 4. Timbrar factura
      const timbradoResponse = await timbrarFactura({
        rutaArchivo: xmlData.ruta,
        custIdOr: formFactura.value.custId,
        custIdCh: custId,
        cpnyId: props.cpnyId,
        cadenaOriginal: xmlData.cadenaoriginal
      })

      console.log('Timbrado:', timbradoResponse)

      if (timbradoResponse?.Estatus !== 200) {
        cargandoFactura.value = false
        mensajeError.value = timbradoResponse?.Mensaje || 'Error al timbrar la factura.'
        mostrarDialogoError.value = true
        return
      }

      const timbrado = timbradoResponse.Timbrado

      // 5. Cerrar servicio
      const closeResponse = await closeService({
        cpnyId: props.cpnyId,
        shipperId: props.serviceCallId,
        cadenaOriginal: xmlData.cadenaoriginal,
        numeroSerieCer: timbrado.NoCertificado,
        selloDigital: timbrado.SelloCFD,
        rutaXML: xmlData.ruta,
        uuid: timbrado.UUID,
        fechaTimbrado: timbrado.FechaTimbrado,
        selloSat: timbrado.SelloSAT,
        cadenaOriginalComple: '',
        noCertificadoSat: timbrado.NoCertificadoSAT,
        imgQR: timbrado.ImgQR,
        custId: custId
      })

      console.log('CloseService:', closeResponse)

      cargandoFactura.value = false
      emit('update:modelValue', false)
      emit('facturacion-completada', { xml: xmlData, timbrado: timbradoResponse, close: closeResponse })
    }

  } catch (error) {
    cargandoFactura.value = false
    console.error('Error al facturar:', error)
    mensajeError.value = error.message || 'No se pudo completar la facturación.'
    mostrarDialogoError.value = true
  }
}

// Cancelar
function cancelar() {
  emit('update:modelValue', false)
  emit('cancelar')
}

// Watch para código postal (SEPOMEX)
watch(
  () => formFactura.value.codigoPostal,
  async (cp) => {
    if (!/^\d{5}$/.test(cp)) return

    formFactura.value.estado = ''
    formFactura.value.municipio = ''
    formFactura.value.ciudad = ''
    formFactura.value.colonia = ''

    estados.value = []
    municipios.value = []
    ciudades.value = []
    colonias.value = []
    cpUuid.value = null

    try {
      loadingSepomex.value = true

      const cpRes = await getCPList(cp)
      const cpList = cpRes.data?.GetCPListResult || []
      if (!cpList.length) return

      cpUuid.value = cpList[0].CPUuid

      const estadoRes = await getEstadoList(cpUuid.value)
      estados.value = estadoRes.data?.GetEstadoListResult || []
      if (!estados.value.length) return

      const estadoSel = estados.value[0]
      formFactura.value.estado = estadoSel.Clave

      const municipioRes = await getMunicipioList(estadoSel.EstadoUuid, cpUuid.value)
      municipios.value = municipioRes.data?.GetMunicipioEstadoListResult || []
      if (!municipios.value.length) return

      const municipioSel = municipios.value[0]
      formFactura.value.municipio = municipioSel.Municipio

      const ciudadRes = await getCiudadList(municipioSel.MunicipioEstadoUuid, cpUuid.value)
      ciudades.value = ciudadRes.data?.GetCiudadMunicipioListResult || []
      if (!ciudades.value.length) return

      formFactura.value.ciudad = ciudades.value[0].Ciudad

      const asentRes = await getAsentamientoList(municipioSel.MunicipioEstadoUuid, cpUuid.value)
      colonias.value = (asentRes.data?.GetAsentamientoCiudadListResult || []).map(a => a.Asentamiento)

      if (colonias.value.length) {
        formFactura.value.colonia = colonias.value[0]
      }
    } catch (err) {
      console.error('Error al resolver CP:', err)
    } finally {
      loadingSepomex.value = false
    }
  }
)

// Watch para cuando se abre el dialog
watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await cargarCatalogosCFDI()
      prellenarFormulario()
    }
  }
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="700" persistent scrollable>
    <v-card rounded="lg">
      <v-card-title class="d-flex justify-space-between align-center pa-4">
        <div class="d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-receipt-text-outline</v-icon>
          <span class="text-h6">Datos de Facturación</span>
        </div>
        <v-btn icon variant="text" @click="cancelar">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pa-4" style="max-height: 60vh; overflow-y: auto;">
        <!-- Aviso para tipo Embarque -->
        <v-alert v-if="esEmbarque" type="info" variant="tonal" class="mb-4" density="compact">
          Los datos de facturación no pueden modificarse para embarques.
        </v-alert>

        <!-- Razón Social -->
        <v-text-field
          v-model="formFactura.razonSocial"
          label="Razón Social"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          hide-details="auto"
          prepend-inner-icon="mdi-domain"
          :readonly="esEmbarque"
        />

        <!-- RFC -->
        <v-text-field
          v-model="formFactura.rfc"
          label="RFC"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          hide-details="auto"
          prepend-inner-icon="mdi-card-account-details"
          :readonly="esEmbarque"
        />

        <!-- Nombre completo -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="formFactura.nombre"
              label="Nombre(s)"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="mdi-account"
              :readonly="esEmbarque"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="formFactura.apellidoPaterno"
              label="Apellido Paterno"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :readonly="esEmbarque"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="formFactura.apellidoMaterno"
              label="Apellido Materno"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :readonly="esEmbarque"
            />
          </v-col>
        </v-row>

        <!-- Contacto -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formFactura.email"
              label="Correo Electrónico"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              type="email"
              prepend-inner-icon="mdi-email"
              :readonly="esEmbarque"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formFactura.telefonoCelular"
              label="Teléfono"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="mdi-phone"
              :readonly="esEmbarque"
              @update:model-value="(val) => { formFactura.telefono = val }"
            />
          </v-col>
        </v-row>

        <!-- Dirección -->
        <v-text-field
          v-model="formFactura.calle"
          label="Calle"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          hide-details="auto"
          prepend-inner-icon="mdi-road"
          :readonly="esEmbarque"
        />

        <v-row dense class="mb-3">
          <v-col cols="6" md="4">
            <v-text-field
              v-model="formFactura.noExterior"
              label="No. Exterior"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :readonly="esEmbarque"
            />
          </v-col>
          <v-col cols="6" md="4">
            <v-text-field
              v-model="formFactura.noInterior"
              label="No. Interior"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :readonly="esEmbarque"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="formFactura.codigoPostal"
              label="Código Postal"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="mdi-mailbox"
              :readonly="esEmbarque"
            />
          </v-col>
        </v-row>

        <v-select
          v-model="formFactura.colonia"
          :items="colonias"
          label="Colonia"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          hide-details="auto"
          :disabled="!colonias.length || esEmbarque"
          :loading="loadingSepomex"
          prepend-inner-icon="mdi-home-group"
        />

        <v-row dense class="mb-3">
          <v-col cols="12" md="4">
            <v-select
              v-model="formFactura.ciudad"
              :items="ciudades"
              item-title="Ciudad"
              item-value="Ciudad"
              label="Ciudad"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :disabled="!ciudades.length || esEmbarque"
              prepend-inner-icon="mdi-city"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="formFactura.municipio"
              :items="municipios"
              item-title="Municipio"
              item-value="Municipio"
              label="Municipio"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :disabled="!municipios.length || esEmbarque"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="formFactura.estado"
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
          v-model="formFactura.regimenFiscal"
          :items="regimenesFiscales"
          item-title="Descripcion"
          item-value="Codigo"
          label="Régimen Fiscal"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          hide-details="auto"
          :menu-props="{ maxHeight: 300 }"
          prepend-inner-icon="mdi-office-building"
          :disabled="esEmbarque"
        />

        <v-select
          v-model="formFactura.usoCFDI"
          :items="usosCFDI"
          item-title="Descripcion"
          item-value="Codigo"
          label="Uso de CFDI"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :menu-props="{ maxHeight: 300 }"
          prepend-inner-icon="mdi-file-certificate"
          :disabled="esEmbarque"
        />
      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions class="pa-4 d-flex justify-end ga-2">
        <v-btn variant="outlined" color="grey" rounded="lg" @click="cancelar">
          Cancelar
        </v-btn>
        <v-btn variant="flat" color="primary" rounded="lg" :loading="cargandoFactura" @click="enviarFacturacion">
          {{ esEmbarque ? 'Timbrar Factura' : 'Solicitar Factura' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Diálogo de Error -->
  <v-dialog v-model="mostrarDialogoError" max-width="400">
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
        <span>Error</span>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pa-4">
        {{ mensajeError }}
      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions class="pa-4 d-flex justify-end">
        <v-btn variant="flat" color="primary" rounded="lg" @click="mostrarDialogoError = false">
          Aceptar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
