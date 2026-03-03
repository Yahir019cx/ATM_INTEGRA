import { ref } from 'vue'
import { URL_Proxy, URL_IMG } from '@/urls'
import { obtenerMacYLogo, obtenerPublicidad } from '@/services/api'

export function usePublicidad() {
  const logoUrl = ref('')
  const publicidadFiltrada = ref([])
  const empresa = ref('')
  const carruselKey = ref(0)
  let eventSource = null

  function actualizarCarrusel() {
    carruselKey.value++
  }

  async function refrescarPublicidad() {
    try {
      const [macData, publicidadData] = await Promise.all([
        obtenerMacYLogo(),
        obtenerPublicidad()
      ])

      const { mac, logo } = macData

      publicidadFiltrada.value = publicidadData.filter(item => item.MacAddress === mac)

      if (publicidadFiltrada.value.length > 0) {
        empresa.value = publicidadFiltrada.value[0].NombreEmpresa
      }

      logoUrl.value = logo ? URL_IMG + '/Logos/Empresas/' + logo : ''
      actualizarCarrusel()
    } catch (error) {
      console.error('Error al obtener la publicidad filtrada:', error)
    }
  }

  function iniciarSSE() {
    eventSource = new EventSource(URL_Proxy + '/publicidad/stream')
    eventSource.onmessage = (event) => {
      if (event.data === 'nueva-publicidad') {
        refrescarPublicidad()
      }
    }
  }

  return {
    logoUrl,
    publicidadFiltrada,
    empresa,
    carruselKey,
    actualizarCarrusel,
    refrescarPublicidad,
    iniciarSSE
  }
}
