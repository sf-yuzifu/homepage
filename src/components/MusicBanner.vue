<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import 'aplayer/dist/APlayer.min.css'
import APlayer from 'aplayer'
import type { APlayerAudio } from 'aplayer'
import { useConfig } from '@/composables/useConfig'
import { useSettings } from '@/composables/useSettings'

const aplayerContainer = ref<HTMLDivElement | null>(null)
const ap = ref<APlayer | null>(null)
const songTimes = ref(0)
const retryCount = ref(0)
const MAX_RETRY_COUNT = 3
const songName = ref('')
const isMiniMode = ref(false)
/** API 最终失败后隐藏整个 Banner，不留空白占位 */
const visible = ref(true)
let retryTimer: ReturnType<typeof setTimeout> | null = null

// 使用i18n配置系统
const { configs } = useConfig()
const { effectiveBgmVolume } = useSettings()
const ifICP = computed(() => configs.value?.ICP || '')
const songlist = computed(() => configs.value?.banner?.musicID || [])

// BGM 关闭时暂停而不是零音量继续播，避免白耗流量；恢复时接着当前曲目播
watch(effectiveBgmVolume, (volume, previous) => {
  const player = ap.value
  if (!player) return
  player.volume(volume, true)
  if (volume <= 0) {
    player.pause()
  } else if (previous <= 0) {
    player.play()
  }
})

const checkScreenSize = () => {
  const player = ap.value
  if (!player) return

  if (ifICP.value) {
    player.setMode('mini')
    return
  }

  isMiniMode.value = window.innerWidth <= 768

  if (isMiniMode.value) {
    player.setMode('mini')
  } else {
    player.setMode('normal')
  }
}

// 初始化播放器
onMounted(() => {
  const container = aplayerContainer.value
  if (!container) return

  const player = new APlayer({
    container,
    autoplay: false,
    mini: false,
    order: 'random',
    lrcType: 3,
    listFolded: true,
    loop: 'none',
    audio: []
  })
  ap.value = player
  player.volume(effectiveBgmVolume.value, true)

  // 歌曲结束事件监听
  player.on('ended', addRandomSong)

  // 初始加载一首歌
  addRandomSong()

  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

// 组件卸载时销毁播放器
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (ap.value) {
    ap.value.destroy()
    ap.value = null
  }
})

const hideBanner = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (ap.value) {
    ap.value.destroy()
    ap.value = null
  }
  visible.value = false
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

// 获取歌曲数据
const fetchSongData = async (songId: number): Promise<APlayerAudio | null> => {
  try {
    const response = await fetch(
      `https://api.injahow.cn/meting/?server=netease&type=song&id=${songId}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const json: unknown = await response.json()

    // 检查响应数据结构
    console.log('API响应:', json)

    // Meting API 返回数组，单曲类型取第一项
    const data = Array.isArray(json) ? json[0] : json

    // 验证数据结构
    if (!isRecord(data)) {
      throw new Error('无效的响应数据')
    }

    // 检查必要的字段（歌名 / 艺术家缺失时走 i18n 兜底，默认 en-US 与项目默认语言一致）
    const t = configs.value?.translate
    const songInfo: APlayerAudio = {
      name:
        readString(data.title) || readString(data.name) || t?.musicUnknownSong || 'Unknown song',
      artist:
        readString(data.author) ||
        readString(data.artist) ||
        t?.musicUnknownArtist ||
        'Unknown artist',
      url: readString(data.url) || '',
      cover: readString(data.pic),
      lrc: readString(data.lrc) || ''
    }

    // 验证URL字段
    if (!songInfo.url) {
      throw new Error('歌曲URL不存在')
    }

    songName.value = songInfo.name
    console.log('歌曲信息:', songInfo)

    return songInfo
  } catch (error) {
    console.error('获取歌曲数据失败:', error)
    return null
  }
}

// 添加随机歌曲
const addRandomSong = async () => {
  if (!ap.value) return

  try {
    // 检查歌曲列表是否有效
    if (!songlist.value || songlist.value.length === 0) {
      console.warn('歌曲列表为空')
      hideBanner()
      return
    }

    // 清空当前播放列表
    ap.value.lrc.hide()
    ap.value.list.clear()

    // 随机选择一首歌
    const randomIndex = Math.floor(Math.random() * songlist.value.length)
    const songId = songlist.value[randomIndex]

    if (!songId) {
      throw new Error('无效的歌曲ID')
    }

    console.log(`尝试加载歌曲 ID: ${songId}`)

    // 获取歌曲数据
    const songData = await fetchSongData(songId)
    const player = ap.value
    if (!player) return

    if (songData) {
      songTimes.value++
      retryCount.value = 0
      player.list.add(songData)
      player.lrc.show()
      if (effectiveBgmVolume.value > 0) player.play()
      console.log('歌曲加载成功:', songData.name)
    } else {
      throw new Error('无法获取歌曲数据')
    }
  } catch (error) {
    console.error('添加歌曲失败:', error)

    if (songTimes.value === 0) {
      hideBanner()
      return
    }

    retryCount.value++
    if (retryCount.value < MAX_RETRY_COUNT) {
      retryTimer = setTimeout(() => addRandomSong(), 1000)
    } else {
      hideBanner()
    }
  }
}
</script>

<template>
  <div
    id="aplayer"
    ref="aplayerContainer"
    :class="{ 'aplayer-mini': ifICP, 'is-hidden': !visible }"
  ></div>
</template>

<style scoped>
#aplayer {
  position: absolute;
  left: calc(clamp(50px, 3.125vw, 100vw) + var(--safe-left));
  bottom: calc(clamp(180px, 11.25vw, 100vw) + var(--safe-bottom));
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  opacity: 0.9;
  z-index: 2;
  transition: transform 0.3s;
}

#aplayer.is-hidden {
  display: none !important;
}

#aplayer:active {
  transform: scale(0.95);
}

#aplayer.aplayer-mini {
  right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
  top: calc(clamp(192px, 12vw, 100vw) + var(--safe-top));
  left: unset;
  bottom: unset;
  width: clamp(120px, 7.5vw, 100vw);
  aspect-ratio: 1;
  border-radius: 100%;
  border: 2px white solid;
}

@media screen and (max-width: 768px) {
  #aplayer {
    right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
    top: calc(clamp(192px, 12vw, 100vw) + var(--safe-top));
    left: unset;
    bottom: unset;
    width: clamp(120px, 7.5vw, 100vw);
    aspect-ratio: 1;
    border-radius: 100%;
    border: 2px white solid;
  }
}

@media screen and (max-width: 375px) {
  #aplayer {
    width: 96px;
  }
}
</style>

<style>
.aplayer.aplayer-withlrc .aplayer-pic {
  height: 100%;
  aspect-ratio: 1;
  width: unset;
}

.aplayer .aplayer-body,
.aplayer.aplayer-narrow .aplayer-body,
.aplayer.aplayer-narrow .aplayer-pic {
  height: 100%;
}

.aplayer .aplayer-body {
  background-size: contain;
  background: #f0f0f0 var(--deco1) no-repeat right !important;
}

.aplayer.aplayer-withlrc .aplayer-info {
  margin-left: clamp(103px, 6.4375vw, 100vw);
  height: 100%;
}

.aplayer .aplayer-lrc {
  height: calc(100% - 50px);
}

.aplayer .aplayer-lrc:after,
.aplayer .aplayer-lrc:before {
  background: unset;
}
</style>
