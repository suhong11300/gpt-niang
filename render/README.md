# 演示素材渲染 harness

`docs/preview/` 里的立绘、表情总表、动作总表和 GIF，全部由这套脚本在**本机真实渲染**产出：把本仓库的形象包喂进 Coopanion 自己的形象沙箱（`web/figure-frame.html` + `web/kit/rig.js` 的 WebGL 网格渲染），逐帧抓 canvas 像素，不是美术稿拼贴，也不是录屏裁切。

脚本本身不包含 Coopanion 的代码，需要你本地补齐依赖。

## 准备

```text
render/
├── web/        # 从 Coopanion 安装目录复制（见下）
├── figure/     # 本仓库的形象包文件（figure.json / model.json / *.js / native/ / retarget_prototype/ / thumb.png）
├── harness.html
├── harness.js
├── record.mjs
├── sheet.mjs
├── gridshot.mjs
└── shoot.mjs
```

1. 复制沙箱宿主（Windows 默认位置）：

   ```powershell
   $src = "$env:LOCALAPPDATA\Programs\Coopanion\resources\app\node_modules\cortico-world-desktop-pet\web"
   New-Item -ItemType Directory render\web -Force
   Copy-Item $src\figure-frame.html, $src\figure-frame.js, $src\i18n.js render\web
   Copy-Item $src\i18n render\web\i18n -Recurse
   Copy-Item $src\kit render\web\kit -Recurse
   ```

2. 复制形象包本体：

   ```powershell
   New-Item -ItemType Directory render\figure -Force
   Copy-Item figure.json, model.json, figure.js, face_painter_r5.js, thumb.png, native, retarget_prototype render\figure -Recurse
   ```

需求：Node.js 18+、Chrome（脚本用 `--headless=new` 起 CDP）、`ffmpeg` 在 PATH 或改脚本里的路径。

## 用法

```bash
node shoot.mjs                                  # 单帧探针，验证链路是否通（输出 570x570 PNG）
node record.mjs --words wave --frames 46 --tag wave   # 录一个动作的帧序列到 out/wave/
node sheet.mjs  --size 240                      # 按 figure.json 的 vocab 逐词录关键帧到 out/sheet/
node gridshot.mjs --type expr                   # 生成表情总表 out/sheet-expr.png
node gridshot.mjs --type motion                 # 生成动作总表 out/sheet-motion.png
```

帧序列合成 GIF：

```bash
ffmpeg -y -framerate 30 -i out/wave/%04d.png -vf "fps=24,scale=280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=180:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 out/demo-wave.gif
```

## 工作方式

- `harness.html` 是一个 420×420 的舞台，里面用 iframe 载入 `web/figure-frame.html`；`harness.js` 负责和沙箱握手（先等 `{t:'loaded'}`，再发 `init`，收到 `{t:'ready', words}` 才驱动）。
- `init` 的 `entry` / `base` **必须是绝对 URL**（沙箱内部用 `new URL()` 解析），脚本里用 `location.origin` 拼。
- 沙箱的 rig 是 **WebGL** canvas，套在 SVG `<foreignObject>` 里。headless 下 `Page.captureScreenshot` 截不到这块合成层，所以 `__grab()` 走页面内 `canvas.toDataURL()` 取像素，再画到 2D canvas 上铺背景导出。
- 每个动作词录制前先 `do('stand')` 并空跑约 26 帧复位，避免上一段动作的惯性带进下一张。
- `words` 数量应等于 `figure.json` 的 `vocab` 长度（本包为 37 = 19 表情 + 18 动作）；对不上说明包没被正确加载。

## 许可提醒

复制进来的 `web/` 属于 Pal-AI-Lab/Coopanion（AGPL-3.0-or-later），**不要提交到本仓库**，`.gitignore` 已忽略 `_render/` 与 `out/`。这里只保留自写的 harness 与驱动脚本。