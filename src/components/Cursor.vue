<script setup>
import { ref } from 'vue'

const posX = ref(0)
const posY = ref(0)

document.addEventListener('mousemove', showMousePosition, false)

function showMousePosition(event) {
  posX.value = event.clientX
  posY.value = event.clientY
  document.querySelector('#cursor .inner').style.opacity = 1
}

document.body.onmouseleave = function () {
  document.querySelector('#cursor .inner').style.opacity = 0
}

document.body.onmouseenter = function () {
  document.querySelector('#cursor .inner').style.opacity = 1
}

document.oncontextmenu = function () {
  return false
}

let el = window.document.body
window.document.body.onmouseover = function (event) {
  el = event.target
  if (
    el.tagName === 'A' ||
    el.tagName === 'BUTTON' ||
    el.classList.contains('css-cursor-hover-enabled') ||
    el.parentElement.classList.contains('css-cursor-hover-enabled') ||
    el.parentElement.parentElement.classList.contains('css-cursor-hover-enabled')
  ) {
    document.querySelector('#cursor').classList.add('hover')
  } else {
    document.querySelector('#cursor').classList.remove('hover')
  }
}
</script>

<template>
  <div
    id="cursor"
    class="cursor"
    :style="{
      transform: `translate(${posX}px, ${posY}px)`
    }"
  >
    <div class="inner"></div>
  </div>
</template>

<style>
* {
  cursor: none !important;
}
</style>

<style scoped>
@media (hover: none) {
  #cursor {
    display: none;
  }
}
#cursor {
  pointer-events: none;
  z-index: 9999;
  position: fixed;
  top: 0;
  left: 0;
}

#cursor::after {
  content: '';
  opacity: 0;
  transition: all 0.3s ease;
  background: url(data:image/png;base64,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)
    no-repeat;
  background-size: 100%;
  width: 1.3666666667rem;
  height: 1.4666666667rem;
  display: inline-block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  transform: translate(-50%, -30%);
}

#cursor.hover::after {
  opacity: 1;
}

#cursor .inner {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAA0CAMAAAAkAzG8AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAH4UExURQAAAERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERBKK+kREREREREREREJHTRKK+hKK+hKK+hSH8y9hjxeD5z9KVBOJ9xKK+RaF7TtRZhKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hx81hKK+hKK+hKK+hOJ9hKK+hKK+hOJ+BKK+hWG8RKK+RKK+hOI9ht92BWG8SJzvhWG8ChrqRKK+RKJ+RmA4BaE6xKK+hOI9ReD5zlTbB94yxmA4C1klx56zxOJ+BmA4CJzvxWG7yZtsCRwuBKK+TVafBaF7RSI9Bt92BKJ+RaF7Bp/3SxlmxOI9iRxuCB2xhiB4x94yjRbfx160RSH8hSI9BOJ+Bt+2xmB4ilppR170xKK+heD6UNGSRKK+hSH8hKK+iNyvStnnxWG8RKK+hOJ+BKJ+RKK+iZusRKK+hKK+hKK+hKK+qpmISoAAACndFJOUwAFBicoBAMpAQIlJiQJBx0MFg0KIB8XIw4hCCIbERoSEBMLFR4ZD/4UHBgrAez00z+mLO34uTH8Q4EiA7YQC3LyJvvvo7AqV9bb34gvSXkNzAhPqR3R6egTRI9/vPkE37J8Sbi9vUDngshex0z385OzPeKeMm2PQnLukF++UVj8N7zYf/W0jUXmWWWZazhzzdrthphLefqtJljK/UoWnzHHcc8K7fisJJDomAAAAsBJREFUSMeN1mW/okAUB2BBcEBFQBQLxPZe796u7e7u7u7u7u7u3p2vuUNdQAH3vH5+Z45/z4wGAmbt3b6ue9eGwP/UjjpEVd+4ta2kdkKjNq9vI2lyj2nhwsX+Emd6xizsmedtaTLLyVssC+uLJnm1JbPxYnUbtNfkKR5tca6YT+x2WLhgrntbRq4mwqecFk5f6dYW48psKnirycL6hHEuI8TFZJg4CFtqzrIWG0s3EmHQ12rh/BmtVkQWHHXBs5a0zMCjGUCvi4WjSx1DU+izVaIEOA5da9VUhy0VUQ7gmLuFayba8xUUCdnzHhZ2j7dwiJHzuSC44mXhzGmWzdaqmQg4XffEcPYKR2gE2Odt4fLVztAO+Vi49oQZRAeLQuv3s/DtByOIYicK4qWvhaPfjKWUUBAP/S38qwdRyKMg7rWxv/Ugao1EBHQN+ds/tg0Gz/3tT+3D4fr2DPvbH/bQHvnS778oY3vU0N74yE9fv2CUsT1qaA+86cfPfBynbdvzxEvef/o+KRrWuJ7ghas88mqEiFZ4zrDG9jxzo8PnABHJSYqgz2teuXet8uYlgGiKFdPZEGVeOTWIu83ywv4BQATDOVaUBYw2nzRFDeKxU17rv67KVFLiCwKutx3bntcOeuAwkpFogm0U0wxm0kAoVquq2zNoyZNn1EGjGbbaUSjFSJoKNF25s6a8fXFEGzSZ52XO1lR/rnk1iIEb+nN6p089PpWQRCXO4Lamtu0BXZt6hwYvXwWEdnyjWBNiTmltj1lI5ir5coHLOo433x4tCEOqg0q8jI4P0VTA5cHWroYm0aCdopIWcNJF6t+clIsQhJqomlOtFHOXyKK15NlMNByOZjwHtX6NhAIvVZJJNs8rHoNajTEmrZRFviynBc/jx37AsZjAxeMc005qOETiOI6RIYpq/8+Eomia9oP/AK7EX+nw5yRhAAAAAElFTkSuQmCC);
  box-shadow: initial !important;
  border-radius: initial !important;
  background-size: 100% !important;
  width: 1.4333333333rem !important;
  height: 1.7333333333rem !important;
  display: inline-block !important;
  transition: all 0.3s ease;
  transform: translate(-0.3333333333rem) !important;
  opacity: 0;
}
</style>
