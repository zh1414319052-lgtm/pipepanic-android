# 水管危机 · PipePanic 浩科版

<img height="160" src="./ic_launcher-web.png" align="right" alt="Blue glass pipe game icon" />

**当前版本：0.21-haoke.32（构建 32），基于已验收的 0.31-QA 顶视 3D 版。**

[安装包与版本说明 / Download](https://www.haoke.org/software/de681cad754b9264)

保留经典计时、无限练习、同编号队列挑战、12 个解谜关卡、4 个抢修关卡、4 个分流关卡及每日挑战。提示开关默认关闭并记忆选择；开启时指示下一根管件位置。保留撤回、重试、蓝色水流、合成水声、中英文界面和全屏安全区。没有 2D 切换、在线匹配或手机端真实流体求解。

本次新增玻璃蓝水图标及签名版本检查。游戏离线可玩；主菜单空闲时检查浩科更新，关于页可手动检查、打开浩科工具站。仅请求公开签名版本信息，不上传棋盘、分数或设备标识，不自动下载/安装，不运行后台服务。服务器可见普通连接信息（如 IP）。

## Android 构建与身份

- Android 8.0+，需支持 WebGL 2 的系统 WebView。实测 PKG110 / Android 16 / Adreno 750 / WebView 151；未据此承诺旧手机兼容性。
- 正式包名 `org.olgsoft.apipepanic.haoke`，测试包名追加 `.qa`。独立于上游及旧 QA，不能自动迁移它们的应用私有数据。
- 使用 JDK 21、Android SDK 30 / Build Tools 36.0.0、Gradle 8.8、AGP 8.6.1。配置不入库的 `local.properties` 指向本机 SDK。
- Windows 中文路径可以编译 APK，但 Java 测试类加载器出现路径编码问题；`powershell -File tools/build-release.ps1` 创建独立 ASCII 构建副本并执行全部测试和 Release 构建。其他系统使用 `./gradlew :app:testReleaseUnitTest :app:assembleRelease`。
- `node --test tests/*.cjs` 检查关卡、提示、暂停、存档、投影和实际打包资产。
- 此为网站直接分发 APK，沿用 target SDK 30 的已验证窗口行为；仅排除 Google Play 的 target SDK 提交规则，不宣称满足 Play 商店上架要求。
- 发布签名使用外部受保护证书；公开指纹与 feed 身份见 `docs/release-identity.json`。`tools/sign-release.ps1` 从子进程环境读取密码，源码不含私钥或密码。维护者不得重新生成已建立证书。

## 美术与可复现源码

`art/ASSETS.md` 是完整素材映射；Blender 原件、液面缓存、图标 PNG 原件/提示词、UI 可编辑稿、商用授权字体及导出脚本一并提供。运行时使用已有导出资源；渲染器与 Blender 重新导出步骤见 `README-FIDELITY.md`。字体：Noto Sans SC，SIL OFL 1.1。

Three.js 0.187.0、esbuild 0.28.2 固定在 package-lock.json；如需重建渲染器，执行 `npm ci --ignore-scripts`、`npm run build:renderer`。Java EdDSA 0.3.0 为 CC0；AndroidX 为 Apache-2.0。许可全文包含在 APK 中；所有运行依赖的固定源码包、POM、下载来源和 SHA-256 保存在 `third_party/sources/`。

## 上游与许可

基于 rnauber 的 [pipepanic-android](https://github.com/rnauber/pipepanic-android)，上游 0.21 / `f87c0d754641572b50919cd5c2d6d13d0a3ec440`。内嵌 JavaScript 游戏由 Thunor 创作，GPL-2.0-or-later；美术为 Free Art License；Android 外壳源自 Paul Sarbinowski 的 2048-android，MIT。根 LICENSE 仅为外壳许可，不能把整个游戏描述为仅 MIT。对应许可全文保留在游戏资源内。本仓库保留上游历史，浩科改动与上述素材为当前发行的对应源码。

---

以下为保留署名用途的**上游原始 README**；其中 F-Droid 和演示链接指向上游原版。本发行下载入口见本文顶部。

<img height="200px" src="./ic_launcher-web.png" align="right" />

pipepanic-android
===================
A plumber's favorite game!

[<img src="https://fdroid.gitlab.io/artwork/badge/get-it-on.png"
    alt="Get it on F-Droid"
    height="80">](https://f-droid.org/en/packages/org.olgsoft.apipepanic/)




PipePanic is about connecting pipes in a hurry before any water spills!

This is an android port of the [PipePanic](http://www.users.waitrose.com/~thunor/jspp/index.html)
game made by Thunor based on [2048-android](https://github.com/uberspot/2048-android) by uberspot.
It gives you a launcher icon and allows offline play. You can get the the game
at [fdroid](https://f-droid.org/en/packages/org.olgsoft.apipepanic/)!
[Or you can try it in your browser!](https://htmlpreview.github.io/?https://github.com/rnauber/pipepanic-android/blob/master/app/src/main/assets/jspp/index.html)

Contributions are very welcome!

Yours,
[rnauber](https://github.com/rnauber)

[<img src="screenshot.png"
    alt="Screenshot of the game"
    height="200">](https://htmlpreview.github.io/?https://github.com/rnauber/pipepanic-android/blob/master/app/src/main/assets/jspp/index.html)


## How to Play PipePanic

Join the green start-pipe and red end-pipe together using the pieces given to you via the preview
bar on the left. The pipe shown in the rightmost square is the next available pipe for placement
upon the game board. Once the timer reaches zero or you click on 'Fill Pipes'
the game board is cleared of any non-connecting 'dead' pieces and the system is flooded
with liquid. If any leaks are found the liquid stops flowing, so to achieve the highest score you
must cover as much of the game board as possible with a properly connected leakless pipe network.

## Difficulty

    "Who buys cheap, buys twice." (old German proverb)

Sometimes you are forced to use subpar materials for your plumbing job. In the difficulty settings "
medium" to "very hard" you have to use pipes with an increasing likelihood of breakage. So replace
the broken pipes and claim extra money from the manufacturer when they are flooded.

Or you prefer not to rush, and disable the automatic flooding.

## Scoring

<ul>
    <li>10 points for placing a pipe upon the game board.
    </li>
    <li>-10 points for placing a piece on top of an already existing
        pipe.
    </li>
    <li>5 points for each second left on the timer if you fill the
        system early.
    </li>
    <li>-10 points for each dead pipe left on the board once the system
        starts to flood.
    </li>
    <li>50 points for each successfully flooded pipe.
    </li>
    <li>Additionally 100 points for each broken pipe that you fixed before it is flooded.
    </li>
    <li>250 points for successfully flooding the endpipe (red).
    </li>
</ul>

## Strategies

The pipe pieces given to you on the preview bar are random, but are randomly selected from a
suitable selection, so that if you require a certain piece to complete your network it won't be too
long before it becomes available for use. There are many more vertical and horizontal pipes than the
others.

The best approach is to place out the pieces given to you into a suitable design that will
accommodate future pipes that have yet to appear on the preview bar, rather than simply attempting
to connect one pipe to the next. The less pipes you waste through overwriting the higher your score
will be.

## Battle Mode

If you feel competitive, you can battle with others in "BATTLE MODE"!
Simply choose the same battle number (seed) and then you will get the exact same sequence of pipes.
So no one can blame a low score on just bad luck :)



## Licenses

pipepanic-android is licensed under
the [MIT license.](https://github.com/rnauber/pipepanic-android/blob/master/LICENSE)
The javascript game files are licensed under GPL v2.
