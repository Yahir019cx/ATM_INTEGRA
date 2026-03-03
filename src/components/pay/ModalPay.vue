<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { URL_BANK, URL_API_PAYMENT } from '@/urls'
import axios from 'axios'
import confetti from 'canvas-confetti'

// OpenPay configuration from environment variables
const OPENPAY_ID = import.meta.env.VITE_OPENPAY_ID
const OPENPAY_KEY = import.meta.env.VITE_OPENPAY_KEY
const OPENPAY_SANDBOX = import.meta.env.VITE_OPENPAY_SANDBOX === 'true'

const props = defineProps({
  modelValue: Boolean,
  monto: {
    type: Number,
    required: true
  },
  datosCliente: {
    type: Object,
    required: true
  },
  servicioData: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'pago-exitoso', 'pago-error', 'cancelar'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Estados
const isCardFlipped = ref(false)
const focusedInput = ref(null)
const showCVV = ref(false)
const isProcessing = ref(false)
OpenPay.setId(OPENPAY_ID)
OpenPay.setApiKey(OPENPAY_KEY)
OpenPay.setSandboxMode(OPENPAY_SANDBOX)

const deviceSessionId = OpenPay.deviceData.setup(
    "payment-form",
    "deviceIdHiddenFieldName"
);

// Modales de respuesta
const showSuccessModal = ref(false)
const showErrorModal = ref(false)
const errorMessage = ref('')
const transactionId = ref('')


// Checkboxes legales
const aceptoTerminos = ref(false)
const aceptoPrivacidad = ref(false)

// Logos de bancos
const creditCards = [
  { name: 'visa', src: URL_BANK + 'visa.png' },
  { name: 'mastercard', src: URL_BANK + 'mastercard.png' },
  { name: 'amex', src: URL_BANK + 'amex.png' },
  { name: 'carnet', src: URL_BANK + 'carnet.png' }
]

const debitCards = [
  { name: 'bbva', src: URL_BANK + 'bbva.png' },
  { name: 'santander', src: URL_BANK + 'santander.svg.png' },
  { name: 'hsbc', src: URL_BANK + 'hsbc.png' },
  { name: 'scotiabank', src: URL_BANK + 'scotiabank.png' },
  { name: 'banamex', src: URL_BANK + 'banamex.png' }
]

// BINs de bancos
const bankBINs = {
  bbva: ['450903', '450904', '540677', '543357', '491243', '542590'],
  santander: ['402406', '540914', '548178', '603199', '450614'],
  banamex: ['517309', '540523', '542472', '547058', '491231', '542016'],
  hsbc: ['406742', '425952', '437222', '492939', '543353'],
  scotiabank: ['450617', '491224', '491225', '450618']
}

// Colores por banco
const bankColors = {
  bbva: { gradient: 'linear-gradient(135deg, #004481 0%, #072146 100%)', name: 'BBVA' },
  santander: { gradient: 'linear-gradient(135deg, #ec0000 0%, #b30000 100%)', name: 'Santander' },
  banamex: { gradient: 'linear-gradient(135deg, #0033a0 0%, #001f5f 100%)', name: 'Citibanamex' },
  hsbc: { gradient: 'linear-gradient(135deg, #db0011 0%, #a30010 100%)', name: 'HSBC' },
  scotiabank: { gradient: 'linear-gradient(135deg, #ec1c24 0%, #c4161c 100%)', name: 'Scotiabank' },
  visa: { gradient: 'linear-gradient(135deg, #1a1f71 0%, #0f1340 100%)', name: 'Visa' },
  mastercard: { gradient: 'linear-gradient(135deg, #eb001b 0%, #f79e1b 100%)', name: 'Mastercard' },
  amex: { gradient: 'linear-gradient(135deg, #006fcf 0%, #004a8d 100%)', name: 'American Express' },
  default: { gradient: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)', name: '' }
}

// Detectar banco por BIN
const detectedBank = computed(() => {
  const num = cardData.value.number.replace(/\s/g, '')
  if (num.length < 6) return 'default'
  
  const bin = num.substring(0, 6)
  for (const [bank, bins] of Object.entries(bankBINs)) {
    if (bins.some(b => bin.startsWith(b))) return bank
  }
  
  if (/^4/.test(num)) return 'visa'
  if (/^5[1-5]/.test(num)) return 'mastercard'
  if (/^3[47]/.test(num)) return 'amex'
  
  return 'default'
})

const cardStyle = computed(() => bankColors[detectedBank.value] || bankColors.default)

const formattedCardNumber = computed(() => {
  const num = cardData.value.number.replace(/\s/g, '')
  return num.replace(/(\d{4})/g, '$1 ').trim()
})

const maskedCardNumber = computed(() => {
  const num = cardData.value.number.replace(/\s/g, '')
  if (num.length === 0) return ''
  if (num.length <= 4) return num.replace(/(\d{4})/g, '$1 ').trim()
  
  const masked = '*'.repeat(num.length - 4) + num.slice(-4)
  return masked.replace(/(.{4})/g, '$1 ').trim()
})

const displayCVV = computed(() => {
  const cvv = cardData.value.cvv
  if (cvv.length === 0) return '***'
  return showCVV.value ? cvv.padEnd(3, '*') : '*'.repeat(cvv.length).padEnd(3, '*')
})

const cardBrand = computed(() => {
  const number = cardData.value.number.replace(/\s/g, '')
  if (/^4/.test(number)) return 'visa'
  if (/^5[1-5]/.test(number)) return 'mastercard'
  if (/^3[47]/.test(number)) return 'amex'
  return 'generic'
})

watch(() => focusedInput.value, (newVal) => {
  isCardFlipped.value = newVal === 'cvv'
})

const isFormValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return (
    cardData.value.number.length === 16 &&
    cardData.value.holder.length > 0 &&
    cardData.value.email.length > 0 &&
    emailRegex.test(cardData.value.email) &&
    cardData.value.month.length === 2 &&
    parseInt(cardData.value.month) >= 1 &&
    parseInt(cardData.value.month) <= 12 &&
    cardData.value.year.length === 2 &&
    cardData.value.cvv.length === 3 &&
    aceptoTerminos.value &&
    aceptoPrivacidad.value
  )
})

