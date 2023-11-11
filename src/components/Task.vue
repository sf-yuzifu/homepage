<script setup></script>

<template>
  <div class="task css-cursor-hover-enabled"></div>
</template>

<style scoped>
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
  content: '业务区';
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
</style>
