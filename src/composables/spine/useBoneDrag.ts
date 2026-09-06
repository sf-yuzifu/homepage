import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { SpineInteractionContext, DragTarget, DragClips } from './types'
import { DragBoneController } from './useDragBone'
import { detectDragBones, findBoneByCandidates, HAND_FOLLOW_BONE_CANDIDATES } from './boneDetect'
import { TRACK_M, hasAnimation } from './useSpineTracks'

// 官方动态骨参数（Shittim_Canvas 动态 IK / SpecialSpine.json：±0.3 Unity 单位 = ±30 骨架单位，smoothTime 0.08）
const DRAG_RANGE = 30
const DRAG_SMOOTH_TIME = 0.08
const DRAG_RADIUS = 120

// 官方 HandFollowIK 参数（aris 专有，AssetStudio 解包值）：范围非对称，命中半径按 350x350 NGUI 区域折算
const HAND_FOLLOW_OFFSETS = { minX: -147.7, maxX: 179.3, minY: -148.0, maxY: 148.4 }
const HAND_FOLLOW_RADIUS = 180
const HAND_FOLLOW_SMOOTH_TIME = 0.15

// 面部家族骨骼（Face_IK/Neck_IK）是 IK 目标锚点，自身位置可能远离面部
// （实测 kei 的 Face_IK 悬在头顶上方约 370px，按其位置判定永远"捏不到脸"），
// 命中判定改用面部锚点骨骼（face/Head_Rot），判定区域即整个脸部——符合捏脸直觉
const FACE_FAMILY_PATTERN = /^(Face|Neck)_IK$/i
const FACE_ANCHOR_CANDIDATES = ['face', 'Face', 'Head_Rot']
const FACE_HIT_RADIUS = 170

/**
 * 捏脸/特殊骨骼拖拽（原游戏动态 IK + SpecialSpine.json + HandFollowIK 的 Web 等价）：
 * 按住可拖拽骨骼附近并拖动时，该骨骼跟随手指位移（局部空间钳制 + SmoothDamp），
 * 松开后平滑回弹回原位。
 *
 * 自动探测内容：
 *   - Face_IK / Neck_IK：脸/颈的 IK 目标骨，拖拽即捏脸（aris/kei）
 *   - breast_* 系特殊骨（aris）
 *   - HandFollow 骨 + HandFollow 动画链（aris 专有）：按住手附近拖动，手跟随手指，
 *     播 HandFollow_01_M → 自动接 HandFollow_02_M 循环，松开 HandFollowEnd_01_M 收尾
 *
 * 也可在 _config.yaml 的 interactions.dragBones 中显式配置（覆盖自动探测结果）：
 *   dragBones:
 *     - { bone: breast_01L, radius: 120, range: 30, smoothTime: 0.08 }
 *     - bone: HandFollow            # 带动画链的拖拽
 *       radius: 180
 *       clips: { start: HandFollow_01_M, chain: HandFollow_02_M, end: HandFollowEnd_01_M }
 *   dragBones: false   # 整体禁用
 *
 * @param {object} ctx 共享上下文（见 Background.vue）
 */
