import axios from 'axios'
import { postWCF, obtenerIdEmpresaActual, SetEmpresaERP, GetTokenERP, getERPState } from './apiConfig'
import { getEmpresaById } from './apiPublicidad'

// ==================== Clientes / RFC ====================

export async function getClienteListByRFC(rfc) {
  const body = {
    DataObj: {
      ClienteUuid: '00000000-0000-0000-0000-000000000000',
      ClienteFolio: '',
      RFC: rfc,
      Op: 1
    }
  }

  const res = await postWCF('/SessionWeb/GetClienteList', body)

  const resultado = res.data?.GetClienteListResult ?? []
  if (resultado.length > 0) return resultado

  return getCustomerRFC(rfc)
}

export async function getCustomerRFC(rfc, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, getTokenCache, clearTokenCache } = getERPState()
  if (!getTokenCache()) await GetTokenERP();

  try {
    const res = await axios.post(
      RutaERP.value + 'GetCustomerRFC',
      { RFC: rfc },
      {
        headers: { Token: getTokenCache() },
        responseType: 'text'
      }
    )

    const xml = new DOMParser().parseFromString(res.data, 'text/xml')
    if (xml.querySelector('Resultado')?.textContent !== '200') return []

    const c = xml.querySelector('Customer')
    if (!c) return []

    const tag = (name) => c.querySelector(name)?.textContent || ''

    // Obtener clv_usuario desde GetEmpresaById
    const empresa = await getEmpresaById(empresaId)

    // Guardar cliente en BD local via GetClienteERPSave
    const saved = await postWCF('/SessionWeb/GetClienteERPSave', {
      DataObj: {
        CustId: tag('CustId'),
        Nombres: tag('Nombre'),
        ApellidoPaterno: tag('ApellidoPaterno'),
        ApellidoMaterno: tag('ApellidoMaterno'),
        Calle: tag('Calle'),
        NoExterior: tag('NoExterior'),
        NoInterior: tag('NoInterior'),
        ClienteClave: tag('Clave'),
        RazonSocial: tag('RazonSocial'),
        RFC: tag('RFC'),
        RegimenFiscalCodigo: tag('RegimenFiscal'),
        UsoCFDICodigo: tag('UsoCFDI'),
        GeneroClave: tag('Genero'),
        Email: tag('EmailAddr'),
        CP: tag('CP'),
        EstadoClave: tag('Estado'),
        Municipio: tag('Municipio'),
        Ciudad: tag('Ciudad'),
        Asentamiento: tag('Colonia'),
        LadaTelefono: tag('LadaTelefono'),
        Telefono: tag('Telefono'),
        TelefonoCelular: tag('TelefonoCelular'),
        IdEmpresa: empresaId,
        clv_usuario: empresa?.clv_usuario ?? 0
      }
    })

    const cliente = saved.data?.GetClienteERPSaveResult
    if (cliente) return [cliente]

    return []
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return getCustomerRFC(rfc, true)
    }
    throw err
  }
}
