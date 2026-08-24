import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'
import { useSiteStore } from './stores/site'

const app = createApp(App)

app.use(createPinia())
app.use(router)

void useSiteStore().load()

app.mount('#app')
