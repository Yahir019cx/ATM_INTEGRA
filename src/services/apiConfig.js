import axios from 'axios'
import { ref } from 'vue'

// ==================== CONFIG MULTI-EMPRESA ====================

const RutaERP = ref("")
const UsuarioERP = ref("")
const PasswordERP = ref("")
let tokenERPCache = null

const configERP = ref({
  headers: {
    "Content-Type": "application/json",
    "cache-control": "no-cache",
    Token: "",
  },
})

const configERPFormData = ref({
  headers: {
    "Content-Type": "multipart/form-data",
    "cache-control": "no-cache",
    Token: "",
  },
})

let idEmpresaCache = null

export function setIdEmpresaCache(value) {
  idEmpresaCache = value
}

// Obtener IdEmpresa desde publicidad (ATM → MAC → Empresa)
async function obtenerIdEmpresaActual() {
  if (!idEmpresaCache) {
    const { obtenerPublicidad } = await import('./apiPublicidad')
    await obtenerPublicidad()
  }

  if (!idEmpresaCache) {
    throw new Error('No se pudo obtener IdEmpresa desde publicidad. Verifica la configuración del ATM.');
  }

  return idEmpresaCache;
}

// ==================== CONFIG WCF ====================

const WCF_BASE_URL = ''

const WCF_USER = import.meta.env.VITE_WCF_USER
const WCF_PASSWORD = import.meta.env.VITE_WCF_PASSWORD

let tokenWcfCache = null
let clvUsuarioCache = null

async function obtenerTokenWCF(retry = false) {
  if (tokenWcfCache) return tokenWcfCache

  const credentials = btoa(`${WCF_USER}:${WCF_PASSWORD}`)

  try {
    const res = await axios.post(
      `${WCF_BASE_URL}/SessionWeb/Autenticacion`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`
        }
      }
    )

    const authResult = res.data?.AutenticacionResult
    tokenWcfCache = authResult?.token
    clvUsuarioCache = authResult?.clv_usuario ?? 0

    if (!tokenWcfCache) {
      throw new Error('Token WCF inválido')
    }

    return tokenWcfCache
  } catch (err) {
    if (!retry) {
      tokenWcfCache = null
      clvUsuarioCache = null
      return obtenerTokenWCF(true)
    }
    throw err
  }
}

export function getClvUsuario() {
  return clvUsuarioCache
}

export async function postWCF(url, body) {
  const token = await obtenerTokenWCF()

  return axios.post(`${WCF_BASE_URL}${url}`, body, {
    headers: {
      Authorization: token
    }
  })
}

// Configurar empresa antes de cada operación
export const SetEmpresaERP = async (IdEmpresa) => {
  if (IdEmpresa == -8) {
    RutaERP.value = "https://app01.grupomhautomotriz.com/integradmserpws/api/";
    UsuarioERP.value = "CONTPAQ";
    PasswordERP.value = "ContPaq34";
  } else if (IdEmpresa == -10) {
    RutaERP.value = "https://app01.grupomhautomotriz.com/integradmserpws/api/";
    UsuarioERP.value = "BUDGET55";
    PasswordERP.value = "Bug3t#55";
  } else if (IdEmpresa == -99) {
    RutaERP.value = "https://app01.grupomhautomotriz.com/integradmserpws/api/";
    UsuarioERP.value = "RENPRU";
    PasswordERP.value = "Pruebas25";
  } else {
    try {
      const Result = await postWCF('/SessionWeb/GetApiById', { IdEmpresa: IdEmpresa });

      if (Result.data.GetApiByIdResult.IdAPI > 0) {
        RutaERP.value = Result.data.GetApiByIdResult.Ruta;
        UsuarioERP.value = Result.data.GetApiByIdResult.Usuario;
        PasswordERP.value = Result.data.GetApiByIdResult.Password;
      } else {
        throw new Error("Esta Empresa no cuenta con una conexión API ERP.");
      }
    } catch (error) {
      console.error("Error in SetEmpresaERP", error);
      throw error;
    }
  }
};

// Obtener token para la empresa configurada
export const GetTokenERP = async () => {
  const params = {
    userId: UsuarioERP.value,
    Password: PasswordERP.value,
  };

  try {
    const Result = await axios.post(
      RutaERP.value + "Access",
      params,
      configERP.value
    );

    if (Result.data.result == 1) {
      tokenERPCache = Result.data.data.accesToken;
      configERP.value.headers.Token = Result.data.data.accesToken;
      configERPFormData.value.headers.Token = Result.data.data.accesToken;
      return tokenERPCache;
    } else {
      throw new Error("Credenciales de empresa incorrectas");
    }
  } catch (error) {
    console.error("Error in GetTokenERP", error);
    throw error;
  }
};

export function getERPState() {
  return { RutaERP, configERP, configERPFormData, getTokenCache: () => tokenERPCache, clearTokenCache: () => { tokenERPCache = null } }
}

export { obtenerIdEmpresaActual }

export function limpiarTokenCache() {
  tokenERPCache = null
  tokenWcfCache = null
  clvUsuarioCache = null
  idEmpresaCache = null
}
