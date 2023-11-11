<script setup></script>

<template>
  <div class="contact-box">
    <div class="contact css-cursor-hover-enabled">
      <icon-tiktok-color />
      <span>抖音</span>
    </div>
    <div class="contact css-cursor-hover-enabled">
      <icon-tiktok-color />
      <span>抖音</span>
    </div>
    <div class="contact css-cursor-hover-enabled">
      <icon-tiktok-color />
      <span>抖音</span>
    </div>
    <div class="contact css-cursor-hover-enabled">
      <icon-tiktok-color />
      <span>抖音</span>
    </div>
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
}

.contact:active {
  transform: scale(0.9);
}
</style>
