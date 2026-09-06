import type { Ref } from 'vue'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { Bone } from '@esotericsoftware/spine-core'
import type { MemorialLobby } from '@/types/config'

export interface InteractionFlags {
  talking: Ref<boolean>
  ifPetting: Ref<boolean>
}

export interface DragClips {
  start: string
  chain: string
  end: string
}

export interface DragTarget {
  controller: import('./useDragBone').DragBoneController
  radius: number
  anchorBone?: Bone | null
  clips: DragClips | null
}

export interface SpineInteractionContext {
  getSpine: () => Spine | null
  getLobby: () => MemorialLobby | undefined
  getLocale: () => string
  isReady: () => boolean
  isIdleMode: () => boolean
  dialogue: Ref<string>
  showDialogue: Ref<boolean>
  flags: InteractionFlags
  getPat: () =>
    | {
        isEngaged: () => boolean
        isActive: () => boolean
        interrupt: () => void
      }
    | undefined
  getGaze: () =>
    | {
        isActive: () => boolean
        isEngaged: () => boolean
      }
    | undefined
  getBoneDrag: () =>
    | {
        isActive: () => boolean
      }
    | undefined
}
