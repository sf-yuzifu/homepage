import type { AnimationStateListener } from '@esotericsoftware/spine-core'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { PatConfig } from '@/types/config'
import type { SpineInteractionContext } from './types'
import { DragBoneController } from './useDragBone'
import { PAT_BONE_CANDIDATES } from './boneDetect'
import { TRACK_M, TRACK_A, hasAnimation, queueDummyPair, clearInteractPair } from './useSpineTracks'

// 官方 HairPatIK 参数（AssetStudio 解包 CH0334 prefab 的 SpineDragIK，单位已换算为骨架单位）：
// 目标骨 Touch_Point（Head_Rot 子骨），父级局部空间非对称钳制范围，平滑时间 0.1s
const PAT_MIN_OFFSET_X = -9.6
const PAT_MAX_OFFSET_X = 13.5
const PAT_MIN_OFFSET_Y = -33.9
const PAT_MAX_OFFSET_Y = 32.6
const PAT_SMOOTH_TIME = 0.1

/**
 * 摸头（原游戏 prefab 中的 HairPatIK）：
 * 长按头部区域触发 Pat 动画链，按住期间 Touch_Point 目标骨跟随手指位移
 * （骨架 IK 约束带动头部自然摆动——不要直接拖 Head_Rot，会整头位移"掉头"），
 * 松开播放 PatEnd 并平滑回正。
 *
 * 动画链与官方 SpineClip 配置一致（PlayNext 链）：
 *   - 有 Pat_02_M（aris/kei）：Pat_01_M 播一次 → 自动接 Pat_02_M 循环
 *   - 无 Pat_02_M（hina）：Pat_01_M + Pat_01_A 持续循环
 *   - 结束：PatEnd_01_M（+ 存在则 PatEnd_01_A）→ 回 Dummy
 *
 * 配置覆盖（_config.yaml interactions.pat）：
 *   pat: false                               # 禁用
 *   pat: { bone: Touch_Point, smoothTime: 0.1 }   # 另支持 range 简写或 minX/maxX/minY/maxY
 *
 * @param {object} ctx 共享上下文（见 Background.vue）
 */
