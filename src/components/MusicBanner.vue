<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick, type Ref } from 'vue'
import { Howl } from 'howler'
import { useConfig } from '@/composables/useConfig'
import { useSettings } from '@/composables/useSettings'

interface SongInfo {
  name: string
  artist: string
  url: string
  cover?: string
}

// 使用i18n配置系统
const { configs } = useConfig()
const { effectiveBgmVolume } = useSettings()

const ifICP = computed(() => configs.value?.ICP || '')
const songlist = computed(() => configs.value?.banner?.musicID || [])
const translate = computed(() => configs.value?.translate)

/** API 最终失败后隐藏整个 Banner，不留空白占位 */
const visible = ref(true)
const songName = ref('')
const songArtist = ref('')
const songCover = ref('')
const coverFailed = ref(false)
const playing = ref(false)
const duration = ref(0)
const progress = ref(0)
/** 拖动进度中：进度条跟随拖动位置预览，松手才真正 seek（播放不中断） */
const seeking = ref(false)
/** 窄屏（≤768px）圆盘模式；显示 ICP 备案号时恒为圆盘（旧 APlayer mini 模式的等价行为） */
const isNarrow = ref(false)
const isMini = computed(() => !!ifICP.value || isNarrow.value)

const barRef = ref<HTMLDivElement | null>(null)

let currentHowl: Howl | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let progressRafId: number | null = null
let retryCount = 0
const MAX_RETRY_COUNT = 3
/** play() 被浏览器自动播放策略拦下的待播标记（页面无手势直达大厅时触发）：不换歌，等首次点击补播 */
let autoplayBlocked = false

const percent = computed(() =>
  duration.value > 0 ? Math.min(100, (progress.value / duration.value) * 100) : 0
)

// BGM 关闭时暂停而不是零音量继续播，避免白耗流量；恢复时接着当前曲目播
watch(effectiveBgmVolume, (volume, previous) => {
  const howl = currentHowl
  if (!howl) return
  howl.volume(volume)
  if (volume <= 0) {
    howl.pause()
  } else if (previous <= 0) {
    howl.play()
  }
})

const stopProgressLoop = () => {
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId)
    progressRafId = null
  }
}

/** 播放期间用 rAF 同步进度（howler 本身没有进度事件） */
const startProgressLoop = () => {
  stopProgressLoop()
  const tick = () => {
    const howl = currentHowl
    if (howl) {
      if (!seeking.value) {
        const pos = howl.seek()
        if (typeof pos === 'number') progress.value = pos
      }
      const d = howl.duration()
      if (d > 0 && d !== duration.value) duration.value = d
    }
    progressRafId = requestAnimationFrame(tick)
  }
  progressRafId = requestAnimationFrame(tick)
}

/** 释放当前曲目（切歌/卸载/隐藏前调用），避免多个 Howl 同时挂载 */
const releaseCurrent = () => {
  if (!currentHowl) return
  currentHowl.stop()
  currentHowl.unload()
  currentHowl = null
}

const hideBanner = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  stopProgressLoop()
  releaseCurrent()
  visible.value = false
}

/** 单曲获取/装载失败后的统一降级：连续失败重试 3 次，仍不行则隐藏整个 Banner */
const retryOrHide = () => {
  retryCount++
  if (retryCount < MAX_RETRY_COUNT) {
    retryTimer = setTimeout(() => void addRandomSong(), 1000)
  } else {
    hideBanner()
  }
}