// Se ejecuta cuando el componente se monta
onMounted(async () => {
    const href = window.location.href
    const queryString = href.split("?")[1]?.split("#")[0]

    if (queryString) {
        const params = new URLSearchParams(queryString)
        const id = params.get("id")

        if (id) {
            
            
            // Mostrar loading mientras verifica
            isProcessing.value = true
            
            try {
                await verificaridPayment(id)
                
                // Limpiar URL después de procesar
                window.history.replaceState({}, document.title, window.location.pathname)
                
                // Limpiar localStorage
                localStorage.removeItem('pendingPayment')
                
            } catch (error) {
                console.error('Error verificando pago:', error)
                errorMessage.value = 'Error al verificar el pago'
                showErrorModal.value = true
            } finally {
                isProcessing.value = false
            }
        }
    }
    
    await nextTick()
    const cardNumberInput = document.getElementById("cardNumber")
    if (cardNumberInput) {
        cardNumberInput.focus()
    }
})

// Tipo de tarjeta: '04' = crédito, '28' = débito
const tipoTarjeta = ref('04')

// Datos del formulario para la tarjeta visual
const cardData = ref({
    number: '',
    holder: '',
    month: '',
    year: '',
    cvv: '',
    email: ''
})

// Datos del formulario para OpenPay
const card = ref({
    number: "",
    holder_name: "",
    expiration_month: "",
    expiration_year: "",
    cvv2: "",
    amount: 0,
    email: "",
    phonenumber: "",
    path: "",
})

// Limpiar formulario
function resetForm() {
  cardData.value = { number: '', holder: '', month: '', year: '', cvv: '', email: '' }
  tipoTarjeta.value = '04'
  isCardFlipped.value = false
  focusedInput.value = null
  showCVV.value = false
  aceptoTerminos.value = false
  aceptoPrivacidad.value = false
}

function handleClose() {
  resetForm()
  emit('cancelar')
}

watch(() => props.modelValue, (newVal) => {
  if (!newVal) resetForm()
})

