import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'
import { useAuthStore } from './stores/auth'
import { initializePublishedRuntime } from './runtime/publishedRuntime'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

async function bootstrap(): Promise<void> {
  const publishedRuntime = initializePublishedRuntime()
  await useAuthStore().initialize()
  app.mount('#app')
  await publishedRuntime
}

void bootstrap()
