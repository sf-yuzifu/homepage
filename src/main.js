import './assets/index.css'
import '@arco-design/web-vue/dist/arco.css'

import { createApp } from 'vue'
import { Modal } from '@arco-design/web-vue'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)
app.use(ArcoVue)
app.use(ArcoVueIcon)

app.mount('#app')

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      Modal.confirm({
        title: "警告",
        content: "",
        okText: "好",
        onOk: () => {
          updateSW(true)
        },
        onCancel: false,
        hideCancel: false,
        width: 'auto'
      })
    }
  })
}

const init = () => {

}

window.addEventListener('resize', init)
init()