/** 装载并播放一首歌曲（静音时只装载不播放，恢复音量后续播） */
const playSong = (song: SongInfo) => {
  releaseCurrent()
  songName.value = song.name
  songArtist.value = song.artist
  songCover.value = song.cover || ''
  coverFailed.value = false
  progress.value = 0
  duration.value = 0

  const howl = new Howl({
    src: [song.url],
    // meting 的 url 是无扩展名的 302 跳转（?server=netease&type=url&id=...），
    // howler 按 URL 后缀嗅探格式会得到 null 并直接 loaderror——必须显式声明格式
    format: ['mp3'],
    // BGM 是长音频：走 HTML5 Audio 流式播放，不整段下载解码成 PCM
    html5: true,
    volume: effectiveBgmVolume.value,
    onplay: () => {
      // 所有回调都过这道理代闸：已被顶替/释放的旧 Howl 的迟到事件一律忽略
      if (howl !== currentHowl) return
      autoplayBlocked = false
      // 真正开始播放才算成功：归零重试计数（fetch 成功不算数——装载失败的曲目也要能重试到位）
      retryCount = 0
      playing.value = true
      startProgressLoop()
    },
    onpause: () => {
      if (howl !== currentHowl) return
      playing.value = false
      stopProgressLoop()
    },
    onstop: () => {
      if (howl !== currentHowl) return
      playing.value = false
      stopProgressLoop()
    },
    // 播完自动随机下一首（等价旧 APlayer 的 loop:'none' + order:'random'）
    onend: () => {
      if (howl !== currentHowl) return
      playing.value = false
      stopProgressLoop()
      void addRandomSong()
    },
    onloaderror: () => {
      if (howl !== currentHowl) return
      retryOrHide()
    },
    onplayerror: () => {
      if (howl !== currentHowl) return
      // play() 被拒多为自动播放策略（如 introMode:'once' 已看时无手势直达大厅），
      // 不是曲目损坏——绝不能走重试换歌，只标记待播，等用户首次点页面时补播
      autoplayBlocked = true
      playing.value = false
      stopProgressLoop()
    }
  })
  currentHowl = howl
  if (effectiveBgmVolume.value > 0) howl.play()
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

/**
 * 解析封面直链：meting 的 pic 是 302 中转且固定跳 90x90（param=90y90），海报满铺太糊——
 * 用 HEAD 跟出最终 CDN 地址（两端都带 CORS），再把尺寸参数改成 300x300；
 * 解析失败退回原地址（90x90 也能看）
 */
const resolveCover = async (picUrl: string): Promise<string | undefined> => {
  if (!picUrl) return undefined
  try {
    const response = await fetch(picUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    })
    const finalUrl = response.url || picUrl
    return finalUrl.replace(/([?&]param=)\d+y\d+/, '$1300y300')
  } catch {
    return picUrl
  }
}

// 获取歌曲数据
const fetchSongData = async (songId: number): Promise<SongInfo | null> => {
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
    const t = translate.value
    const song: SongInfo = {
      name:
        readString(data.title) || readString(data.name) || t?.musicUnknownSong || 'Unknown song',
      artist:
        readString(data.author) ||
        readString(data.artist) ||
        t?.musicUnknownArtist ||
        'Unknown artist',
      url: readString(data.url) || '',
      cover: await resolveCover(readString(data.pic) || '')
    }

    // 验证URL字段
    if (!song.url) {
      throw new Error('歌曲URL不存在')
    }

    console.log('歌曲信息:', song)
    return song
  } catch (error) {
    console.error('获取歌曲数据失败:', error)
    return null
  }
}

// 抽签不放回：一袋抽完才重置；列表变化时自动重建
let songBag: number[] = []
let songBagSource: readonly number[] | null = null
let songBagCurrentIndex = -1

function drawRandomIndex(list: readonly number[]): number {
  if (songBagSource !== list) {
    songBag = []
    songBagSource = list
    songBagCurrentIndex = -1
  }
  if (songBag.length === 0) {
    songBag = list.map((_, i) => i)
    if (list.length > 1 && songBagCurrentIndex >= 0) {
      const withoutCurrent = songBag.filter((i) => i !== songBagCurrentIndex)
      if (withoutCurrent.length > 0) {
        songBag = withoutCurrent
      }
    }
  }
  const pick = Math.floor(Math.random() * songBag.length)
  const [index] = songBag.splice(pick, 1)
  songBagCurrentIndex = index
  return index
}

