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
      Modal.open({
        title: '通知',
        content: '老师，站点已更新，刷新即可访问最新内容！',
        onOk: () => {
          updateSW(true)
        }
      })
    }
  })
}

const init = () => {}

window.addEventListener('resize', init)
init()

setInterval(() => {
  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', async (e) => {
      const url = link.getAttribute('href')
      e.preventDefault()
      document.querySelector('#curtain').style.display = 'block'
      setTimeout(() => window.open(url), 900)
      setTimeout(() => (document.querySelector('#curtain').style.display = ''), 3000)
    })
  })
}, 1000)
