<h1 align="center">小鱼档案</h1>

<p align="center">
<a href='https://gitee.com/sf-yuzifu/homepage/stargazers'><img src='https://gitee.com/sf-yuzifu/homepage/badge/star.svg?theme=dark' alt='star' /></a>
<a href='https://github.com/sf-yuzifu/homepage/stargazers'><img alt="GitHub stars" src="https://img.shields.io/github/stars/sf-yuzifu/homepage?style=social"></a>
</p>

<div align="center">有关小鱼的《蔚蓝档案》风格的个人主页</div>

![小鱼档案](shots/main.jpeg)

## 预览链接
- [小鱼档案](https://yzf.moe)
- [小鱼档案 - 备用](https://yuzifu.top/)

## 目前复刻程度
- [x] 加载界面
- [x] 主界面复刻
- [x] 回忆大厅
- [x] 弹窗复刻
- [x] 什亭之箱转场
- [x] 点击特效和动效
- [x] 多个学生大厅l2d切换

## 技术栈

- [Vue](https://cn.vuejs.org/)
- [Vite](https://vitejs.cn/vite3-cn/)
- [Arco Design](https://arco.design/)
- [pixi-spine](https://github.com/pixijs/spine)
- [Iconfont](https://www.iconfont.cn/)

## 部署方式

> **推荐环境：**
> 
> node > 16.16.0  
> npm > 8.15.0

1. 安装yarn
```bash
# 安装 yarn
npm install -g yarn
```
2. 克隆此项目到本地
3. 在项目根目录下运行
```bash
# 安装依赖
yarn install

# 预览（开发环境）
yarn dev

# 构建
yarn build

# 预览（生产环境）
yarn preview
```
> 构建完成后，静态资源会在 **`dist` 目录** 中生成，你可以将 **`dist` 目录中的文件**上传至服务器，也可以使用 `Vercel`、`Netlify` 等静态托管平台一键导入并自动部署

## 个性化
> 打开根目录下的 `_config.json`，在其中你会看到如下内容

```json5
{
  // 网站基本配置
  "title": "小鱼档案", // 网站标题
  "description": "有关小鱼的《蔚蓝档案》风格的个人主页", // 网站简介
  "favicon": "/favicon144.png", // 网站图标链接
  "author": "小鱼yuzifu", // Sensei，你的名字
  "keywords": "蔚蓝档案,小鱼yuzifu,个人主页", // 网站关键词描述
  "ICP": "", // ICP备案号
  // PWA配置（https://developer.mozilla.org/zh-CN/docs/Web/Manifest）
  "manifest": {
    "name": "小鱼档案", // 应用全称
    "short_name": "小鱼档案", // 应用简称
    "description": "有关小鱼的《蔚蓝档案》风格的个人主页", // 简介
    "theme_color": "#128AFA", // 主题色
    "start_url": "/",
    "id": "Homepage",
    // 图标
    "icons": [
      {
        "src": "/favicon512.png", // 网站图标链接
        "sizes": "512x512", // 尺寸
        "purpose": "any maskable"
      }
    ]
  },
  // 个人信息
  "level": 75, // 等级
  "exp": 114514, // 经验值
  "nextExp": 1919, // 到达下一等级经验值（比exp小则显示满级）
  // Iconfont图标导入
  "iconfont": "https://at.alicdn.com/t/c/font_4336463_0i6ly0yvyzb.js",
  // 底部项目信息（推荐5个，最多7个）
  "dock": [
    {
      "name": "一起吃小鱼", // 项目名称
      "href": "https://gitee.com/sf-yuzifu/eat-fish-together", // 项目地址
      "imgSrc": "/img/fish.png" // 项目图标
    }
  ],
  // 左边联系方式（推荐4个，最多不限）
  "contact": [
    {
      "name": "QQ", // 联系方式
      "href": "https://wpa.qq.com/msgrd?v=3&uin=1906929246&site=qq&menu=yes&jumpflag=1", // 联系地址
      "iconfont": "icon-qq" // iconfont图标id（只有icon-qq/github/bilibili/gitee）
    }
  ],
  // 任务按钮启动
  "task": {
    "name": "个人博客", // 任务名称
    "href": "https://blog.yzf.moe/" // 跳转地址
  }
}
```

## 有关学生回忆大厅L2D文件获取
1. 自己去解包（[教程1](https://www.bilibili.com/read/cv15934670/)、[教程2](https://www.bilibili.com/read/cv18073492/)）
2. 去[基沃托斯古书馆](https://kivo.wiki/)中的“角色图鉴”——“切换到鉴赏模式”——“回忆大厅”当中自行获取