// 随机加载一首歌
const addRandomSong = async () => {
  try {
    // 检查歌曲列表是否有效
    if (!songlist.value || songlist.value.length === 0) {
      console.warn('歌曲列表为空')
      hideBanner()
      return
    }

    // 随机选择一首歌
    const randomIndex = drawRandomIndex(songlist.value)
    const songId = songlist.value[randomIndex]

    if (!songId) {
      throw new Error('无效的歌曲ID')
    }

    console.log(`尝试加载歌曲 ID: ${songId}`)

    // 获取歌曲数据
    const songData = await fetchSongData(songId)

    if (!songData) {
      throw new Error('无法获取歌曲数据')
    }

    playSong(songData)
    console.log('歌曲加载成功:', songData.name)
  } catch (error) {
    console.error('添加歌曲失败:', error)
    retryOrHide()
  }
}

/** 播放/暂停切换 */
const togglePlay = () => {
  autoplayBlocked = false
  const howl = currentHowl
  if (!howl) return
  if (playing.value) {
    howl.pause()
  } else {
    howl.play()
  }
}

/** 手动切下一首（清掉挂起的重试并归零计数，避免累计失败次数误伤） */
const nextSong = () => {
  autoplayBlocked = false
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryCount = 0
  void addRandomSong()
}

/** 自动播放被拦时的补播：用户首次点击页面（任意处）时恢复播放 */
const unlockAutoplay = () => {
  if (!autoplayBlocked) return
  autoplayBlocked = false
  const howl = currentHowl
  if (howl && effectiveBgmVolume.value > 0) howl.play()
}

// ---- 进度条：点击跳转 + 按住拖动（Pointer Events + setPointerCapture，触屏同路径）----

const ratioFromEvent = (e: PointerEvent): number => {
  const bar = barRef.value
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
}

const onBarPointerDown = (e: PointerEvent) => {
  if (!currentHowl || duration.value <= 0) return
  e.preventDefault()
  seeking.value = true
  progress.value = ratioFromEvent(e) * duration.value
  barRef.value?.setPointerCapture(e.pointerId)
}

const onBarPointerMove = (e: PointerEvent) => {
  if (!seeking.value) return
  progress.value = ratioFromEvent(e) * duration.value
}

const onBarPointerUp = (e: PointerEvent) => {
  if (!seeking.value) return
  seeking.value = false
  const ratio = ratioFromEvent(e)
  progress.value = ratio * duration.value
  currentHowl?.seek(progress.value)
}

/** 卡片整体点击仅在 mini 圆盘模式下生效（整个圆盘就是播放/暂停大按钮） */
const onCardClick = () => {
  if (isMini.value) togglePlay()
}

// ---- 歌名/艺术家跑马灯：文本超宽时启用，双副本平移实现无缝循环 ----

const nameEl = ref<HTMLElement | null>(null)
const artistEl = ref<HTMLElement | null>(null)
const nameMarquee = ref(false)
const artistMarquee = ref(false)
const nameMarqueeDuration = ref('0s')
const artistMarqueeDuration = ref('0s')
/** 跑马灯两份副本之间的间隔（须与 CSS 中 .music-banner__gap 的 width 一致） */
const MARQUEE_GAP_PX = 48
/** 跑马灯滚动速度（px/s），时长按文本长度折算保持恒速 */
const MARQUEE_SPEED = 45

/** 测量并更新跑马灯状态；元素隐藏（L2D 全屏 / mini 圆盘）时跳过，保留原状态 */
const checkMarquee = () => {
  const pairs: Array<[HTMLElement | null, Ref<boolean>, Ref<string>]> = [
    [nameEl.value, nameMarquee, nameMarqueeDuration],
    [artistEl.value, artistMarquee, artistMarqueeDuration]
  ]
  for (const [el, active, durationRef] of pairs) {
    if (!el || el.clientWidth === 0) continue
    // 量第一份文本副本的原始宽度（gap 是独立元素，不计入内）
    const textWidth =
      (el.querySelector('.music-banner__text') as HTMLElement | null)?.scrollWidth ?? 0
    active.value = textWidth > el.clientWidth + 1
    if (active.value) {
      durationRef.value = `${((textWidth + MARQUEE_GAP_PX) / MARQUEE_SPEED).toFixed(2)}s`
    }
  }
}

watch([songName, songArtist], () => {
  void nextTick(checkMarquee)
})

