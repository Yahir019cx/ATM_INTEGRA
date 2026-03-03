import { ref } from 'vue'

const TIMEOUT_ADVERTENCIA = 2 * 30 * 1000

export function useInactivityTimer({ onTimeout, onCancelado, isCarruselVisible }) {
  const mostrarAdvertencia = ref(false)
  const countdown = ref(20)

  let timeoutAdvertencia, countdownInterval

  function limpiarTimers() {
    clearTimeout(timeoutAdvertencia)
    clearInterval(countdownInterval)
  }

  function iniciarDialogoAdvertencia() {
    countdown.value = 20
    mostrarAdvertencia.value = true
    countdownInterval = setInterval(() => {
      if (--countdown.value <= 0) {
        limpiarTimers()
        mostrarAdvertencia.value = false
        onTimeout()
      }
    }, 1000)
  }

  function cancelarAdvertencia() {
    limpiarTimers()
    mostrarAdvertencia.value = false
    iniciarTimerAdvertencia()
    if (onCancelado) onCancelado()
  }

  function iniciarTimerAdvertencia() {
    limpiarTimers()
    if (!isCarruselVisible()) {
      timeoutAdvertencia = setTimeout(iniciarDialogoAdvertencia, TIMEOUT_ADVERTENCIA)
    }
  }

  function registrarInteraccion() {
    if (!isCarruselVisible() && !mostrarAdvertencia.value) {
      limpiarTimers()
      iniciarTimerAdvertencia()
    }
  }

  function registrarEventosGlobales() {
    ;['mousedown', 'touchstart'].forEach(e =>
      window.addEventListener(e, registrarInteraccion)
    )
  }

  return {
    mostrarAdvertencia,
    countdown,
    limpiarTimers,
    iniciarTimerAdvertencia,
    cancelarAdvertencia,
    registrarInteraccion,
    registrarEventosGlobales
  }
}
