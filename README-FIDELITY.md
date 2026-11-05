# 水管危机：顶视 3D 素材与场景还原

这一版沿用 Android WebView 和原游戏规则，使用 Blender 固定顶视烘焙贴图、真实管件网格、Three.js 实时玻璃，以及来自 Mantaflow 的液面网格样本。适用于本游戏固定正交顶视机位，不能当作任意视角的完整实时光照或实时流体求解。

## 范围和不变量

- 共用资产覆盖经典计时、无限练习、编号挑战、12 个解谜关卡、4 个抢修关卡、4 个双出口关卡与每日挑战。
- 原来的管件编号、队列顺序、规则、随机种子、计分、有限替换、撤回、重试、每日计时、存档键和判定保持不变。
- HUD、队列、关卡页、帮助、结果与原生菜单采用相同的泵站外观；按用户要求已移除 2D 场景，图形不支持时应升级系统 WebView。
- 渲染只读取游戏权威状态。连接关系、通水前沿、漏口、固定管、故障管随玩法更新；暂停/后台不推进视觉时钟。更换画面和上下文恢复不重置对局。
- 不透明材质按各实际方向单独烘焙，不旋转高光图片；三通与四通使用参考图的整体黄铜结构，避免玻璃穿过壳体。
- 最大棋盘 11×11，分组实例上限 128。GLB 资产一次加载，水流使用 5 个基本形状的有界缓存。像素比上限 3，动态画面约 30 次/秒提交，静止与后台停止无用重绘。

## 可编辑素材

- `art/fidelity/PipePanic_Modular_Fidelity.blend`：原始程序化材质与模块库；模型、UV 和完整光照烘焙保留。
- `art/fidelity/PipePanic_All_Layouts.blend`：22 个独立 Blender 编辑器场景（20 个固定关卡、当日挑战、经典 11×11 示例）。选择场景下拉框查看，默认解谜第 8 关。这里的解法布局仅作编辑器参考，不会作为背景或答案放进 APK。
- `art/fidelity/pipepanic-modules.glb`：标准 glTF 2.0 导出，最终颜色采用 `KHR_materials_unlit`，玻璃独立。
- `art/source-water/PipePanic_Blue_Water.blend` 和 `flow_cache/`：已确认的蓝色液体原始场景及 Mantaflow 缓存。
- `tools/art/`：原模型配方、模块和 UI 烘焙、GLB 整理、流体提取及场景生成脚本。
- `tools/render/fidelity-renderer.js`：运行时源码。`app/src/main/assets/jspp/fidelity-*` 为实际离线游戏资源。

## 构建

Android 构建和正式身份见根目录 README.md。普通 APK 构建直接使用已导出的离线资源，不需要重新烘焙 Blender 场景。

渲染器：`npm ci --ignore-scripts` 后执行 `npm run build:renderer`。Three.js 固定 0.187.0，esbuild 固定 0.28.2。已生成的运行文件随源码提供，普通 Android 构建不需要重新烘焙。

资产重建使用 Blender 5.2 LTS：

```text
blender --factory-startup -b -P tools/art/export_fidelity.py
python tools/art/package_fidelity.py
blender --factory-startup -b -P tools/art/export_console_ui.py
node tools/art/export_layouts.cjs
blender -b art/fidelity/PipePanic_Modular_Fidelity.blend -P tools/art/build_playable_scenes.py
blender -b art/source-water/PipePanic_Blue_Water.blend -P tools/art/export_liquid_source.py
python tools/art/package_fidelity.py --water art/source-water/samples
python tools/render/subset_font.py art/fonts/NotoSansSC-VF.ttf
```

Python 脚本依赖见 `tools/art/requirements.txt`。字体为 Noto Sans SC、SIL OFL 1.1，商业使用允许；界面子集固定在字重 500。Three.js 为 MIT，完整声明在游戏资源的 `third-party/three-LICENSE.txt`；保留原 PipePanic 的上游作者及 GPL/MIT 声明。正式版仅增加浩科签名版本检查的 INTERNET 权限，没有遥测、账号或后台服务。

## 验证边界

目标真机 PKG110、Android 16、WebView 151.0.7922.199、Adreno 750。详细实测和最终包哈希见 `docs/QA-0.26.md`。其他芯片、旧 WebView、横屏实体设备与长时间续航未据此宣称通过。实时玻璃反射和邻接光影仍可能与 Cycles 不同；固定顶视烘焙保留静态观感，液体样本沿当前路线变形并按规则裁切，手机不运行 Mantaflow 求解器。
