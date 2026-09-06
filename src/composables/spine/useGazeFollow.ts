import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { GazeConfig } from '@/types/config'
import type { SpineInteractionContext } from './types'
import { DragBoneController } from './useDragBone'
import { GAZE_BONE_CANDIDATES } from './boneDetect'
import { TRACK_M, TRACK_BLINK, hasAnimation } from './useSpineTracks'

// 官方 EyeIK 参数（AssetStudio 解包 CH0334 prefab 的 SpineDragIK，单位已换算为骨架单位）：
// 目标骨 Touch_Eye（Head_Rot 子骨），父级局部空间非对称钳制范围
const GAZE_MIN_OFFSET_X = -48.1
const GAZE_MAX_OFFSET_X = 79.0
const GAZE_MIN_OFFSET_Y = -57.2
const GAZE_MAX_OFFSET_Y = 98.3
const GAZE_SMOOTH_TIME = 0.15

/**
 * 视线跟随（原游戏 prefab 中的 EyeIK）：
 * 按住并拖动时，Touch_Eye 目标骨跟随指针位移（局部空间非对称钳制 + SmoothDamp），
 * 通过骨架自带的 IK/形变约束带动眼球/头部看向触点方向；松开后平滑回正。
 * 跟随期间循环播放 Look_01_M（看向表情），松开播放 LookEnd_01_M 后回 Dummy——
 * 与官方 SpineClip 配置一致（Look_01_M Loop=1 / LookEnd_01_M Loop=0 OutroMix=0.3）。
 *
 * 仅「按住拖动」触发（快速点按走对话）；对话/摸头/捏脸期间禁用（状态机互斥）。
 * 骨名按候选名单自动探测，也可在 _config.yaml 的 interactions.gaze 中显式指定：
 *   gaze: false                                  # 禁用
 *   gaze: { bone: Touch_Eye, range: 60, smoothTime: 0.15 }   # range 为对称简写，精细控制用 minX/maxX/minY/maxY
 *
 * @param {object} ctx 共享上下文（见 Background.vue）
 */
export function useGazeFollow(ctx: SpineInteractionContext) {
  let controller: DragBoneController | null = null

  const config = (): GazeConfig | null => {
    const cfg = ctx.getLobby()?.interactions?.gaze
    if (cfg === false) return null // 显式禁用
    return cfg && typeof cfg === 'object' ? cfg : {}
  }

  const attach = (spine: Spine) => {
    detach()
    const cfg = config()
    if (!cfg) return
    controller = new DragBoneController({
      boneName: cfg.bone ?? null,
      boneCandidates: GAZE_BONE_CANDIDATES,
      // 配置可用 range 对称简写，或 minX/maxX/minY/maxY 精细覆盖；缺省用官方数值
      rangeX: cfg.range,
      rangeY: cfg.range,
      minOffsetX: cfg.minX ?? GAZE_MIN_OFFSET_X,
      maxOffsetX: cfg.maxX ?? GAZE_MAX_OFFSET_X,
      minOffsetY: cfg.minY ?? GAZE_MIN_OFFSET_Y,
      maxOffsetY: cfg.maxY ?? GAZE_MAX_OFFSET_Y,
      smoothTime: cfg.smoothTime ?? GAZE_SMOOTH_TIME,
      releaseSmoothRatio: 0.3
    })
    if (!controller.attach(spine)) controller = null
  }

  const detach = () => {
    controller?.detach()
    controller = null
  }

  const available = () => !!controller

  const canStart = () =>
    !!controller &&
    ctx.isIdleMode() &&
    !ctx.flags.talking.value &&
    !ctx.flags.ifPetting.value &&
    !(ctx.getBoneDrag()?.isActive() ?? false)

  /** 开始跟随（拖拽阈值判定通过后由状态机调用）：骨骼跟随 + Look 表情动画 */
  const start = (worldX: number, worldY: number) => {
    if (!canStart()) return false
    const spine = ctx.getSpine()
    if (!spine?.state) return false
    // 正在播放的眨眼动画快速淡出——注视期间不应闭眼（Eye_Close_01 与 Look 表情在眼睑骨骼上冲突）
    if (
      hasAnimation(spine, 'Eye_Close_01') &&
      spine.state.getCurrent(TRACK_BLINK)?.animation?.name === 'Eye_Close_01'
    ) {
      spine.state.setEmptyAnimation(TRACK_BLINK, 0.1)
      if (hasAnimation(spine, 'Dummy')) {
        spine.state.addAnimation(TRACK_BLINK, 'Dummy', true, 0).mixDuration = 0.1
      }
    }
    // Look_01_M 播一次并保持结束帧（注视姿态）。
    // 不能循环：kei 的 Look_01_M 是 0.37s 的眼睑/眼球过渡动画，循环会每 0.37s 重放
    // 一次——视觉上就是"疯狂眨眼"。aris 的是 0s 约束设置，播一次与循环等价。
    // （非循环动画播完后 spine 会保持其结束姿态，直到 LookEnd 接管）
    if (hasAnimation(spine, 'Look_01_M')) {
      spine.state.setAnimation(TRACK_M, 'Look_01_M', false)
    }
    return controller!.press(worldX, worldY)
  }

  const move = (worldX: number, worldY: number) => controller?.move(worldX, worldY)

  /** 松开：骨骼回弹 + LookEnd_01_M 收尾回 Dummy */
  const end = () => {
    const spine = ctx.getSpine()
    controller?.release()
    if (spine?.state && hasAnimation(spine, 'LookEnd_01_M')) {
      spine.state.setAnimation(TRACK_M, 'LookEnd_01_M', false).mixDuration = 0.3
      if (hasAnimation(spine, 'Dummy')) {
        spine.state.addAnimation(TRACK_M, 'Dummy', true).mixDuration = 0.3
      }
    }
  }

  const update = (dt: number) => controller?.update(dt)
  const isActive = () => controller?.isActive() ?? false
  const isEngaged = () => controller?.isEngaged() ?? false
  const boneName = () => controller?.boundBoneName ?? null

  return {
    attach,
    detach,
    available,
    canStart,
    start,
    move,
    end,
    update,
    isActive,
    isEngaged,
    boneName
  }
}
