declare module 'howler' {
  export interface HowlOptions {
    src: string | string[]
    volume?: number
    loop?: boolean
    autoplay?: boolean
    mute?: boolean
    rate?: number
    html5?: boolean
    /** 显式声明音频格式（URL 无扩展名时必需，否则 howler 嗅探失败报 loaderror） */
    format?: string | string[]
    onload?: () => void
    onloaderror?: (id: number, error: unknown) => void
    onplay?: () => void
    onplayerror?: (id: number, error: unknown) => void
    onend?: () => void
    onpause?: () => void
    onstop?: () => void
  }

  export class Howl {
    constructor(options: HowlOptions)
    play(spriteOrId?: string | number): number
    stop(id?: number): this
    pause(id?: number): this
    unload(): this
    volume(vol?: number, id?: number): number | this
    /** 未传参返回当前播放位置（秒；未加载完成时返回 this），传参则跳转 */
    seek(position?: number, id?: number): number | this
    /** 音频总长（秒；元数据加载完成前可能为 0） */
    duration(id?: number): number
  }
}
