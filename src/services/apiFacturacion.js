import axios from 'axios'
import { URL_Proxy, URL_API_PAYMENT } from '@/urls'
import { obtenerIdEmpresaActual, SetEmpresaERP, GetTokenERP, getERPState } from './apiConfig'
import { obtenerCpnyId } from './apiPublicidad'

// ==================== Datos de Facturación ====================

export async function enviarDatosFacturacion(form, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERPFormData, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  const clean = (str) => {
    return (str || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  const xmlBody = `
    <Customer>
      <ApellidoMaterno>${clean(form.apellidoMaterno)}</ApellidoMaterno>
      <ApellidoPaterno>${clean(form.apellidoPaterno)}</ApellidoPaterno>
      <Ciudad>${clean(form.ciudad)}</Ciudad>
      <Municipio>${clean(form.municipio)}</Municipio>
      <Clave>${(form.clave || '').toString().trim()}</Clave>
      <Colonia>${clean(form.colonia)}</Colonia>
      <Country>${(form.country || 'MEX').trim()}</Country>
      <Calle>${clean(form.calle)}</Calle>
      <EmailAddr>${(form.email || '').trim()}</EmailAddr>
      <LadaTelefono>${(form.ladaTelefono || '').trim()}</LadaTelefono>
      <Nombre>${clean(form.nombre)}</Nombre>
      <NoExterior>${(form.noExterior || '').trim()}</NoExterior>
      <RazonSocial>${clean(form.razonSocial)}</RazonSocial>
      <RegimenFiscal>${(form.regimenFiscal || '').trim()}</RegimenFiscal>
      <UsoCFDI>${(form.usoCFDI || '').trim()}</UsoCFDI>
      <Estado>${(form.estado || '').trim()}</Estado>
      <RFC>${(form.rfc || '').trim()}</RFC>
      <Telefono>${(form.telefono || '').trim().substring(3)}</Telefono>
      <TelefonoCelular>${(form.telefonoCelular || '').trim()}</TelefonoCelular>
      <Genero>${(form.genero || '').trim()}</Genero>
      <NoInterior>${(form.noInterior || '').trim()}</NoInterior>
      <CP>${(form.codigoPostal || '').trim()}</CP>
    </Customer>
  `

  const formData = new FormData()
  formData.append('data', xmlBody)

  try {
    const res = await axios.post(
      RutaERP.value + 'InsUpdCustomer',
      formData,
      configERPFormData.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return enviarDatosFacturacion(form, true)
    }
    throw err
  }
}

export async function guardarClienteLocal(custId, form) {
  const payload = {
    CustId: custId,
    Nombre: form.nombre || '',
    ApellidoPaterno: form.apellidoPaterno || '',
    ApellidoMaterno: form.apellidoMaterno || '',
    RazonSocial: form.razonSocial || '',
    RFC: form.rfc || '',
    RegimenFiscal: form.regimenFiscal || '',
    UsoCFDI: form.usoCFDI || '',
    Genero: form.genero || '',
    Calle: form.calle || '',
    NoExterior: form.noExterior || '',
    NoInterior: form.noInterior || '',
    Colonia: form.colonia || '',
    Ciudad: form.ciudad || '',
    Municipio: form.municipio || '',
    Estado: form.estado || '',
    CP: form.codigoPostal || '',
    Country: form.country || 'MEX',
    EmailAddr: form.email || '',
    LadaTelefono: form.ladaTelefono || '',
    Telefono: form.telefono || '',
    TelefonoCelular: form.telefonoCelular || '',
    Clave: form.clave || ''
  }

  const res = await axios.post(`${URL_Proxy}/customer/save`, payload)
  return res.data
}

export async function timbrarFactura(params) {
  const payload = {
    rutaArchivo: params.rutaArchivo,
    CustIdOr: params.custIdOr,
    CustIdCh: params.custIdCh,
    CpnyId: params.cpnyId,
    CadenaOriginal: params.cadenaOriginal,
  }

  const res = await axios.post(`${URL_API_PAYMENT}/TimbradoCaja`, payload)
  return res.data
}

// ==================== Facturas Pendientes (ArdocInvoices) ====================

export async function getArdocInvoices(custId, retry = false) {
  const empresaId = await obtenerIdEmpresaActual()
  await SetEmpresaERP(empresaId)
  const { RutaERP, getTokenCache, clearTokenCache } = getERPState()
  clearTokenCache()
  await GetTokenERP()

  const cpnyId = await obtenerCpnyId()

  try {
    const res = await axios.post(
      RutaERP.value + 'ArdocInvoices',
      { CpnyId: cpnyId, CustId: custId },
      {
        headers: { Token: getTokenCache() },
        responseType: 'text'
      }
    )

    const xml = new DOMParser().parseFromString(res.data, 'text/xml')
    if (xml.querySelector('Estatus')?.textContent !== '200') return []

    return Array.from(xml.querySelectorAll('Doctos')).map(d => ({
      CustId: d.querySelector('CustId')?.textContent || '',
      FechaFactura: d.querySelector('FechaFactura')?.textContent || '',
      ImporteFactura: parseFloat(d.querySelector('ImporteFactura')?.textContent || '0'),
      Saldo: parseFloat(d.querySelector('Saldo')?.textContent || '0'),
      Tipo: d.querySelector('Tipo')?.textContent || '',
      NoFactura: d.querySelector('NoFactura')?.textContent || ''
    }))
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return getArdocInvoices(custId, true)
    }
    throw err
  }
}
