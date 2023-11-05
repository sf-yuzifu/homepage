<script setup></script>

<template>
  <div class="toolbox-box">
    <!--    <div class="toolbox"></div>-->
    <!--    <div class="toolbox"></div>-->
    <!--    <div class="toolbox"></div>-->
    <a class="about toolbox">
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
  height: 60px;
  background: #fffd;
  color: #003153;
  margin: 0 20px;
  transform: skew(-10deg);
  border-radius: 6px;
  filter: drop-shadow(0px 0px 3px #0003);
  transition:
    background-color 0.3s,
    transform 0.1s;
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
</style>
