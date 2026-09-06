/** _config.yaml + locales 合并后的站点配置类型 */

export type LocaleCode = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP'

export interface ManifestIcon {
  src: string
  sizes: string
  purpose?: string
}

export interface ManifestScreenshot {
  src: string
  sizes: string
  type?: string
  label?: string
  platform?: string
  form_factor?: 'narrow' | 'wide'
}

export interface ManifestConfig {
  name: string
  short_name: string
  description: string
  theme_color: string
  start_url: string
  id: string
  /** 未配置时构建期默认 standalone */
  display?: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser'
  /** 未配置时构建期默认引用 og-images 生成的 1280×720 截图 */
  screenshots?: ManifestScreenshot[]
  icons: ManifestIcon[]
}

export interface DockItem {
  name: string
  href?: string
  imgSrc?: string
  iconfont?: string
}

export interface ContactItem {
  name: string
  href?: string
  imgSrc?: string
  iconfont?: string
}

export interface TaskConfig {
  name: string
  href?: string
}

export interface BannerConfig {
  musicID: number[]
}

export interface ICPConfig {
  title: string
}

export interface DialogueDisplay {
  /** auto：跟嘴/脸骨骼；manual：用 x/y/position（兼容旧配置） */
  mode?: 'auto' | 'manual'
  /** 指定锚点骨骼名，覆盖自动探测 */
  bone?: string
  /** auto 模式像素微调（默认 y: -32 略抬高） */
  offsetX?: number
  offsetY?: number
  /** auto 默认按嘴部屏幕位置选边；manual 用 position 或 side */
  side?: 'auto' | 'left' | 'right'
  /** manual：相对视口中心的偏移，支持分数表达式 */
  x?: string | number
  y?: string | number
  /** manual：气泡在锚点左/右（与 side 等价，保留兼容） */
  position?: 'left' | 'right' | string
}

/** 视线跟随；false 禁用 */
export interface GazeConfig {
  bone?: string
  /** 对称范围简写（骨架单位） */
  range?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  smoothTime?: number
}

/** 摸头；false 禁用 */
export interface PatConfig {
  bone?: string
  range?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  smoothTime?: number
}

/** 捏脸/特殊骨拖拽单项配置 */
export interface DragBoneConfig {
  bone: string
  radius?: number
  range?: number
  smoothTime?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  /** 命中判定锚点骨名（面部家族骨常用） */
  anchor?: string
  /** HandFollow 等带动画链的拖拽 */
  clips?: {
    start: string
    chain: string
    end: string
  }
}

export interface InteractionsConfig {
  gaze?: GazeConfig | false
  pat?: PatConfig | false
  /** false 禁用，数组覆盖自动探测 */
  dragBones?: DragBoneConfig[] | false
}

export interface MemorialLobby {
  name: string
  path: string
  skel: string
  atlas: string
  /** 语音 key → 当前语言文案 */
  voice?: Record<string, string>
  offset?: number
  dialogueDisplay?: DialogueDisplay
  interactions?: InteractionsConfig
}

export interface BioStudent {
  name: string
  path: string
  skel: string
  atlas: string
}

export interface BioBtn {
  name: string
  path: string
}

export interface BioConfig {
  student?: BioStudent[]
  btn?: BioBtn[]
  /** @deprecated 旧键名 `bth`，读取时回退到 {@link BioConfig.btn} */
  bth?: BioBtn[]
}

/** 翻译文案；已知键为可选 string，另支持任意扩展键。简介正文在 bio/{locale}.md */
export interface TranslateConfig {
  about?: string
  info?: string
  ifSkip?: string
  skip?: string
  update?: string
  loadDegraded?: string
  backToLobby?: string
  l2dExpand?: string
  l2dCollapse?: string
  ok?: string
  cancel?: string
  bio?: string
  bioTitle?: string
  prevPage?: string
  nextPage?: string
  walletApBattery?: string
  walletApRecover?: string
  walletGold?: string
  walletPyroxene?: string
  musicUnknownSong?: string
  musicUnknownArtist?: string
  musicPlay?: string
  musicPause?: string
  musicNext?: string
  musicProgress?: string
  settings?: string
  settingsAudio?: string
  settingsPresentation?: string
  settingsLanguage?: string
  settingsLanguageDesc?: string
  settingsLanguageAuto?: string
  settingsOn?: string
  settingsOff?: string
  settingsVolume?: string
  settingsMute?: string
  settingsVoice?: string
  settingsBgm?: string
  settingsIntro?: string
  settingsIntroDesc?: string
  settingsIntroAlways?: string
  settingsIntroOnce?: string
  settingsClickFx?: string
  settingsClickFxDesc?: string
  settingsLobbyArrowKeys?: string
  settingsLobbyArrowKeysDesc?: string
  settingsReducedMotion?: string
  [key: string]: string | undefined
}

export interface AppConfig {
  title?: string
  description?: string
  favicon?: string
  author?: string
  keywords?: string
  url?: string
  ICP?: string
  gongan?: string
  icp?: ICPConfig
  iconfont?: string
  manifest?: ManifestConfig
  level?: number
  exp?: number
  nextExp?: number
  gold?: number
  pyroxene?: number
  dock?: DockItem[]
  contact?: ContactItem[]
  task?: TaskConfig
  banner?: BannerConfig
  memorialLobbies?: MemorialLobby[]
  bio?: BioConfig
  translate?: TranslateConfig
  /** 社交分享卡片（OG 图）源图，仅构建期 vite 插件使用，运行时忽略 */
  og?: {
    home?: string
    bio?: string
  }
}
