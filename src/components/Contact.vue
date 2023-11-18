<script setup>
import { Icon } from '@arco-design/web-vue'

const IconFont = Icon.addFromIconFontCn({
  src: 'https://at.alicdn.com/t/c/font_4336463_0i6ly0yvyzb.js'
})
</script>

<template>
  <div class="contact-box">
    <a
      href="https://wpa.qq.com/msgrd?v=3&uin=1906929246&site=qq&menu=yes&jumpflag=1"
      class="contact css-cursor-hover-enabled"
    >
      <icon-font type="icon-qq" />
      <span>QQ</span>
    </a>
    <a href="https://gitee.com/sf-yuzifu" class="contact css-cursor-hover-enabled">
      <icon-font type="icon-gitee" />
      <span>Gitee</span>
    </a>
    <a href="https://github.com/sf-yuzifu" class="contact css-cursor-hover-enabled">
      <icon-font type="icon-github" />
      <span>Github</span>
    </a>
    <a href="https://space.bilibili.com/447666445" class="contact css-cursor-hover-enabled">
      <icon-font type="icon-bilibili" />
      <span>BiliBili</span>
    </a>
  </div>
</template>

<style scoped>
.contact-box {
  position: absolute;
  left: 20px;
  top: 186px;
  display: grid;
  grid-template-columns: repeat(2, 130px);
  grid-gap: 20px;
  height: auto;
  justify-items: center;
}

.contact {
  height: max-content;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  bottom: 15px;
  margin: 0 20px;
  transition: transform 0.05s;
}

.contact span {
  margin: 5px 0 0;
  font-size: 20px;
  color: #003153;
  font-weight: 800;
}

.contact span {
  text-shadow:
    #fff 1px 0 0,
    #fff 0 1px 0,
    #fff -1px 0 0,
    #fff 0 -1px 0;
}

.arco-icon {
  font-size: 48px;
  filter: drop-shadow(0px 0px 4px #fff6);
}

.contact img {
  height: 48px;
}

.contact:active {
  transform: scale(0.9);
}
</style>