const tokenizeCard = () => {
    // Validar que el formulario esté completo
    if (!isFormValid.value) {
        errorMessage.value = 'Por favor completa todos los campos correctamente'
        showErrorModal.value = true
        return
    }

    // Iniciar el procesamiento
    isProcessing.value = true

    // Sincronizar los datos de cardData con card para OpenPay
    // OpenPay requiere el año en formato de 2 dígitos (25, no 2025)
    card.value.number = cardData.value.number
    card.value.holder_name = cardData.value.holder
    card.value.expiration_month = cardData.value.month
    card.value.expiration_year = cardData.value.year // Solo 2 dígitos
    card.value.cvv2 = cardData.value.cvv
    card.value.email = cardData.value.email

    OpenPay.token.create(
        {
            card_number: card.value.number,
            holder_name: card.value.holder_name,
            expiration_year: card.value.expiration_year,
            expiration_month: card.value.expiration_month,
            cvv2: card.value.cvv2,
        },
        successCallback,
        errorCallback
    );
};

const successCallback = (response) => {
    const token_id = response.data.id;
    // Envía el token y el deviceSessionId al backend
    makePayment(token_id, deviceSessionId);
};

const errorCallback = (error) => {
    isProcessing.value = false
    console.error('Error completo de OpenPay:', error)

    // Mensajes de error más específicos
    let mensajeError = 'Error al procesar la tarjeta.'

    if (error.data) {
        // Mensajes personalizados según el código de error
        switch(error.data.error_code) {
            case 3001:
                mensajeError = 'La tarjeta fue rechazada por el banco.'
                break
            case 3002:
                mensajeError = 'La tarjeta ha expirado.'
                break
            case 3003:
                mensajeError = 'La tarjeta no tiene fondos suficientes.'
                break
            case 3004:
                mensajeError = 'La tarjeta fue reportada como robada.'
                break
            case 3005:
                mensajeError = 'La tarjeta ha sido rechazada por el sistema antifraude.'
                break
            case 2004:
                mensajeError = 'El número de tarjeta es inválido.'
                break
            case 2005:
                mensajeError = 'La fecha de expiración es inválida o ya pasó.'
                break
            case 2006:
                mensajeError = 'El código CVV es inválido.'
                break
            default:
                mensajeError = error.data.description || 'Error al procesar la tarjeta. Verifica los datos e intenta nuevamente.'
        }
    }

    errorMessage.value = mensajeError
    showErrorModal.value = true
    emit('pago-error', { error: errorMessage.value })
};

