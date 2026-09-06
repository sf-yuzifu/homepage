import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { TrackEntry } from '@esotericsoftware/spine-core'

// 轨道约定（对齐原游戏，各轨编号已经官方 SpineClip 资产的 Track 字段证实）：
//   0 = 主轨道（Start_Idle_01 入场 → Idle_01 待机）
//   1 = 交互 M 轨道（Talk_XX_M / Pat / Look / HandFollow 主动画共用）
//   2 = 交互 A 轨道（Talk_XX_A / PatEnd_01_A 等附加表情动画）
//   3 = 眨眼轨道（Eye_Close_01，每 10~15 秒随机播一次，见 useRandomClips）
//   4 = 随机小动作轨道（Idle_01_R，每 60~70 秒随机播一次——不是常驻循环！）
// 交互轨道由对话/摸头/视线/拖拽共用，通过交互状态机互斥（与原游戏一致）。
// Dummy 是骨架自带的空动画，用作占位/清轨（等价原游戏的 SetEmptyAnimation + Dummy 习惯）。
export const TRACK_IDLE = 0
export const TRACK_M = 1
export const TRACK_A = 2
export const TRACK_BLINK = 3
export const TRACK_IDLE_RANDOM = 4

/** 查找动画是否存在（兜底骨架差异，如 hina 无 Idle_01_R、各角色 Pat/Talk 数量不同） */
export function hasAnimation(spine: Spine | null | undefined, name: string): boolean {
  return !!spine?.state?.data?.skeletonData?.findAnimation(name)
}

/**
 * 初始化辅助轨道（角色加载/切换后调用）：全部交互/随机轨道以 Dummy 占位。
 * 注意：Idle_01_R 不在此循环播放——它是随机小动作（官方 SpineClip 配置 PlayMode=MaskedRandomTiming、
 * RandomDelay 60~70s），由 useRandomClips 定时触发；眨眼 Eye_Close_01 同理（10~15s）。
 */
export function initTracks(spine: Spine | null | undefined): void {
  if (!spine?.state || !hasAnimation(spine, 'Dummy')) return
  spine.state.setAnimation(TRACK_M, 'Dummy', true)
  spine.state.setAnimation(TRACK_A, 'Dummy', true)
  spine.state.setAnimation(TRACK_BLINK, 'Dummy', true)
  spine.state.setAnimation(TRACK_IDLE_RANDOM, 'Dummy', true)
}

/**
 * 在交互轨道上播放 M/A 动画对（不存在的半边自动跳过，兼容骨架差异）
 * @param {object} opts { loop, mix } loop 是否循环；mix 淡入时长
 * @returns M 轨 entry（供 complete 监听），M 动画缺失时为 null
 */
export function setInteractPair(
  spine: Spine | null | undefined,
  mName: string | null | undefined,
  aName: string | null | undefined,
  { loop = false, mix = 0.3 }: { loop?: boolean; mix?: number } = {}
): TrackEntry | null {
  if (!spine?.state) return null
  let mEntry: TrackEntry | null = null
  if (mName && hasAnimation(spine, mName)) {
    mEntry = spine.state.setAnimation(TRACK_M, mName, loop)
    mEntry.mixDuration = mix
  }
  if (aName && hasAnimation(spine, aName)) {
    spine.state.setAnimation(TRACK_A, aName, loop).mixDuration = mix
  }
  return mEntry
}

/** 交互轨道排队播完后回到 Dummy 占位（保持当前动画不被打断，末尾追加） */
export function queueDummyPair(spine: Spine | null | undefined, mix = 0.3): void {
  if (!spine?.state || !hasAnimation(spine, 'Dummy')) return
  spine.state.addAnimation(TRACK_M, 'Dummy', true).mixDuration = mix
  spine.state.addAnimation(TRACK_A, 'Dummy', true).mixDuration = mix
}

/** 立即清空交互轨道回 Dummy（打断用） */
export function clearInteractPair(spine: Spine | null | undefined, mix = 0.3): void {
  if (!spine?.state || !hasAnimation(spine, 'Dummy')) return
  spine.state.setAnimation(TRACK_M, 'Dummy', true).mixDuration = mix
  spine.state.setAnimation(TRACK_A, 'Dummy', true).mixDuration = mix
}
