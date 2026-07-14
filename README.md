# 桌面蟑螂 Desktop Cockroach 🪳

macOS 桌面小玩具：桌面常驻一个墙洞，点它钻出一只带爬行动效的蟑螂，随机满屏乱爬，跑出屏幕自动消失，点中则打击拍死。

## 运行

```bash
npm install        # Electron 若被网络拦截见下
npm run dev        # 启动
npm test           # 跑核心纯逻辑单测
npm run build      # 构建到 out/
```

Electron 二进制被网络拦截时：

```bash
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js
```

## 玩法

- 右下角墙洞：点击钻出蟑螂（可反复点，最多同时 30 只），可拖动到任意位置。
- 蟑螂随机乱爬，朝向跟随移动方向，爬出屏幕自动销毁。
- 点中蟑螂 → 打击特效 + 拍死渐隐。
- 菜单栏 🪳 图标：清空所有蟑螂 / 退出。
- 平时鼠标穿透，不影响正常使用其他软件。

## 结构

- `src/core/` —— 纯逻辑（运动学 / 命中几何 / 数量花名册），Vitest 覆盖。
- `src/main/` —— Electron 主进程：透明置顶覆盖窗、鼠标穿透切换、托盘。
- `src/renderer/runtime/` —— 墙洞、蟑螂、舞台驱动、拍死特效。

设计与实现计划见 `docs/superpowers/`。
