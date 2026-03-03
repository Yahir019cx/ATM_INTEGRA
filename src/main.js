import './assets/main.css'
import axios from 'axios'
import { createApp, warn } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { createI18n } from 'vue-i18n'
// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
//i18n
import es from './locales/es.json'
import en from './locales/en.json'
const messages = { en, es }

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'en',
  messages,
})
// Lottie
import { Vue3Lottie } from 'vue3-lottie'

// Instancia de Vuetify
const vuetify = createVuetify({
  components,
  directives,
})

// Crear app
const app = createApp(App)
axios.defaults.baseURL ='http://localhost:64483/IntegraWCFService.svc'
// axios.defaults.baseURL = 'https://app01.grupomhautomotriz.com';
app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(i18n)
// Registrar componente global
app.component('Vue3Lottie', Vue3Lottie)

app.mount('#app')
