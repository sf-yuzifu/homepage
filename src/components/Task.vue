<script setup>
import { ref } from 'vue'
import config from '/_config.json'

const curtain = ref(false)
const bg = ref(false)

const props = defineProps(['l2dOnly'])

const skip = () => {
  bg.value = true
  setTimeout(() => {
    curtain.value = true
    setTimeout(() => {
      window.open(config.task.href)
    }, 1000)
    setTimeout(
      () => {
        curtain.value = false
        bg.value = false
      },
      Math.floor(Math.random() * 2 + 4) * 500
    )
  }, 1000)
}
</script>

<template>
  <transition name="down2">
    <div
      v-if="!props.l2dOnly"
      :name="config.task.name"
      class="task css-cursor-hover-enabled"
      @click="skip"
    ></div>
  </transition>
  <transition name="curtain">
    <video v-if="bg" autoplay src="/transfrom.webm" class="bg"></video>
  </transition>

  <transition name="curtain">
    <div v-if="curtain" class="curtain">
      <img src="/shitim/Tran_Shitim_Icon.png" alt="" />
    </div>
  </transition>
</template>

<style scoped>
.bg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 20;
}

.curtain {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('/shitim/Event_Main_Stage_Bg.png') center;
  background-size: cover;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.curtain img {
  width: 500px;
  height: auto;
}

.task {
  position: absolute;
  bottom: 140px;
  right: 60px;
  width: 150px;
  height: 150px;
  background: url('/task.png') center;
  background-size: cover;
  transition: transform 0.1s;
}

.task:before {
  content: '';
  position: absolute;
  left: 10px;
  bottom: 0;
  height: 50px;
  width: calc(100% + 10px);
  border-radius: 8px;
  background: #003153;
  transform: skewX(-10deg);
}

.task:after {
  content: attr(name);
  position: absolute;
  left: 10px;
  bottom: 0;
  height: 50px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 26px;
  font-weight: 800;
}

.task:active {
  transform: scale(0.9);
}

.curtain-enter-from {
  opacity: 0;
}

.curtain-enter-to {
  opacity: 1;
}

.curtain-leave-to {
  transform: scaleY(0%);
}

.curtain-leave-from {
  transform: scaleY(100%);
}

.curtain-leave-active,
.curtain-enter-active {
  transition:
    opacity 0.1s ease-in-out,
    transform 0.25s ease-in-out;
}

@media screen and (max-width: 495px) {
  .task {
    right: 40px;
  }
}

.down2-leave-to,
.down2-enter-from {
  transform: translateY(300px);
}

.down2-leave-from,
.down2-enter-to {
  transform: translateY(0);
}

.down2-leave-active {
  transition: transform 0.3s ease-in;
}

.down2-enter-active {
  transition: transform 0.3s ease-out;
}
</style>
