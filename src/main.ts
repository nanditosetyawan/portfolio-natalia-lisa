import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'
import './styles/product-polish.css'
import { installRuntimeMonitoring } from './production/monitoring'
import { registerProductionServiceWorker } from './production/pwa'
import { installSeoRouter } from './production/seo'

const app = createApp(App)
const pinia = createPinia()
installRuntimeMonitoring(app)
app.use(pinia)
app.use(router)
installSeoRouter(router)
app.mount('#app')
void registerProductionServiceWorker()
