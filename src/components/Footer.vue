<script setup>
import { ref } from 'vue'

const time = ref(new Date().getHours() + ':' + new Date().getMinutes())

const addZero = (time) => {
  return time < 10 ? '0' + time : time
}

setInterval(() => {
  time.value = addZero(new Date().getHours()) + ':' + addZero(new Date().getMinutes())
}, 1000)
</script>

<template>
  <div class="footer">
    <div class="project-box">
      <a
        href="https://gitee.com/sf-yuzifu/eat-fish-together"
        class="project css-cursor-hover-enabled"
      >
        <img src="/img/fish.png" alt="" />
        <span>一起吃小鱼</span>
      </a>
      <a href="https://gitee.com/sf-yuzifu/bcm_convertor" class="project css-cursor-hover-enabled">
        <img src="/img/convertor.png" alt="" />
        <span>编程猫格式工厂</span>
      </a>
      <a href="https://waddle.coco-central.cn/" class="project css-cursor-hover-enabled">
        <img src="/img/waddle2.png" alt="" />
        <span>Waddle编辑器</span>
      </a>
      <a href="https://shequ.pickduck.cn/" class="project css-cursor-hover-enabled">
        <img src="/img/pickduck.png" alt="" />
        <span>PICKDUCK</span>
      </a>
      <a href="https://boxy.coco-central.cn/" class="project css-cursor-hover-enabled">
        <img src="/img/boxy.png" alt="" />
        <span>Boxy编辑器</span>
      </a>
    </div>
    <div class="time">
      <p>△×+○</p>
      <span>{{ time }}</span>
    </div>
  </div>
</template>

<style scoped>
.footer {
  width: calc(100% - 80px);
  height: 60px;
  background: #e8f3ffee;
  position: absolute;
  bottom: 25px;
  transform: skew(-20deg);
  align-self: center;
  border-radius: 8px;
  display: inline-flex;
  justify-content: center;
  filter: drop-shadow(0px 0px 6px #0003);
  transition: all 0.3s;
}

.footer::after {
  content: '';
  width: calc(100% - 360px);
  height: 60px;
  background: #ffffffdd;
  position: absolute;
  transform: skew(50deg);
  border-radius: 4px;
  z-index: -1;
  transition: all 0.3s;
}

.project-box {
  width: calc(100% - 120px);
  height: 100%;
  transform: skew(20deg);
  position: absolute;
  left: 20px;
  display: inline-flex;
  align-items: flex-end;
}

.time {
  transform: skew(20deg);
  position: absolute;
  right: 40px;
  bottom: 10px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  font-size: 18px;
  flex-direction: column;
}

.time p {
  color: #abb3c4;
}

.time span {
  color: #525f72;
}

.project {
  height: max-content;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  bottom: 15px;
  margin: 0 0 0 5%;
  transition: transform 0.05s;
}

.project:active {
  transform: scale(0.9);
}

.project span {
  margin: 5px 0 0;
  color: #003153;
  font-size: 16px;
}

.arco-icon {
  font-size: 48px;
}

.project img {
  width: 64px;
  height: 64px;
}

@media screen and (max-width: 830px) {
  .project-box {
    width: 100%;
    justify-content: space-evenly;
    left: 0;
  }

  .time {
    display: none;
  }

  .project {
    margin: 0;
  }
}

@media screen and (max-width: 600px) {
  .project img {
    width: 48px;
    height: 48px;
  }

  .project span {
    font-size: 12px;
  }

  .footer::after {
    width: calc(100% - 120px);
  }
}

@media screen and (max-width: 495px) {
  .project span {
    display: none;
  }

  .project {
    bottom: 0;
  }

  .project-box {
    transform: skew(0deg);
    align-items: center;
  }

  .footer {
    transform: skew(0deg);
    width: calc(100% - 40px);
    height: 80px;
  }

  .footer::after {
    transform: skew(0deg);
    display: none;
  }
}
</style>
