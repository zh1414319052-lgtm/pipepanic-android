# 素材清单

| 素材 | 源文件 / 编辑入口 | 游戏内导出 | 归属与许可 |
|---|---|---|---|
| 模块与棋盘场景 | fidelity/PipePanic_Modular_Fidelity.blend、PipePanic_All_Layouts.blend、tools/art/ 配方 | fidelity/pipepanic-modules.glb、app/src/main/assets/jspp/fidelity-assets.js | 本项目程序化制作；修改源码按 GPL-2.0-or-later 提供，原创美术按上游 Free Art License 1.3 提供 |
| 蓝色流动液面 | source-water/PipePanic_Blue_Water.blend、flow_cache；tools/art/export_liquid_source.py | app/src/main/assets/jspp/fidelity-water.js | Blender Mantaflow 采样，非手机实时流体；缓存保留用于导出 |
| 水声与其他音效 | tools/render/design_sounds.py | app/src/main/assets/jspp/pump-sounds.js、pump-audio.js | 本项目程序合成，无外部录音 |
| 泵站 UI | ui/pump-console.haoke-ui.json、console-concept.png、tools/art/export_console_ui.py | fidelity-ui、pump-console.css 等 | 本项目设计基准与生成脚本；只保留实际可得原件 |
| 新游戏图标 | icon/pipepanic-icon-master.png、PROMPT.md | mipmap-*、drawable-nodpi/launcher_art.png | 内置 image_gen 生成，PNG 原件，无分层工程；使用受生成服务适用条款约束，不承诺商标独占性 |
| 中文字体 | fonts/NotoSansSC-VF.ttf、OFL.txt；tools/render/subset_font.py | PipeNoto.ttf | Noto Sans SC / SIL OFL 1.1，允许商业使用 |
| Three.js | package-lock.json 固定 0.187.0 | fidelity-runtime.js | MIT；完整许可在 third-party/three-LICENSE.txt |
| 上游 2D 素材 | upstream-sprites/，历史图标 XCF/PNG | 当前 3D 游戏不再引用 | 原作者 Thunor / Free Art License；仅归档以保留来源，不恢复 2D 模式 |

许可全文：app/src/main/assets/jspp/COPYING（GPL）、COPYING-ARTWORK（FAL）、NotoSansSC-OFL.txt；根 LICENSE 为 Android 上游外壳 MIT，不代表整个内嵌游戏仅 MIT。图标生成提示词和尺寸导出脚本已归档。

Unity 真实流体样板已被用户取消；不属于本次正式包，未混入这些运行资源。历史概念与建模配方保留在 tools/art 中，图片或音频只有实际可得格式，不伪造可编辑分层工程。
