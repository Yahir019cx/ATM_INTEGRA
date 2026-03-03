import { postWCF } from './apiConfig'

// ==================== CP / Ubicación (WCF) ====================

export async function getCPList(cp) {
  return postWCF('/SessionWeb/GetCPList', {
    DataObj: {
      CP: cp,
      Op: 1
    }
  })
}

export async function getEstadoList(cpUuid) {
  return postWCF('/SessionWeb/GetEstadoList', {
    DataObj: {
      CPUuid: cpUuid,
      Op: 1
    }
  })
}

export async function getMunicipioList(estadoUuid, cpUuid) {
  return postWCF('/SessionWeb/GetMunicipioEstadoList', {
    DataObj: {
      Estad: estadoUuid,
      CPUuid: cpUuid,
      Op: 1
    }
  })
}

export async function getCiudadList(municipioEstadoUuid, cpUuid) {
  return postWCF('/SessionWeb/GetCiudadMunicipioList', {
    DataObj: {
      MunicipioEstadoUuid: municipioEstadoUuid,
      CPUuid: cpUuid,
      Op: 1
    }
  })
}

export async function getAsentamientoList(municipioEstadoUuid, cpUuid) {
  return postWCF('/SessionWeb/GetAsentamientoCiudadList', {
    DataObj: {
      MunicipioEstadoUuid: municipioEstadoUuid,
      CPUuid: cpUuid,
      Op: 1
    }
  })
}

export async function getCPAsentamientoList(asentamientoCiudadUuid, cpUuid) {
  return postWCF('/SessionWeb/GetCPAsentamientoList', {
    DataObj: {
      AsentamientoCiudadUuid: asentamientoCiudadUuid,
      CPAsentamientoUuid: '00000000-0000-0000-0000-000000000000',
      CPUuid: cpUuid,
      Op: 1
    }
  })
}