export function useBoneDrag(ctx: SpineInteractionContext) {
  let dragTargets: DragTarget[] = []
  let activeTarget: DragTarget | null = null

  const attach = (spine: Spine) => {
    detach()
    const cfg = ctx.getLobby()?.interactions?.dragBones
    if (cfg === false) return

    if (Array.isArray(cfg) && cfg.length > 0) {
      // 显式配置优先（clips 可选：{ start, chain, end }；anchor 可选：命中判定用锚点骨名）
      dragTargets = cfg
        .map((item): DragTarget | null => {
          const controller = new DragBoneController({
            boneName: item.bone,
            rangeX: item.range ?? DRAG_RANGE,
            rangeY: item.range ?? DRAG_RANGE,
            smoothTime: item.smoothTime ?? DRAG_SMOOTH_TIME,
            releaseSmoothRatio: 0.3
          })
          if (!controller.attach(spine)) return null
          const anchorBone = item.anchor ? spine.skeleton.findBone(item.anchor) : null
          return {
            controller,
            radius: item.radius ?? DRAG_RADIUS,
            anchorBone,
            clips: (item.clips as DragClips | undefined) ?? null
          } satisfies DragTarget
        })
        .filter((t): t is DragTarget => t !== null)
      return
    }

    // 自动探测：捏脸/特殊骨骼
    dragTargets = detectDragBones(spine.skeleton)
      .map((bone): DragTarget | null => {
        const controller = new DragBoneController({
          boneName: bone.data.name,
          rangeX: DRAG_RANGE,
          rangeY: DRAG_RANGE,
          smoothTime: DRAG_SMOOTH_TIME,
          releaseSmoothRatio: 0.3
        })
        if (!controller.attach(spine)) return null
        // 面部家族骨骼改用面部锚点判定（见 FACE_FAMILY_PATTERN 注释）
        const isFaceFamily = FACE_FAMILY_PATTERN.test(bone.data.name)
        return {
          controller,
          radius: isFaceFamily ? FACE_HIT_RADIUS : DRAG_RADIUS,
          anchorBone: isFaceFamily
            ? findBoneByCandidates(spine.skeleton, FACE_ANCHOR_CANDIDATES)
            : null,
          clips: null
        } satisfies DragTarget
      })
      .filter((t): t is DragTarget => t !== null)

    // 同一锚点的面部家族骨骼并列时优先 Face_IK（脸变形目标），其次 Neck_IK
    dragTargets.sort((a, b) => {
      const aF = /^Face_IK$/i.test(a.controller.boundBoneName ?? '') ? 0 : 1
      const bF = /^Face_IK$/i.test(b.controller.boundBoneName ?? '') ? 0 : 1
      return aF - bF
    })

    // 自动探测：HandFollow（骨与动画链都存在才启用，aris 专有）
    const handBone = findBoneByCandidates(spine.skeleton, HAND_FOLLOW_BONE_CANDIDATES)
    if (handBone && hasAnimation(spine, 'HandFollow_01_M')) {
      const controller = new DragBoneController({
        boneName: handBone.data.name,
        minOffsetX: HAND_FOLLOW_OFFSETS.minX,
        maxOffsetX: HAND_FOLLOW_OFFSETS.maxX,
        minOffsetY: HAND_FOLLOW_OFFSETS.minY,
        maxOffsetY: HAND_FOLLOW_OFFSETS.maxY,
        smoothTime: HAND_FOLLOW_SMOOTH_TIME,
        releaseSmoothRatio: 0.3
      })
      if (controller.attach(spine)) {
        dragTargets.push({
          controller,
          radius: HAND_FOLLOW_RADIUS,
          clips: {
            start: 'HandFollow_01_M',
            chain: 'HandFollow_02_M',
            end: 'HandFollowEnd_01_M'
          }
        })
      }
    }
  }

  const detach = () => {
    for (const t of dragTargets) t.controller.detach()
    dragTargets = []
    activeTarget = null
  }

  const available = () => dragTargets.length > 0

  /** 按下点附近找可拖拽骨骼（世界坐标，取最近且在半径内的；有锚点骨则按锚点位置判定） */
  const findAt = (worldX: number, worldY: number): DragTarget | null => {
    let best: { target: DragTarget; distance: number } | null = null
    for (const t of dragTargets) {
      const hitBone = t.anchorBone ?? t.controller.bone
      if (!hitBone) continue
      const distance = Math.sqrt((worldX - hitBone.worldX) ** 2 + (worldY - hitBone.worldY) ** 2)
      if (distance < t.radius && (!best || distance < best.distance)) {
        best = { target: t, distance }
      }
    }
    return best?.target ?? null
  }

  const canStart = () =>
    dragTargets.length > 0 &&
    ctx.isIdleMode() &&
    ctx.isReady() &&
    !ctx.flags.talking.value &&
    !ctx.flags.ifPetting.value &&
    !(ctx.getGaze()?.isActive() ?? false)

  /**
   * 在按下点预探测可拖拽骨骼（状态机在按下时调用，拖动阈值通过后再 start）
   */
  const probe = (worldX: number, worldY: number) => (canStart() ? findAt(worldX, worldY) : null)

  /** 开始拖拽指定目标（带动画链的目标播放 start → chain） */
  const start = (target: DragTarget | null, worldX: number, worldY: number) => {
    if (!target || !canStart()) return false
    activeTarget = target
    const spine = ctx.getSpine()
    if (target.clips && spine?.state && hasAnimation(spine, target.clips.start)) {
      spine.state.setAnimation(TRACK_M, target.clips.start, false)
      if (hasAnimation(spine, target.clips.chain)) {
        spine.state.addAnimation(TRACK_M, target.clips.chain, true)
      }
    }
    return target.controller.press(worldX, worldY)
  }

  const move = (worldX: number, worldY: number) => activeTarget?.controller.move(worldX, worldY)

  /** 结束拖拽（带动画链的目标播放 end 后回 Dummy） */
  const end = () => {
    if (activeTarget?.clips) {
      const spine = ctx.getSpine()
      if (spine?.state && hasAnimation(spine, activeTarget.clips.end)) {
        spine.state.setAnimation(TRACK_M, activeTarget.clips.end, false).mixDuration = 0.3
        if (hasAnimation(spine, 'Dummy')) {
          spine.state.addAnimation(TRACK_M, 'Dummy', true).mixDuration = 0.3
        }
      }
    }
    activeTarget?.controller.release()
    activeTarget = null
  }

  const update = (dt: number) => {
    for (const t of dragTargets) t.controller.update(dt)
  }

  const isActive = () => activeTarget?.controller.isActive() ?? false

  /** 当前可拖拽目标清单（调试用） */
  const targetNames = () => dragTargets.map((t) => t.controller.boundBoneName)

  return { attach, detach, available, probe, start, move, end, update, isActive, targetNames }
}
