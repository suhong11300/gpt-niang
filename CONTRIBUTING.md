# 贡献指南

感谢你愿意把这只龙娘往前推一步。这个仓库是一个 **Coopanion 形象包（figure pack）**，改动面不大，但有几条硬边界要守。

## 可以改什么

| 方向 | 文件 | 说明 |
| :--- | :--- | :--- |
| 表情 / 动作语义 | `figure.json` → `vocab` | 词条 **id、数量、名称**不要动，否则会与宿主词汇表脱节；可以调整 `about` 描述与 `seconds` 时长。 |
| 美术素材 | `retarget_prototype/`、`native/tex/`、`native/feat/` | 换色、修线、重画表情都可以。改前先看 `ARTWORK.md`。 |
| 骨骼与姿态 | `model.json` → `pivots` / `deformers` / `parts` / `seated` | 只改数值，不要删除部件；`body / waist / neck / armNear / armFar / legBack / legFront / tail / wing_l / wing_r` 十个轴心缺一不可。 |
| 表情绘制逻辑 | `face_painter_r5.js` | 眼口裁剪区、眨眼叠加、说话嘴型都在这里。 |
| 渲染脚本 | `render/` | 生成演示素材用的本地 harness，欢迎让它更好用。 |

## 不要动什么

- **`native/figure.js`** —— 上游 Coopanion 控制器的逐字节副本（AGPL-3.0-or-later）。要让手感保持一致，就不要改它；确有需要请先开 Issue 说明理由。
- **`figure.json` 的 `id`** —— 固定为 `gpt-niang`，改成别的会让已导入用户的形象变成两个。
- **`manifest` / `api` 版本号** —— 目前是 `2`，跟随宿主规范，不要自行提升。

## 提 Issue

请尽量带上这些信息，定位会快很多：

1. Coopanion 版本（设置 → 关于）。
2. 操作系统与版本（Windows 11 / macOS 14 / Ubuntu 24.04…）。
3. 复现步骤：哪个动作词、什么操作触发的。
4. 截图或录屏；如果是渲染错位，附上 `model.json` 改了什么。

## 提 Pull Request

1. Fork 本仓库，从 `main` 切分支：`git checkout -b fix/face-blur`。
2. 只改一件事，提交信息写清动机（见下）。
3. 本地验证：把仓库目录（含 `figure.json`）压成 zip，在 Coopanion **装扮 → 形象 → 导入** 里导入，逐个点一遍受影响的表情与动作。
4. 如果改动了渲染相关代码，跑一次 `render/record.mjs` 出帧，确认画面没坏。
5. 提 PR 时贴一张改动前后的对比图。

## 提交信息

沿用 Conventional Commits 的轻量写法：

```text
feat(vocab): 给 shy 增加 0.2s 过渡
fix(face): 修正 wink 左眼裁剪区偏移
art(tex): 重绘坐姿裙摆高光
docs(readme): 补充 macOS 导入截图
```

## 许可

提交即表示你同意以 **MIT** 授权你的贡献；若改动涉及 `native/figure.js`，则按 **AGPL-3.0-or-later** 处理。详见 [LICENSE](LICENSE)。

## 行为准则

友善、就事论事。这个项目是同人二创，角色与各 AI 厂商无关，讨论时请把「角色」和「真实公司 / 真人」分开。