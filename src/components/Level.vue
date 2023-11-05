<script setup></script>

<template>
  <div class="level-box">
    <div class="container">
      <div class="level">
        <span>Lv.</span>
        <p>70</p>
      </div>
      <span class="name">小鱼yuzifu</span>
    </div>
  </div>
</template>

<style scoped>
.level-box {
  width: 260px;
  height: 100px;
  background: linear-gradient(120deg, #003153, #2265bb 15%, #003153 70%, #003153);
  position: relative;
  left: 0;
  top: 40px;
  border-radius: 0 8px 8px 0;
  filter: drop-shadow(0 3px 3px black);
  display: flex;
}

.level-box:before {
  content: '';
  position: absolute;
  top: 0;
  right: -20px;
  bottom: 0;
  width: 60px;
  border-radius: 8px;
  background: #003153;
  transform: skewX(-10deg);
  z-index: -1;
}

.level-box .container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: auto 0 auto 26px;
}

.level {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.container .level p {
  color: #fff;
  font-size: 42px;
  font-weight: 600;
  font-style: oblique;
}

.container .name {
  color: #fff;
  font-size: 24px;
  align-self: flex-start;
  margin: 3px 20px;
  font-weight: 600;
}

.container .level span {
  color: #ffe433;
  font-size: 26px;
  font-weight: 600;
  font-style: oblique;
}
</style>
