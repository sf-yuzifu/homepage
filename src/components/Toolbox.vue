<script setup>
import { Modal } from '@arco-design/web-vue'
import { h, ref } from 'vue'
import config from '/_config.json'

const max_ap = 60 + config.level * 2
const ap = ref(max_ap)

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
    <div class="toolbox">
      <img src="/img/ap.png" alt="" />
      <span>{{ ap + '/' + max_ap }}</span>
    </div>
    <div class="toolbox">
      <img src="/img/gold.png" alt="" />
      <span>11,451,419</span>
    </div>
    <div class="toolbox">
      <img src="/img/pyroxene.png" alt="" />
      <span>24,000</span>
    </div>
    <a class="about toolbox" @click="about">
      <icon-info-circle class="css-cursor-hover-enabled" />
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

.toolbox-box .toolbox.about {
  width: 80px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbox-box .toolbox:hover {
  background: #fffe;
}

.toolbox-box .toolbox.about:active {
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
