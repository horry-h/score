# TabBar配置说明

## 问题描述

app.json文件中出现了以下错误：
```
["tabBar"]["list"][0]["iconPath"]: "images/home.png" not found
["tabBar"]["list"][0]["selectedIconPath"]: "images/home-active.png" not found
["tabBar"]["list"][1]["iconPath"]: "images/history.png" not found
["tabBar"]["list"][1]["selectedIconPath"]: "images/history-active.png" not found
```

## 问题分析

### 这些图片的作用

这些图片文件是用于微信小程序底部导航栏（tabBar）的图标：

1. **`images/home.png`** - 首页图标（未选中状态）
2. **`images/home-active.png`** - 首页图标（选中状态）
3. **`images/history.png`** - 历史页面图标（未选中状态）
4. **`images/history-active.png`** - 历史页面图标（选中状态）

### TabBar的作用

TabBar是微信小程序的底部导航栏，通常包含2-5个页面，用户可以通过点击底部图标快速切换页面。

### 为什么出现错误

1. **项目没有使用TabBar**: 你的麻将记分小程序没有使用底部导航栏
2. **图标文件不存在**: 项目中没有这些图标文件
3. **配置不匹配**: app.json中配置了TabBar，但实际项目不需要

## 解决方案

### 移除TabBar配置

从app.json中完全移除tabBar配置，因为项目不需要底部导航栏。

**修改前**:
```json
{
  "pages": [...],
  "window": {...},
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07c160",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/home.png",
        "selectedIconPath": "images/home-active.png"
      },
      {
        "pagePath": "pages/history/history",
        "text": "历史",
        "iconPath": "images/history.png",
        "selectedIconPath": "images/history-active.png"
      }
    ]
  },
  "permission": {...}
}
```

**修改后**:
```json
{
  "pages": [...],
  "window": {...},
  "permission": {...}
}
```

## 项目导航方式

### 当前项目的导航方式

你的麻将记分小程序使用的是**页面跳转导航**，而不是TabBar：

1. **首页** (`pages/index/index`) - 主入口页面
2. **创建房间** (`pages/create-room/create-room`) - 通过按钮跳转
3. **加入房间** (`pages/join-room/join-room`) - 通过按钮跳转
4. **房间页面** (`pages/room/room`) - 通过房间号跳转
5. **历史房间** (`pages/history/history`) - 通过按钮跳转
6. **个人信息** (`pages/profile/profile`) - 通过头像点击跳转

### 导航流程

```
首页 (index)
├── 创建房间 → create-room
├── 加入房间 → join-room
├── 查看历史 → history
├── 个人信息 → profile
└── 最近房间 → room
```

## 如果需要TabBar

如果将来需要添加底部导航栏，可以按以下步骤：

### 1. 创建图标文件

在 `miniprogram/images/` 目录下创建以下文件：
- `home.png` (40x40px)
- `home-active.png` (40x40px)
- `history.png` (40x40px)
- `history-active.png` (40x40px)

### 2. 添加TabBar配置

```json
{
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07c160",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/home.png",
        "selectedIconPath": "images/home-active.png"
      },
      {
        "pagePath": "pages/history/history",
        "text": "历史",
        "iconPath": "images/history.png",
        "selectedIconPath": "images/history-active.png"
      }
    ]
  }
}
```

### 3. 图标设计要求

- **尺寸**: 40x40px
- **格式**: PNG格式
- **颜色**: 未选中状态使用灰色，选中状态使用主题色
- **风格**: 简洁明了，符合小程序设计规范

## 总结

1. **问题原因**: 项目不需要TabBar，但app.json中配置了TabBar
2. **解决方案**: 移除TabBar配置
3. **当前导航**: 使用页面跳转导航，更适合麻将记分小程序的业务逻辑
4. **未来扩展**: 如需TabBar，可以按需添加图标文件和配置

现在app.json文件已经修复，不再有图标文件找不到的错误。🎉