// 初始化
onMounted(() => {
  // 初始加载一首歌
  void addRandomSong()
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  window.addEventListener('pointerdown', unlockAutoplay)
  // 字体子集按需异步加载，字体到位后文本宽度会变，需要重新测量
  document.fonts.addEventListener('loadingdone', checkMarquee)
})

const checkScreenSize = () => {
  isNarrow.value = window.innerWidth <= 768
  checkMarquee()
}

// 组件卸载时销毁播放器
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('pointerdown', unlockAutoplay)
  document.fonts.removeEventListener('loadingdone', checkMarquee)
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  stopProgressLoop()
  releaseCurrent()
})
</script>

<template>
  <div
    class="music-banner"
    :class="{
      'is-mini': isMini,
      'is-playing': playing,
      'is-hidden': !visible,
      'css-cursor-hover-enabled': isMini
    }"
    @click="onCardClick"
  >
    <!-- 封面满铺（游戏大厅左下 EVENT 海报风） -->
    <img
      v-if="songCover && !coverFailed"
      class="music-banner__cover"
      :src="songCover"
      alt=""
      draggable="false"
      @error="coverFailed = true"
    />
    <!-- 底部暗渐变条：保证白字在任意封面上的可读性（无封面时退化为白卡+暗条） -->
    <div class="music-banner__mask"></div>
    <!-- 红色斜体角标（仿游戏 EVENT! 标签） -->
    <div class="music-banner__tag">BGM♪</div>

    <div class="music-banner__info">
      <p ref="nameEl" class="music-banner__name">
        <span
          class="music-banner__marquee"
          :class="{ 'is-active': nameMarquee }"
          :style="{ '--marquee-duration': nameMarqueeDuration }"
        >
          <span class="music-banner__text">{{ songName }}</span>
          <template v-if="nameMarquee">
            <span class="music-banner__gap" aria-hidden="true"></span>
            <span class="music-banner__text" aria-hidden="true">{{ songName }}</span>
            <span class="music-banner__gap" aria-hidden="true"></span>
          </template>
        </span>
      </p>
      <p ref="artistEl" class="music-banner__artist">
        <span
          class="music-banner__marquee"
          :class="{ 'is-active': artistMarquee }"
          :style="{ '--marquee-duration': artistMarqueeDuration }"
        >
          <span class="music-banner__text">{{ songArtist }}</span>
          <template v-if="artistMarquee">
            <span class="music-banner__gap" aria-hidden="true"></span>
            <span class="music-banner__text" aria-hidden="true">{{ songArtist }}</span>
            <span class="music-banner__gap" aria-hidden="true"></span>
          </template>
        </span>
      </p>
    </div>

    <div class="music-banner__actions" @click.stop>
      <button
        type="button"
        class="music-banner__btn css-cursor-hover-enabled"
        :aria-label="playing ? translate?.musicPause : translate?.musicPlay"
        @click="togglePlay"
      >
        <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <button
        type="button"
        class="music-banner__btn css-cursor-hover-enabled"
        :aria-label="translate?.musicNext"
        @click="nextSong"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>

    <!-- 进度条贴卡片底边通栏：点击跳转 + 按住拖动 -->
    <div
      ref="barRef"
      class="music-banner__bar css-cursor-hover-enabled"
      role="slider"
      :aria-label="translate?.musicProgress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(percent)"
      @pointerdown="onBarPointerDown"
      @pointermove="onBarPointerMove"
      @pointerup="onBarPointerUp"
      @pointercancel="onBarPointerUp"
    >
      <div class="music-banner__bar-fill" :style="{ width: percent + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.music-banner {
  position: absolute;
  left: calc(clamp(50px, 3.125vw, 100vw) + var(--safe-left));
  bottom: calc(clamp(180px, 11.25vw, 100vw) + var(--safe-bottom));
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  border-radius: clamp(8px, 0.5vw, 100vw);
  /* 不用 overflow:hidden（角标要探出上边缘）；圆角裁剪由封面图 border-radius: inherit 承担 */
  /* 无封面（或封面加载失败）时的兜底：与弹窗同一底纹语言 */
  background: #f0f0f0 var(--deco1) no-repeat right;
  background-size: contain;
  opacity: 0.9;
  z-index: 2;
  filter: drop-shadow(0 clamp(3px, 0.1875vw, 100vw) clamp(3px, 0.1875vw, 100vw) #0003);
  transition: transform 0.3s;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

.music-banner:active {
  transform: scale(0.95);
}

.music-banner.is-hidden {
  display: none !important;
}

/* 封面满铺（圆角随卡片——普通模式圆角、mini 圆盘模式自动变圆形） */
.music-banner__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* 底部暗渐变条（无白色面板，内容直接压图——游戏海报的排版方式） */
.music-banner__mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  background: linear-gradient(
    180deg,
    rgba(0, 20, 40, 0) 0%,
    rgba(0, 20, 40, 0.28) 45%,
    rgba(0, 20, 40, 0.62) 100%
  );
  /* 底角随卡片圆角（卡片已不再 overflow:hidden） */
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

/* 红色描边立体字角标（仿游戏 EVENT! 标签：白字红描边，一半探出卡片上边缘） */
.music-banner__tag {
  position: absolute;
  top: 0;
  left: clamp(16px, 1vw, 100vw);
  transform: translateY(-50%) skew(-10deg);
  color: #fff;
  /* 描边画在文字填充下层，保持白色字芯完整 */
  -webkit-text-stroke: clamp(2px, 0.15vw, 100vw) #e72264;
  paint-order: stroke fill;
  font-weight: bold;
  font-size: clamp(20px, 1.25vw, 100vw);
  letter-spacing: 0.5px;
  line-height: 1.2;
  /* 底部一层深色实体偏移 = 立体厚度，再加一层柔和投影 */
  filter: drop-shadow(0 clamp(1.5px, 0.1vw, 100vw) 0 #b81a4e)
    drop-shadow(0 clamp(2px, 0.125vw, 100vw) clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.35));
}

.music-banner__info {
  position: absolute;
  left: clamp(12px, 0.75vw, 100vw);
  right: clamp(12px, 0.75vw, 100vw);
  /* 给底边通栏进度条留位 */
  bottom: clamp(16px, 1vw, 100vw);
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.125vw, 100vw);
}

