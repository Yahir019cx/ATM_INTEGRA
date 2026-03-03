import { postWCF } from './apiConfig'

// ==================== Telegram (WCF) ====================

export async function enviarSolicitudTelegram() {
  try {
    await postWCF('/SessionWeb/PostTelegram', {
      Opexportacion: 1,
      Cliente: 2,
      formato: 1
    })

    console.log('Solicitud a PostTelegram exitosa')
    return true
  } catch (err) {
    console.error('Error en PostTelegram:', err)
    return false
  }
}
