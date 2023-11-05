<script setup></script>

<template>
  <div class="footer"></div>
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
}

.footer::after {
  content: '';
  width: calc(100% - 360px);
  height: 60px;
  background: #ffffffdd;
  position: absolute;
  margin: auto;
  transform: skew(50deg);
  border-radius: 4px;
}
</style>
