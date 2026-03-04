import axios from 'axios'
import { postWCF, obtenerIdEmpresaActual, SetEmpresaERP, GetTokenERP, getERPState, getClvUsuario } from './apiConfig'
import { getCPList, getEstadoList, getMunicipioList, getCiudadList, getAsentamientoList } from './apiUbicacion'

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

  let clientes = res.data?.GetClienteListResult ?? []

  // Si WCF no encuentra, fallback a ERP → Save
  if (clientes.length === 0) {
    clientes = await getCustomerRFC(rfc)
  }

  if (clientes.length === 0) return { cliente: null, clienteEmpresaClave: null }

  const cliente = clientes[0]

  // Siempre consultar ClienteEmpresaList con el ClienteUuid obtenido
  const clienteEmpresaClave = await getClienteEmpresaList(cliente)

  return { cliente, clienteEmpresaClave }
}

export async function getCustomerRFC(rfc, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, getTokenCache, clearTokenCache } = getERPState()
  clearTokenCache()
  await GetTokenERP();

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
        clv_usuario: getClvUsuario()
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

export async function getClienteEmpresaList(cliente) {
  const empresaId = await obtenerIdEmpresaActual()

  const res = await postWCF('/SessionWeb/GetClienteEmpresaList', {
    DataObj: {
      ClienteUuid: cliente.ClienteUuid,
      IdEmpresa: empresaId
    }
  })

  const resultado = res.data?.GetClienteEmpresaListResult ?? []
  if (resultado.length > 0) {
    return resultado[0].ClienteEmpresaClave
  }

  // No existe en la empresa → darlo de alta via InsUpdCustomer (ERP)
  const custId = await insUpdCustomerERP(cliente)

  // Guardar relación cliente-empresa en WCF
  await postWCF('/SessionWeb/GetClienteEmpresaSave', {
    DataObj: {
      ClienteEmpresaClave: custId.trim(),
      ClienteUuid: cliente.ClienteUuid,
      IdEmpresa: empresaId
    }
  })

  return custId.trim()
}

// Resolver ubicación desde CP via catálogo SEPOMEX
async function resolverUbicacionPorCP(cp) {
  try {
    const cpRes = await getCPList(cp)
    const cpList = cpRes.data?.GetCPListResult || []
    if (!cpList.length) return null

    const cpUuid = cpList[0].CPUuid

    const estadoRes = await getEstadoList(cpUuid)
    const estados = estadoRes.data?.GetEstadoListResult || []
    if (!estados.length) return null

    const estadoSel = estados[0]

    const municipioRes = await getMunicipioList(estadoSel.EstadoUuid, cpUuid)
    const municipios = municipioRes.data?.GetMunicipioEstadoListResult || []
    if (!municipios.length) return null

    const municipioSel = municipios[0]

    const ciudadRes = await getCiudadList(municipioSel.MunicipioEstadoUuid, cpUuid)
    const ciudades = ciudadRes.data?.GetCiudadMunicipioListResult || []
    if (!ciudades.length) return null

    const asentRes = await getAsentamientoList(municipioSel.MunicipioEstadoUuid, cpUuid)
    const colonias = asentRes.data?.GetAsentamientoCiudadListResult || []

    return {
      Estado: estadoSel.Clave,
      Municipio: municipioSel.Municipio,
      Ciudad: ciudades[0].Ciudad,
      Colonia: colonias.length ? colonias[0].Asentamiento : ''
    }
  } catch (err) {
    console.error('[SEPOMEX] Error al resolver ubicación por CP:', err)
    return null
  }
}

async function insUpdCustomerERP(cliente, retry = false) {
  const empresaId = await obtenerIdEmpresaActual();
  await SetEmpresaERP(empresaId);
  const { RutaERP, configERPFormData, clearTokenCache } = getERPState()
  clearTokenCache()
  await GetTokenERP();

  const clean = (str) => {
    return (str || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  // Resolver ubicación correcta desde catálogo SEPOMEX usando el CP
  const cp = (cliente.CPERP || cliente.CP || cliente.CodigoPostal || '').trim()
  const ubicacion = cp ? await resolverUbicacionPorCP(cp) : null

  const municipio = clean(ubicacion?.Municipio || cliente.MunicipioERP || cliente.Municipio)
  const ciudad = clean(ubicacion?.Ciudad || cliente.CiudadERP || cliente.Ciudad)
  const colonia = clean(ubicacion?.Colonia || cliente.AsentamientoERP || cliente.Asentamiento)
  const estado = (ubicacion?.Estado || cliente.EstadoClaveERP || cliente.EstadoClave || '').trim()

  const xmlBody = `
    <Customer>
      <ApellidoMaterno>${clean(cliente.ApellidoMaternoERP || cliente.ApellidoMaterno)}</ApellidoMaterno>
      <ApellidoPaterno>${clean(cliente.ApellidoPaternoERP || cliente.ApellidoPaterno)}</ApellidoPaterno>
      <Ciudad>${ciudad}</Ciudad>
      <Municipio>${municipio}</Municipio>
      <Clave>${(cliente.ClienteClaveERP || cliente.ClienteClaveCodigo || '0').toString().trim()}</Clave>
      <Colonia>${colonia}</Colonia>
      <Country>${(cliente.Country || 'MX').trim()}</Country>
      <Calle>${clean(cliente.CalleERP || cliente.Calle)}</Calle>
      <EmailAddr>${(cliente.EmailERP || cliente.Email || '').trim()}</EmailAddr>
      <LadaTelefono>${(cliente.LadaTelefonoERP || cliente.LadaTelefono || '').trim()}</LadaTelefono>
      <Nombre>${clean(cliente.NombresERP || cliente.Nombres)}</Nombre>
      <NoExterior>${(cliente.NoExteriorERP || cliente.NoExterior || '').trim()}</NoExterior>
      <RazonSocial>${clean(cliente.RazonSocialERP || cliente.RazonSocial)}</RazonSocial>
      <RegimenFiscal>${(cliente.RegimenFiscalCodigoERP || cliente.RegimenFiscalCodigo || '').trim()}</RegimenFiscal>
      <UsoCFDI>${(cliente.UsoCFDICodigoERP || cliente.UsoCFDICodigo || '').trim()}</UsoCFDI>
      <Estado>${estado}</Estado>
      <RFC>${(cliente.RFCERP || cliente.RFC || '').trim()}</RFC>
      <Telefono>${(cliente.TelefonoERP || cliente.Telefono || '').trim()}</Telefono>
      <TelefonoCelular>${(cliente.LadaTelefonoERP || cliente.LadaTelefono || '').trim()}${(cliente.TelefonoERP || cliente.Telefono || '').trim()}</TelefonoCelular>
      <Genero>${(cliente.GeneroClaveERP || cliente.GeneroClave || '').trim()}</Genero>
      <NoInterior>${(cliente.NoInteriorERP || cliente.NoInterior || '').trim()}</NoInterior>
      <CP>${cp}</CP>
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

    const data = res.data
    if (data.result === 200) {
      return data.message // CustId generado (ej: "0210215")
    }

    throw new Error(data.message || 'Error al registrar cliente en ERP')
  } catch (err) {
    if (err.response?.status === 401 && !retry) {
      clearTokenCache()
      return insUpdCustomerERP(cliente, true)
    }
    throw err
  }
}
