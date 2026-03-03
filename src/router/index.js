import { createRouter, createWebHistory } from 'vue-router'
import PantallaATM from '@/views/PantallaATM.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'pantallaATM',
      component: PantallaATM,
    },
    {
      path: '/exit-pass',
      name: 'exit-pass',
      component: () => import('../views/ExitPass.vue'),
    },
    {
      path: '/facturacion',
      name: 'facturacion',
      component: () => import('../views/FacturacionView.vue'),
    },
  ],
})

export default router
