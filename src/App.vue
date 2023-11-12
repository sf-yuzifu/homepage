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

setTimeout(
  () => {
    loading.value = false
  },
  Math.floor(Math.random() * 5 + 3) * 1000
  // 懒了，先放个伪加载
)
</script>

<template>
  <transition name="loading">
    <Loading v-if="loading"></Loading>
  </transition>
  <main v-if="!loading">
    <Level></Level>
    <Toolbox></Toolbox>
    <Contact></Contact>
    <Task></Task>
    <Footer></Footer>
    <div id="curtain"></div>
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
</style>
