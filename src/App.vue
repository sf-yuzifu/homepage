<script setup>
import Cursor from '@/components/Cursor.vue'
import Footer from '@/components/Footer.vue'
import Level from '@/components/Level.vue'
import Toolbox from '@/components/Toolbox.vue'
import Contact from '@/components/Contact.vue'
import Task from '@/components/Task.vue'
import Loading from '@/components/Loading.vue'
import { ref } from 'vue'

const loading = ref(true)
const percent = ref(1)

import NProgress from 'nprogress'

NProgress.start()

const load = setInterval(() => {
  percent.value = NProgress.status
  if (document.readyState === 'complete') {
    NProgress.done()
    percent.value = 1
    setTimeout(() => {
      loading.value = false
    }, 2000)
    clearInterval(load)
  }
}, 1)
</script>

<template>
  <transition name="loading">
    <Loading v-if="loading" :percent="percent"></Loading>
  </transition>
  <main v-if="!loading">
    <Level></Level>
    <Toolbox></Toolbox>
    <Contact></Contact>
    <Task></Task>
    <Footer></Footer>
    <div id="curtain"></div>
    <div id="background"></div>
  </main>
  <Cursor></Cursor>
</template>

<style scoped>
main {
  display: flex;
  flex-direction: column;
}

.loading-leave-to {
  opacity: 0;
}

.loading-leave-from {
  opacity: 1;
}

.loading-leave-active {
  transition: opacity 0.5s ease-in-out;
}

#background {
  background-image: url('/aris.jpeg');
  background-position: center;
  background-size: cover;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
}
</style>
