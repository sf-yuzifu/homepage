<script setup>
import { Modal } from '@arco-design/web-vue'
import { h, ref } from 'vue'
import config from '/_config.json'
const emit = defineEmits(['switch'])
const props = defineProps(['l2dOnly'])

const max_ap = 60 + config.level * 2
const ap = ref(max_ap)
const img = ref('/img/max.png')

const about = () => {
  Modal.open({
    title: '关于',
    content: () => [
      h(
        'p',
        {},
        config.author === '小鱼yuzifu'
          ? `© ${new Date().getFullYear()} 小鱼yuzifu`
          : [`© ${new Date().getFullYear()} ${config.author}`, h('p', {}, 'Made by 小鱼yuzifu')]
      ),
      h('span', {}, '项目地址：'),
      h('a', { href: 'https://github.com/sf-yuzifu/homepage', target: '_blank' }, 'Github'),
      config.ICP
        ? [
            h('br', {}, ''),
            h('a', { href: 'https://beian.miit.gov.cn/', target: '_blank' }, config.ICP)
          ]
        : null
    ],
    footer: false
  })
}

const change = () => {
  img.value = img.value === '/img/min.png' ? '/img/max.png' : '/img/min.png'
  emit('switch')
}

setInterval(() => {
  ap.value =
    max_ap -
    Math.trunc(
      max_ap *
        ((new Date().getTime() -
          new Date(
            `${new Date().getFullYear()}-${
              new Date().getMonth() + 1
            }-${new Date().getDate()} 00:00:00`
          )) /
          86400000)
    )
}, 10)
</script>

<template>
  <div class="toolbox-box">
    <div
      class="toolbox"
      :style="{
        transform: (!props.l2dOnly ? 'translateY(0)' : 'translateY(-300px)') + ' skew(-10deg)',
        transition: 'transform 0.3s ' + (!props.l2dOnly ? 'ease-out' : 'ease-in')
      }"
    >
      <img src="/img/ap.png" alt="" />
      <span>{{ ap + '/' + max_ap }}</span>
    </div>
    <div
      class="toolbox"
      :style="{
        transform: (!props.l2dOnly ? 'translateY(0)' : 'translateY(-300px)') + ' skew(-10deg)',
        transition: 'transform 0.3s ' + (!props.l2dOnly ? 'ease-out' : 'ease-in')
      }"
    >
      <img src="/img/gold.png" alt="" />
      <span>11,451,419</span>
    </div>
    <div
      class="toolbox"
      :style="{
        transform: (!props.l2dOnly ? 'translateY(0)' : 'translateY(-300px)') + ' skew(-10deg)',
        transition: 'transform 0.3s ' + (!props.l2dOnly ? 'ease-out' : 'ease-in')
      }"
    >
      <img src="/img/pyroxene.png" alt="" />
      <span>24,000</span>
    </div>
    <a
      class="about toolbox"
      @click="about"
      :style="{
        transform: (!props.l2dOnly ? 'translateY(0)' : 'translateY(-300px)') + ' skew(-10deg)',
        transition: 'transform 0.3s ' + (!props.l2dOnly ? 'ease-out' : 'ease-in')
      }"
    >
      <icon-info-circle class="css-cursor-hover-enabled" />
    </a>
    <a
      class="l2d toolbox"
      @click="change"
      :style="{
        transform: (!props.l2dOnly ? 'translateY(0)' : 'translateY(-76px)') + ' skew(-10deg)',
        transition: 'transform 0.3s ' + (!props.l2dOnly ? 'ease-out' : 'ease-in') + ',opacity 0.6s',
        opacity: !props.l2dOnly ? 1 : 0
      }"
    >
      <img alt="" :src="img" />
    </a>
  </div>
</template>

<style scoped>
.toolbox-box {
  position: absolute;
  right: 20px;
  top: 40px;
  display: inline-flex;
}

.toolbox-box .toolbox {
  width: 220px;
  height: 56px;
  background: #fffd;
  color: #003153;
  margin: 0 10px;
  transform: skew(-10deg);
  border-radius: 6px;
  filter: drop-shadow(0px 0px 3px #0003);
  transition:
    background-color 0.3s,
    transform 0.1s;
  display: flex;
  align-items: center;
}

.toolbox img {
  height: 70%;
  transform: skew(10deg);
  margin: 0 8px 0 10px;
}
.toolbox span {
  font-size: 26px;
  transform: skew(10deg);
}

.toolbox-box .toolbox.about,
.toolbox-box .toolbox.l2d {
  width: 80px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbox-box .toolbox.l2d {
  position: absolute;
  right: 0;
  top: 76px;
}

.toolbox-box .toolbox.l2d:hover {
  opacity: 1 !important;
}

.toolbox.l2d img {
  filter: drop-shadow(-100vw 0px 0px #003153);
  transform: translateX(100vw);
  height: 32px;
}

.toolbox-box .toolbox:hover {
  background: #fffe;
}

.toolbox-box .toolbox.about:active,
.toolbox-box .toolbox.l2d:active {
  transform: skew(-10deg) scale(0.9);
}

.arco-icon {
  font-size: 32px;
  transform: skew(10deg);
}

@media screen and (max-width: 1199px) {
  .toolbox:not(.about) {
    display: none;
  }
}
</style>