const makePayment = async (token, deviceSessionId) => {
    isProcessing.value = true

    const cards = {
        amount: props.monto,
        holder_name: cardData.value.holder,
        phonenumber: props.datosCliente.Telefono || '0000000000',
        email: card.value.email, // Email del formulario (obligatorio)
        description: `Servicio - Orden ${props.servicioData.orden?.Orden || 'N/A'}`,
        path: window.location.origin + window.location.pathname // Esto asegura que vuelva a la misma página
    }

    try {
        const response = await axios.post(
            "https://app01.grupomhautomotriz.com:3000/api/payment",
            {
                token,
                deviceSessionId,
                cards,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        isProcessing.value = false

        if (response.data.error) {
            errorMessage.value = `Error: ${response.data.error}`
            showErrorModal.value = true
            emit('pago-error', { error: errorMessage.value })
        } else {
            const redirectUrl = response.data.redirect

            if (redirectUrl) {


                // Guardar email en localStorage antes de redirigir
                localStorage.setItem('paymentEmail', cardData.value.email)


                // Guardar TODOS los datos del servicio antes de redirigir
                localStorage.setItem('pendingPayment', JSON.stringify({
                    transactionId: response.data.id,
                    amount: props.monto,
                    timestamp: Date.now(),
                    email: cardData.value.email, // Guardar el email del formulario
                    formaPago: tipoTarjeta.value, // '04' crédito, '28' débito
                    // Guardar datos completos del servicio
                    servicioData: props.servicioData,
                    datosCliente: props.datosCliente
                }))

                window.location.href = redirectUrl

            } else {
                // Pago exitoso sin 3D Secure
                transactionId.value = response.data.id || 'N/A'

                // Guardar email en localStorage
                localStorage.setItem('paymentEmail', cardData.value.email)


                // Emitir evento
                emit('pago-exitoso', {
                    transactionId: transactionId.value,
                    amount: props.monto,
                    email: cardData.value.email,
                    formaPago: tipoTarjeta.value
                })

                // Cerrar modal de pago
                resetForm()
                emit('update:modelValue', false)
            }
        }
    } catch (error) {
        isProcessing.value = false
        errorMessage.value = `Error en la conexión: ${error.response?.data?.message || error.message}`
        showErrorModal.value = true
        emit('pago-error', { error: errorMessage.value })
    }
}

const verificaridPayment = async (id) => {
    try {
        const response = await axios.post(
            "https://app01.grupomhautomotriz.com:3000/api/transaction_id",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
        

        // Verifica múltiples formas de éxito
        const isSuccess = response.data.success && response.data.charge?.status === 'completed'

        if (isSuccess) {
            //  Recuperar email y emitir evento ANTES de mostrar modal
            const pendingPaymentStr = localStorage.getItem('pendingPayment')
            const pendingPayment = pendingPaymentStr ? JSON.parse(pendingPaymentStr) : null
            const email = pendingPayment?.email || localStorage.getItem('paymentEmail') || 'N/A'

            transactionId.value = response.data.charge.id

            // Recuperar formaPago del pendingPayment
            const formaPago = pendingPayment?.formaPago || '04'

            // EMITIR EVENTO PRIMERO (para que PantallaATM consulte XML y muestre overlay)
            emit('pago-exitoso', {
                transactionId: response.data.charge.id,
                amount: response.data.charge.amount,
                email: email,
                formaPago: formaPago
            })

            // NO mostrar modal aquí, se mostrará desde PantallaATM después de consultar XML
            // showSuccessModal.value = true
            // showConfetti()
        } else {
            // Si el cargo existe pero no está completado
            const errorMsg = response.data.charge?.error_message ||
                           response.data.message ||
                           'Pago no completado'
            throw new Error(errorMsg)
        }
        
    } catch (error) {
        console.error('Error verificando pago:', error)
        throw error
    }
}

// Confetti
function showConfetti() {
  const duration = 3000
  const end = Date.now() + duration

  ;(function frame() {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#059669', '#10b981']
    })
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#059669', '#10b981']
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

function handleSuccessClose() {
  showSuccessModal.value = false

  // Emitir evento de pago exitoso con los datos
  emit('pago-exitoso', {
    transactionId: transactionId.value,
    amount: props.monto,
    email: card.value.email,
    formaPago: tipoTarjeta.value
  })

  // Resetear formulario y cerrar modal
  resetForm()
  emit('update:modelValue', false)
}

function handleErrorClose() {
  showErrorModal.value = false
}
</script>

<template>
  <div>
    <!-- Modal de Pago Principal -->
    <v-dialog v-model="visible" persistent max-width="705" class="payment-dialog">
      <v-card class="payment-card" elevation="0">
        <!-- Header -->
        <v-card-title class="payment-header">
          <div class="header-content">
            <span class="header-title">Pago Seguro</span>
          </div>
          <v-btn icon variant="text" size="small" @click="handleClose" :disabled="isProcessing">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="payment-body">
          <!-- Tarjeta 3D -->
          <div class="card-3d-container">
            <div class="credit-card" :class="{ flipped: isCardFlipped }">
              <!-- Frente -->
              <div class="card-front" :style="{ background: cardStyle.gradient }">
                <div class="card-chip"></div>
                
                <div class="card-brand-top" v-if="cardBrand !== 'generic'">
                  <svg v-if="cardBrand === 'mastercard'" width="60" height="36" viewBox="0 0 60 36" fill="none">
                    <circle cx="21" cy="18" r="14" fill="#EB001B"/>
                    <circle cx="39" cy="18" r="14" fill="#F79E1B"/>
                    <path d="M30 6.5C27.2 8.9 25.5 12.3 25.5 16C25.5 19.7 27.2 23.1 30 25.5C32.8 23.1 34.5 19.7 34.5 16C34.5 12.3 32.8 8.9 30 6.5Z" fill="#FF5F00"/>
                  </svg>
                  <img v-else :src="creditCards.find(c => c.name === cardBrand)?.src" :alt="cardBrand">
                </div>
                
                <div class="card-number">{{ maskedCardNumber || '**** **** **** ****' }}</div>
                
                <div class="card-details">
                  <div class="card-holder">
                    <div class="label">TITULAR</div>
                    <div class="value">{{ cardData.holder || 'NOMBRE APELLIDO' }}</div>
                  </div>
                  <div class="card-expiry">
                    <div class="label">VENCE</div>
                    <div class="value">{{ cardData.month || 'MM' }}/{{ cardData.year || 'AA' }}</div>
                  </div>
                </div>
              </div>

              <!-- Reverso -->
              <div class="card-back" :style="{ background: cardStyle.gradient }">
                <div class="magnetic-strip"></div>
                <div class="signature-panel">
                  <div class="cvv-label">CVV</div>
                  <div class="cvv-value">{{ displayCVV }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Logos de bancos -->
          <div class="banks-section">
            <div class="banks-label">Aceptamos</div>
            <div class="banks-grid">
              <div class="bank-chip" v-for="card in creditCards" :key="card.name">
                <img :src="card.src" :alt="card.name">
              </div>
              <div class="bank-chip" v-for="card in debitCards" :key="card.name">
                <img :src="card.src" :alt="card.name">
              </div>
            </div>
          </div>

          <!-- Formulario -->
          <v-form class="payment-form" id="payment-form" @submit.prevent="tokenizeCard">
            <!-- Número de tarjeta -->
            <div class="form-group">
              <label class="form-label">
                Número de tarjeta
                <span class="char-counter">{{ cardData.number.length }}/16</span>
              </label>
              <v-text-field
                v-model="cardData.number"
                variant="outlined"
                density="comfortable"
                placeholder="1234 5678 9012 3456"
                class="card-input"
                maxlength="16"
                :disabled="isProcessing"
                @input="cardData.number = cardData.number.replace(/\D/g, '').slice(0, 16)"
                :error-messages="cardData.number.length > 0 && cardData.number.length < 16 ? 'Debe tener 16 dígitos' : ''"
                @focus="focusedInput = 'number'"
                @blur="focusedInput = null"
              >
                <template v-slot:append-inner>
                  <v-icon color="grey-lighten-1">mdi-credit-card-outline</v-icon>
                </template>
              </v-text-field>
            </div>

            <!-- Titular -->
            <div class="form-group">
              <label class="form-label">Nombre del titular</label>
              <v-text-field
                v-model="cardData.holder"
                variant="outlined"
                density="comfortable"
                placeholder="Como aparece en la tarjeta"
                class="card-input"
                :disabled="isProcessing"
                @focus="focusedInput = 'holder'"
                @blur="focusedInput = null"
              />
            </div>

            <!-- Email -->
            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <v-text-field
                v-model="cardData.email"
                variant="outlined"
                density="comfortable"
                placeholder="correo@ejemplo.com"
                type="email"
                class="card-input"
                :disabled="isProcessing"
                :error-messages="cardData.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardData.email) ? 'Email inválido' : ''"
                @focus="focusedInput = 'email'"
                @blur="focusedInput = null"
              >
                <template v-slot:append-inner>
                  <v-icon color="grey-lighten-1">mdi-email-outline</v-icon>
                </template>
              </v-text-field>
            </div>

            <!-- Tipo de tarjeta -->
            <div class="form-group">
              <label class="form-label">Tipo de tarjeta</label>
              <v-radio-group v-model="tipoTarjeta" inline hide-details :disabled="isProcessing">
                <v-radio label="Crédito" value="04" color="primary" />
                <v-radio label="Débito" value="28" color="primary" />
              </v-radio-group>
            </div>

            <!-- Vencimiento y CVV -->
            <v-row>
              <v-col cols="7">
                <div class="form-group">
                  <label class="form-label">Fecha de vencimiento</label>
                  <v-row no-gutters>
                    <v-col cols="5">
                      <v-text-field
                        v-model="cardData.month"
                        variant="outlined"
                        density="comfortable"
                        placeholder="MM"
                        maxlength="2"
                        class="card-input"
                        :disabled="isProcessing"
                        @input="cardData.month = cardData.month.replace(/\D/g, '').slice(0, 2)"
                        :error-messages="cardData.month.length === 2 && (parseInt(cardData.month) < 1 || parseInt(cardData.month) > 12) ? 'Inválido' : ''"
                      />
                    </v-col>
                    <v-col cols="2" class="d-flex align-center justify-center" style="margin-top: -20px;">
                      <span class="expiry-divider">/</span>
                    </v-col>
                    <v-col cols="5">
                      <v-text-field
                        v-model="cardData.year"
                        variant="outlined"
                        density="comfortable"
                        placeholder="AA"
                        maxlength="2"
                        class="card-input"
                        :disabled="isProcessing"
                        @input="cardData.year = cardData.year.replace(/\D/g, '').slice(0, 2)"
                      />
                    </v-col>
                  </v-row>
                </div>
              </v-col>
              <v-col cols="5">
                <div class="form-group">
                  <label class="form-label">
                    CVV
                    <span class="char-counter">{{ cardData.cvv.length }}/3</span>
                    <v-tooltip location="top">
                      <template v-slot:activator="{ props }">
                        <v-icon size="14" class="ml-1" v-bind="props">mdi-help-circle-outline</v-icon>
                      </template>
                      <span>3 dígitos en la parte trasera</span>
                    </v-tooltip>
                  </label>
                  <v-text-field
                    v-model="cardData.cvv"
                    variant="outlined"
                    density="comfortable"
                    placeholder="***"
                    :type="showCVV ? 'text' : 'password'"
                    maxlength="3"
                    class="card-input"
                    :disabled="isProcessing"
                    @input="cardData.cvv = cardData.cvv.replace(/\D/g, '').slice(0, 3)"
                    :error-messages="cardData.cvv.length > 0 && cardData.cvv.length < 3 ? 'Debe tener 3 dígitos' : ''"
                    @focus="focusedInput = 'cvv'"
                    @blur="focusedInput = null"
                  >
                    <template v-slot:append-inner>
                      <v-btn icon size="small" variant="text" @click="showCVV = !showCVV" :disabled="isProcessing">
                        <v-icon size="18" color="grey-lighten-1">
                          {{ showCVV ? 'mdi-eye-off' : 'mdi-eye' }}
                        </v-icon>
                      </v-btn>
                    </template>
                  </v-text-field>
                </div>
              </v-col>
            </v-row>
            
            <!-- Checkboxes legales -->
            <div class="legal-section">
              <v-checkbox v-model="aceptoTerminos" density="compact" hide-details color="primary" :disabled="isProcessing">
                <template v-slot:label>
                  <span class="legal-text">
                    Acepto los <a href="#" class="legal-link" @click.stop>términos y condiciones</a>
                  </span>
                </template>
              </v-checkbox>
              <v-checkbox v-model="aceptoPrivacidad" density="compact" hide-details color="primary" :disabled="isProcessing">
                <template v-slot:label>
                  <span class="legal-text">
                    Acepto el <a href="#" class="legal-link" @click.stop>aviso de privacidad</a>
                  </span>
                </template>
              </v-checkbox>
            </div>

            <!-- Botón de pago -->
            <v-btn
              block
              size="x-large"
              color="primary"
              class="payment-btn"
              :disabled="!isFormValid || isProcessing"
              :loading="isProcessing"
              type="submit"
            >
              <v-icon class="mr-2" v-if="!isProcessing">mdi-shield-check</v-icon>
              {{ isProcessing ? 'Procesando...' : `Pagar ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)}` }}
            </v-btn>

            <!-- Footer de seguridad -->
            <div class="security-footer">
              <v-icon size="16" color="grey">mdi-lock</v-icon>
              <span class="security-text">Transacción 100% segura</span>
              <span class="powered-by">Powered by</span>
              <img :src="URL_BANK + 'LogotipoOpenpay-01.jpg'" alt="OpenPay" class="openpay-logo">
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Modal de Éxito -->
    <v-dialog v-model="showSuccessModal" max-width="500" persistent>
      <v-card rounded="lg">
        <v-card-title class="d-flex justify-center align-center">
          <div class="text-h5 text-medium-emphasis">¡Pago Exitoso!</div>
          <v-btn icon="mdi-close" variant="text" @click="handleSuccessClose" style="position: absolute; right: 8px;"></v-btn>
        </v-card-title>
        <v-divider class="mb-4"></v-divider>
        <v-card-text>
          <div class="py-12 text-center">
            <v-icon class="mb-6" color="success" icon="mdi-check-circle-outline" size="128"></v-icon>
            <div class="text-h5 font-weight-bold mb-4">Pago procesado correctamente</div>
            <div class="text-body-1">
              ID de transacción: <strong>{{ transactionId }}</strong>
            </div>
            <div class="text-body-2 mt-2 text-grey">
              Recibirás un correo de confirmación en breve
            </div>
          </div>
        </v-card-text>
        <v-divider class="mt-2"></v-divider>
        <v-card-actions class="my-2 d-flex justify-end">
          <v-btn class="text-none" color="primary" rounded="lg" variant="flat" @click="handleSuccessClose">
            Continuar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Modal de Error -->
    <v-dialog v-model="showErrorModal" max-width="500">
      <v-card rounded="lg">
        <v-card-title class="d-flex justify-space-between align-center">
          <div class="text-h5 text-medium-emphasis ps-2">Error en el Pago</div>
          <v-btn icon="mdi-close" variant="text" @click="handleErrorClose"></v-btn>
        </v-card-title>
        <v-divider class="mb-4"></v-divider>
        <v-card-text>
          <div class="py-12 text-center">
            <v-icon class="mb-6" color="error" icon="mdi-alert-circle-outline" size="128"></v-icon>
            <div class="text-h5 font-weight-bold mb-4">No se pudo procesar el pago</div>
            <div class="text-body-1 text-error">{{ errorMessage }}</div>
            <div class="text-body-2 mt-4 text-grey">
              Por favor verifica tus datos e intenta nuevamente
            </div>
          </div>
        </v-card-text>
        <v-divider class="mt-2"></v-divider>
        <v-card-actions class="my-2 d-flex justify-end">
          <v-btn class="text-none" color="primary" rounded="lg" variant="flat" @click="handleErrorClose">
            Intentar de nuevo
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* Mantén todos los estilos que ya tienes */
.payment-card {
  background: #ffffff;
  border-radius: 24px !important;
  overflow: hidden;
}

.payment-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payment-header .v-btn {
  position: absolute;
  right: 16px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.payment-body {
  padding: 32px 24px !important;
}

.card-3d-container {
  perspective: 1000px;
  margin-bottom: 32px;
}

.credit-card {
  width: 100%;
  height: 210px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}

.credit-card.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card-front {
  color: white;
  transition: background 0.3s ease;
}

.card-back {
  color: white;
  transform: rotateY(180deg);
  transition: background 0.3s ease;
}

.card-chip {
  width: 48px;
  height: 36px;
  background: linear-gradient(135deg, #f4f4f4 0%, #d4d4d4 100%);
  border-radius: 6px;
  margin-bottom: 24px;
}

.card-brand-top {
  position: absolute;
  top: 24px;
  right: 24px;
}

.card-brand-top img {
  height: 40px;
  width: auto;
  filter: brightness(0) invert(1);
}

.card-number {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 3px;
  margin-bottom: 20px;
  font-family: 'Courier New', monospace;
  min-height: 28px;
}

.card-details {
  display: flex;
  justify-content: space-between;
}

.label {
  font-size: 10px;
  opacity: 0.7;
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.value {
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
}

.magnetic-strip {
  width: calc(100% + 48px);
  height: 48px;
  background: #000;
  margin: -24px -24px 20px -24px;
}

.signature-panel {
  background: #fff;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: #000;
}

.cvv-label {
  font-size: 10px;
  font-weight: 600;
}

.cvv-value {
  font-size: 16px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}

.banks-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.banks-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
  text-align: center;
}

.banks-grid {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.bank-chip {
  width: 62px;
  height: 32px;
  background: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.bank-chip img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.payment-form {
  margin-top: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.char-counter {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
}

.card-input :deep(.v-field) {
  border-radius: 10px;
  font-size: 15px;
}

.card-input :deep(.v-field--focused) {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.expiry-divider {
  font-size: 20px;
  font-weight: 300;
  color: #9ca3af;
  display: flex;
  align-items: center;
  height: 100%;
  padding-bottom: 0;
  margin-top: -4px;
}

.legal-section {
  margin: 20px 0;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.legal-text {
  font-size: 13px;
  color: #6b7280;
}

.legal-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.legal-link:hover {
  text-decoration: underline;
}

.payment-btn {
  margin-top: 20px;
  border-radius: 12px !important;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  letter-spacing: 0;
  height: 56px !important;
}

.security-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.security-text {
  font-size: 12px;
  color: #6b7280;
}

.powered-by {
  font-size: 11px;
  color: #9ca3af;
  margin-left: 8px;
}

.openpay-logo {
  height: 35px;
  margin-left: 4px;
}
</style>