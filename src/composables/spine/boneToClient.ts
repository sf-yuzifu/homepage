import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { Application } from 'pixi.js'

/** 骨架骨骼世界坐标 → 浏览器 client 像素（与 __l2dDebug.boneClientPos 一致） */
export function boneToClientPoint(
  spine: Spine,
  canvas: HTMLCanvasElement,
  app: Application,
  boneName: string
): { x: number; y: number } | null {
  const bone = spine.skeleton.findBone(boneName)
  if (!bone) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / app.screen.width
  const scaleY = rect.height / app.screen.height
  return {
    x: (bone.worldX * spine.scale.x + spine.x) * scaleX + rect.left,
    y: (bone.worldY * spine.scale.y + spine.y) * scaleY + rect.top
  }
}