.music-banner__name {
  color: #fff;
  font-weight: bold;
  font-size: clamp(20px, 1.25vw, 100vw);
  text-shadow: 0 1px clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.55);
  width: 100%;
  /* 行高给足字形空间（overflow:hidden 裁纵向边缘的修复），截断由跑马灯接管 */
  line-height: 1.3;
  overflow: hidden;
}

.music-banner__artist {
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(15px, 0.9375vw, 100vw);
  text-shadow: 0 1px clamp(2px, 0.125vw, 100vw) rgba(0, 0, 0, 0.5);
  width: 100%;
  line-height: 1.2;
  overflow: hidden;
}

/* 跑马灯：文本超宽时渲染双副本（[文本][gap][文本][gap]），
   inner 平移 -50% 恰好走完一份副本，首尾相接无缝循环；
   首尾各留 12% 时长停顿，便于阅读开头 */
.music-banner__marquee {
  display: inline-flex;
  white-space: nowrap;
}

.music-banner__marquee.is-active {
  animation: music-banner-marquee var(--marquee-duration, 8s) linear infinite;
}

/* 悬停时暂停滚动，方便看清全文 */
.music-banner__marquee.is-active:hover {
  animation-play-state: paused;
}

.music-banner__text {
  flex-shrink: 0;
}

/* 两份副本之间的间隔（宽度须与脚本里的 MARQUEE_GAP_PX 一致） */
.music-banner__gap {
  flex-shrink: 0;
  width: 48px;
}