export function useHeadPat(ctx: SpineInteractionContext) {
  let controller: DragBoneController | null = null
  let endListener: AnimationStateListener | null = null
  let available = false
  let holding = false // 手指仍按住（松开→进入 PatEnd 阶段，打断判定用）

  const config = (): PatConfig | null => {
    const cfg = ctx.getLobby()?.interactions?.pat
    if (cfg === false) return null
    return cfg && typeof cfg === 'object' ? cfg : {}
  }

  const attach = (spine: Spine) => {
    detach()
    const cfg = config()
    // 摸头动画存在性检查（无 Pat 动画的角色整体禁用摸头）
    available = !!cfg && (hasAnimation(spine, 'Pat_01_M') || hasAnimation(spine, 'Pat_01_A'))
    if (!available) return
    controller = new DragBoneController({
      boneName: cfg!.bone ?? null,
      boneCandidates: PAT_BONE_CANDIDATES,
      rangeX: cfg!.range,
      rangeY: cfg!.range,
      minOffsetX: cfg!.minX ?? PAT_MIN_OFFSET_X,
      maxOffsetX: cfg!.maxX ?? PAT_MAX_OFFSET_X,
      minOffsetY: cfg!.minY ?? PAT_MIN_OFFSET_Y,
      maxOffsetY: cfg!.maxY ?? PAT_MAX_OFFSET_Y,
      smoothTime: cfg!.smoothTime ?? PAT_SMOOTH_TIME,
      releaseSmoothRatio: 0.3
    })
    if (!controller.attach(spine)) controller = null
  }

  const detach = () => {
    removeEndListener()
    controller?.detach()
    controller = null
    available = false
    holding = false
    ctx.flags.ifPetting.value = false
  }

  const removeEndListener = () => {
    const spine = ctx.getSpine()
    if (endListener && spine?.state) {
      spine.state.listeners = spine.state.listeners.filter((l) => l !== endListener)
    }
    endListener = null
  }

  const canStart = () =>
    available &&
    ctx.isIdleMode() &&
    ctx.isReady() &&
    !ctx.flags.talking.value &&
    !ctx.flags.ifPetting.value &&
    !(ctx.getGaze()?.isActive() ?? false) &&
    !(ctx.getBoneDrag()?.isActive() ?? false)

  /** 开始摸头（长按命中头部区域后由状态机调用） */
  const start = (worldX: number, worldY: number) => {
    const spine = ctx.getSpine()
    if (!canStart() || !spine?.state) return false

    // M 轨：有 Pat_02_M 则 Pat_01_M 播一次后自动接 Pat_02_M 循环（官方 PlayNext 链）；
    // 否则 Pat_01_M 持续循环（hina）
    if (hasAnimation(spine, 'Pat_02_M') && hasAnimation(spine, 'Pat_01_M')) {
      spine.state.setAnimation(TRACK_M, 'Pat_01_M', false)
      spine.state.addAnimation(TRACK_M, 'Pat_02_M', true)
    } else if (hasAnimation(spine, 'Pat_01_M')) {
      spine.state.setAnimation(TRACK_M, 'Pat_01_M', true)
    }
    // A 轨：Pat_01_A 存在则同步循环（hina；aris/kei 无）
    if (hasAnimation(spine, 'Pat_01_A')) {
      spine.state.setAnimation(TRACK_A, 'Pat_01_A', true)
    }

    ctx.flags.ifPetting.value = true
    holding = true
    controller?.press(worldX, worldY)
    return true
  }

  /** 摸头中跟随手指 */
  const move = (worldX: number, worldY: number) => controller?.move(worldX, worldY)

  /** 松开结束摸头：播放 PatEnd 并平滑回正 */
  const end = () => {
    const spine = ctx.getSpine()
    holding = false
    controller?.release()
    if (!spine?.state || !ctx.flags.ifPetting.value) {
      ctx.flags.ifPetting.value = false
      return
    }

    // PatEnd_01_M 为主（aris 仅有 M），PatEnd_01_A 存在则同步（hina/kei）
    // 官方 SpineClip 配置：PatEnd_01_M IntroMix/OutroMix = 0.3
    const hasEndM = hasAnimation(spine, 'PatEnd_01_M')
    const hasEndA = hasAnimation(spine, 'PatEnd_01_A')
    const endTrack = hasEndM ? TRACK_M : TRACK_A
    if (hasEndM) spine.state.setAnimation(TRACK_M, 'PatEnd_01_M', false).mixDuration = 0.3
    if (hasEndA) spine.state.setAnimation(TRACK_A, 'PatEnd_01_A', false).mixDuration = 0.3
    queueDummyPair(spine, 0.3)

    // 摸头结束动画播完才重置 ifPetting（期间允许被 talk 打断）；
    // 监听实际存在 PatEnd 的轨道——修复旧实现监听错位轨道导致 hina/kei 状态卡死的问题
    removeEndListener()
    if (hasEndM || hasEndA) {
      endListener = {
        complete: (entry) => {
          if (entry.trackIndex === endTrack && entry.animation!.name.startsWith('PatEnd')) {
            ctx.flags.ifPetting.value = false
            removeEndListener()
          }
        }
      }
      spine.state.addListener(endListener)
    } else {
      ctx.flags.ifPetting.value = false
    }
  }

  /** 立即打断（talk 在摸头结束阶段打断时用）：清轨回 Dummy，不做回弹动画 */
  const interrupt = () => {
    const spine = ctx.getSpine()
    holding = false
    removeEndListener()
    controller?.release()
    if (spine?.state) clearInteractPair(spine, 0.3)
    ctx.flags.ifPetting.value = false
  }

  const update = (dt: number) => controller?.update(dt)
  /** 手指仍按住摸头中 */
  const isActive = () => holding
  /** 摸头会话未结束（按住中或 PatEnd 播放中） */
  const isEngaged = () => ctx.flags.ifPetting.value
  /** 摸头动画是否可用 + 跟随骨名（调试用） */
  const debugInfo = () => ({ available, boneName: controller?.boundBoneName ?? null })

  return {
    attach,
    detach,
    canStart,
    start,
    move,
    end,
    interrupt,
    update,
    isActive,
    isEngaged,
    debugInfo
  }
}
