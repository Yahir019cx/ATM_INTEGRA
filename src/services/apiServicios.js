import axios from 'axios'
import { obtenerIdEmpresaActual, SetEmpresaERP, GetTokenERP, getERPState } from './apiConfig'

// ==================== Servicios ERP / QR ====================

export async function consultarInfoServicioVenta(data, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  try {
    const res = await axios.post(
      RutaERP.value + 'InfoSerVta',
      data,
      {
        headers: {
          Token: getTokenCache()
        },
        responseType: 'text'
      }
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return consultarInfoServicioVenta(data, true)
    }
    throw err
  }
}

export async function crearServicioXML(params, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  try {
    const res = await axios.post(
      RutaERP.value + 'createservicexml',
      {
        CustIdOri: params.custIdOri || '',
        CustIdCh: params.custIdCh || '',
        ServiceCallId: params.serviceCallId || '',
        Cpnyid: params.cpnyId || '',
        UsoCFDI: params.usoCFDI || '',
        RegimenFiscal: params.regimenFiscal || '',
        FormaPago: params.formaPago || '',
        Monto: params.monto || 0,
        Auth: params.auth || ''
      },
      configERP.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return crearServicioXML(params, true)
    }
    throw err
  }
}

export async function createShipperXML(params, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  try {
    const res = await axios.post(
      RutaERP.value + 'CreateShipperXML',
      {
        CpnyId: params.cpnyId || '',
        ShipperId: params.shipperId || ''
      },
      configERP.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return createShipperXML(params, true)
    }
    throw err
  }
}

export async function closeService(params, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  const payload = {
    CpnyId: params.cpnyId || '',
    ShipperId: params.shipperId || '',
    CadenaOriginal: params.cadenaOriginal || '',
    NumeroSerieCer: params.numeroSerieCer || '',
    SelloDigital: params.selloDigital || '',
    RutaXML: params.rutaXML || '',
    UUID: params.uuid || '',
    FechaTimbrado: params.fechaTimbrado || '',
    SelloSat: params.selloSat || '',
    CadenaOriginalComple: params.cadenaOriginal || '',
    NoCertificadoSat: params.noCertificadoSat || '',
    RutaPNG: params.imgQR || '',
    CustId: params.custId || ''
  }

  console.log('CloseService payload:', payload)

  try {
    const res = await axios.post(
      RutaERP.value + 'CloseService',
      payload,
      configERP.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return closeService(params, true)
    }
    throw err
  }
}

export async function closeShipper(params, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  const payload = {
    CpnyId: params.cpnyId || '',
    ShipperId: params.shipperId || '',
    CadenaOriginal: params.cadenaOriginal || '',
    NumeroSerieCer: params.numeroSerieCer || '',
    SelloDigital: params.selloDigital || '',
    RutaXML: params.rutaXML || '',
    UUID: params.uuid || '',
    FechaTimbrado: params.fechaTimbrado || '',
    SelloSat: params.selloSat || '',
    CadenaOriginalComple: params.cadenaOriginalComple || '',
    NoCertificadoSat: params.noCertificadoSat || '',
    RutaPNG: params.rutaPNG || ''
  }

  console.log('CloseShipper payload:', payload)

  try {
    const res = await axios.post(
      RutaERP.value + 'CloseShipper',
      payload,
      configERP.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return closeShipper(params, true)
    }
    throw err
  }
}

export async function payShipper(params, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  try {
    const res = await axios.post(
      RutaERP.value + 'PayShipper',
      {
        CpnyId: params.cpnyId || '',
        ShipperId: params.shipperId || '',
        Monto: params.monto || 0,
        Auth: params.auth || '',
        TipoPago: params.tipoPago || '04'
      },
      configERP.value
    )

    return res.data
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return payShipper(params, true)
    }
    throw err
  }
}
