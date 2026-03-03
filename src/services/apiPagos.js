import axios from 'axios'
import { URL_Proxy } from '@/urls'

// ==================== Pagos ATM ====================

export async function crearRegistroPago(ordenId, nombreCliente, monto) {
  const response = await axios.post(URL_Proxy + '/crear-registro-pago', {
    ordenId,
    nombreCliente,
    monto
  })
  return response.data
}

export async function actualizarPago(registroId, transactionId, email, status) {
  const response = await axios.post(URL_Proxy + '/actualizar-pago', {
    registroId,
    transactionId,
    email,
    status
  })
  return response.data
}

export async function enviarEmailConQR(datos) {
  const response = await axios.post(URL_Proxy + '/email/test', datos)
  return response.data
}
