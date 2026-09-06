import * as PIXI from 'pixi.js'

/**
 * 创建 PIXI 应用；WebGL 不可用或上下文创建失败时返回 null，由调用方降级为静态背景。
 * PIXI 8 起 Application 必须异步 init（构造器不再接受参数）；固定 WebGL 渲染器，
 * 与 isWebGLSupported 预检和 webglcontextlost 降级链路保持一致。
 */
export async function tryCreatePixiApp(
  options?: Partial<PIXI.ApplicationOptions>
): Promise<PIXI.Application | null> {
  try {
    if (!PIXI.isWebGLSupported()) {
      console.error('WebGL is not available; Live2D will use a static background')
      return null
    }

    const app = new PIXI.Application()
    await app.init({ preference: 'webgl', ...options })
    if (!app.canvas || !app.renderer) {
      app.destroy()
      console.error('PIXI renderer failed to initialize; Live2D will use a static background')
      return null
    }
    return app
  } catch (error) {
    console.error('Failed to create PIXI application; Live2D will use a static background', error)
    return null
  }
}