@keyframes music-banner-marquee {
  0%,
  12% {
    transform: translateX(0);
  }
  88%,
  100% {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-banner__marquee.is-active {
    animation: none;
  }
}

/* 播放/暂停与下一首：半透黑底白图标圆钮（压在海报上） */
.music-banner__actions {
  position: absolute;
  top: clamp(10px, 0.625vw, 100vw);
  right: clamp(10px, 0.625vw, 100vw);
  display: flex;
  gap: clamp(8px, 0.5vw, 100vw);
}

.music-banner__btn {
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  width: clamp(30px, 1.875vw, 100vw);
  height: clamp(30px, 1.875vw, 100vw);
  border-radius: 50%;
  background: rgba(0, 30, 60, 0.45);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition:
    background-color 0.3s,
    transform 0.1s;
}

.music-banner__btn:hover {
  background: rgba(0, 30, 60, 0.65);
}

.music-banner__btn:active {
  transform: scale(0.9);
}

.music-banner__btn svg {
  width: 55%;
  height: 55%;
}

/* 桌面端：按钮 hover 卡片才显现（海报本体无按钮的游戏感）；
   键盘聚焦到按钮时同样显现（focus-within 兜底可发现性）；
   触屏（hover: none）常驻显示 */
@media (hover: hover) and (pointer: fine) {
  .music-banner__actions {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.2s,
      visibility 0.2s;
  }

  .music-banner:hover .music-banner__actions,
  .music-banner:focus-within .music-banner__actions {
    opacity: 1;
    visibility: visible;
  }
}

/* 进度条：卡片底边（左右留出与文字区一致的间距）；上下 padding 撑大点击热区；
   touch-action:none 让拖动不被浏览器滚动抢走 */
.music-banner__bar {
  position: absolute;
  left: clamp(6px, 0.375vw, 100vw);
  right: clamp(6px, 0.375vw, 100vw);
  bottom: 0;
  padding: clamp(6px, 0.375vw, 100vw) 0;
  touch-action: none;
}

.music-banner__bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: clamp(4px, 0.25vw, 100vw);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
}

.music-banner__bar-fill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: clamp(4px, 0.25vw, 100vw);
  border-radius: 999px;
  background: #89d5fd;
}

/* mini 圆盘模式（显示 ICP 备案号时 / 窄屏）：整个圆盘即播放按钮，播放中缓慢旋转 */
.music-banner.is-mini {
  left: unset;
  bottom: unset;
  right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
  top: calc(clamp(192px, 12vw, 100vw) + var(--safe-top));
  width: clamp(120px, 7.5vw, 100vw);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid #fff;
}

.music-banner.is-mini .music-banner__mask,
.music-banner.is-mini .music-banner__tag,
.music-banner.is-mini .music-banner__actions,
.music-banner.is-mini .music-banner__bar {
  display: none;
}

/* 圆盘下方的丝带标题条（仿游戏活动挂件：比圆盘略宽、底部与圆盘少量重叠） */
.music-banner.is-mini .music-banner__info {
  top: calc(100% - clamp(12px, 0.75vw, 100vw));
  left: 50%;
  right: auto;
  bottom: auto;
  transform: translateX(-50%);
  width: clamp(120px, 7.5vw, 100vw);
  padding: clamp(4px, 0.25vw, 100vw) clamp(10px, 0.625vw, 100vw);
  background: rgba(0, 30, 60, 0.75);
  backdrop-filter: blur(4px);
  border-radius: clamp(6px, 0.375vw, 100vw);
  text-align: center;
  gap: 0;
  filter: drop-shadow(0 clamp(2px, 0.125vw, 100vw) clamp(3px, 0.1875vw, 100vw) #0004);
}

.music-banner.is-mini .music-banner__name {
  font-size: clamp(16px, 1vw, 100vw);
  text-align: center;
}

/* mini 丝带只显示歌名（艺术家隐藏，把空间留给歌名跑马灯） */
.music-banner.is-mini .music-banner__artist {
  font-size: clamp(12px, 0.75vw, 100vw);
  text-align: center;
}

.music-banner.is-mini .music-banner__cover {
  animation: music-banner-spin 12s linear infinite;
  animation-play-state: paused;
}

.music-banner.is-mini.is-playing .music-banner__cover {
  animation-play-state: running;
}

@keyframes music-banner-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-banner.is-mini .music-banner__cover {
    animation: none;
  }
}

@media screen and (max-width: 375px) {
  .music-banner.is-mini {
    width: 96px;
  }
}
</style>
