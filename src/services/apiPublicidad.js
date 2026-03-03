import axios from 'axios'
import { URL_Proxy } from '@/urls'
import { postWCF, setIdEmpresaCache, obtenerIdEmpresaActual } from './apiConfig'

// ==================== Publicidad ====================

export async function obtenerMacYLogo() {
  const response = await axios.get(URL_Proxy + '/publicidad/mac')
  return response.data
}

export async function obtenerPublicidad() {
  const response = await axios.get(URL_Proxy + '/publicidad')
  setIdEmpresaCache(response.data[0]?.IdEmpresa ?? null)
  return response.data
}

export async function getEmpresaById(id) {
  const { data } = await postWCF(
    '/SessionWeb/GetEmpresaById',
    { Id: id }
  )
  return data?.GetEmpresaByIdResult ?? null
}

export async function obtenerCpnyId() {
  const idEmpresa = await obtenerIdEmpresaActual()
  const empresa = await getEmpresaById(idEmpresa)
  if (!empresa) throw new Error(`Empresa ${idEmpresa} no encontrada en GetEmpresaById`)
  return empresa.IdErp
}
