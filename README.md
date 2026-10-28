# Educational Explainer Video Skill

把教育文稿、讲解稿或 SRT 字幕转化为内容驱动的解释型信息动画生产流程。它会从每篇新文稿重新解析人物、物件、动作、概念、关系、公式和数据，而不是默认套用老师、黑板或课堂模板。

## 能做什么

- 生成可验证的 production brief 和 SRT 帧时间轴
- 根据 A/B/C 风险闸门决定完整样片、微样或直接制作
- 提供“标准高效（默认）”与“严格审计”两种审查模式
- 支持 16:9 与 9:16 的独立布局和字幕安全区
- 先规划素材依赖、生成顺序和文字/数据预留区，再完成主体运动中间态与数据合成
- 检查PNG真实透明度、可见边界和定位锚点，保存原图/提示词/用途与SHA，按语义复用素材
- 提供主体入场、弧线停靠、跨镜连续、阴影跟随的可编辑图层组件
- 提供中性的 Remotion starter
- 验证媒体编码、画幅、帧率、帧数、音轨、时长和完整解码

## 现在仓库里有什么

| 内容 | 入口与用途 |
| --- | --- |
| Skill 规范 | [SKILL.md](SKILL.md)，规划、素材、动画、审查与交付规则 |
| 工程思想 | [工程思想与架构](docs/工程思想与架构.md)，来源驱动、图层分工与确定性动画 |
| 实现路径 | [从SRT到成片](docs/从SRT到成片.md)，逐阶段输入、产出、命令与验收 |
| 复用方法 | [素材与动效复用](docs/素材与动效复用.md)，选材、透明边界、图表和连续动作 |
| 解释与品质 | [解释设计与品质改进](docs/解释设计与品质改进.md)，生成前拆解动作，判断素材品质／多样性，检查连续观看的解释进展 |
| 素材库 | [material-library](material-library/README.md)，44张原始PNG：28透明主体、16完整场景，附离线检索页、提示词、用途限制与哈希 |
| 可运行示例 | [layered-explainer](examples/layered-explainer/README.md)，24秒透明主体与三种数据图动画，使用合成演示数据 |
| 通用组件与工具 | `assets/`、`scripts/` 和 `tests/`，分层/图表组件、确定性校验与测试 |

下载后可直接打开 `material-library/index.html` 搜索、筛选和预览素材。复用时先看目录记录与使用限制，再按当前文稿选材；图片内容不作为政策或学校数据的证据。

### 先跑一个完整示例

需要 Node.js 22 或更新版本。在仓库根目录执行：

```sh
cd examples/layered-explainer
npm ci
npm run verify
npm run dev
```

打开终端显示的 Studio 地址，选择 `LayeredExplainer`。需要导出时执行 `npm run render`。首次安装依赖或获取 Chromium 需要网络；示例不依赖图像生成服务，所有数字均明确标为合成演示数据。参数、改稿入口与验收范围见示例 README。

素材库的文件、哈希和离线目录检查可在仓库根目录执行：

```sh
node material-library/verify.cjs
```

## 安装

### Git clone

```powershell
git clone https://github.com/lyc4614/educational-explainer-video-skill.git "$HOME/.codex/skills/educational-explainer-video"
```

也可以下载 ZIP，解压后把仓库目录复制到：

```text
~/.codex/skills/educational-explainer-video
```

如果目标目录已存在，请先自行备份或选择其他目录；安装命令不应覆盖现有 Skill。

## 使用

在 Codex 中提供教育文稿或 SRT，并提出类似请求：

> 把这篇教育文稿做成无真人出镜的解释型信息动画。

Skill 会先确定审查模式，再生成结构化制作简报，解析与原文可追溯的解释元素，并决定样片等级和后续制作步骤。

未指定模式且没有严格触发条件时，Skill 会说明并默认采用 **标准高效模式**：保留代表帧、全部场景边界、接触表、最终总回归和完整媒体门禁，同时减少重复代理审查与重复成功验证。正式客户验收、高风险事实、共享视觉系统变更或用户明确要求时，Skill 会建议选择 **严格审计模式**，增加密集静帧、阶段回归和独立规格/质量审查。

两种模式的最终技术门禁完全相同；任何模式都不能跳过最终文件的版本检查、媒体合同、完整解码和 SHA-256 验证。最终验收失败时先定点修复相关范围，变更后的最终文件必须重新通过完整媒体门禁。

## 分层素材与数据动画

当任务需要透明主体、3D风格插画或素材库复用时，会按需读取`references/layered-compositing.md`。先依据SRT决定对象和解释动作，检查已有素材，只补齐缺少的主体；先检查主体运动及预留区，再叠加卡片、真实图表或公式。素材和具体题材内容放在各自项目中，不被固定成一套通用画面。

`inspect-asset.mjs`需要项目可解析的`sharp`，也可用`--sharp-module`指定可信的已安装模块路径。纯位姿测试不依赖sharp。

```powershell
node scripts/inspect-asset.mjs public/report.png --id report --kind cutout --out qa/report-v001.json
```

复用代码位于`assets/layered-primitives/`：`VisibleAsset.tsx`按可见主体定位，`motion.mjs`提供纯位姿计算，`LayeredExample.tsx`展示主体建立→停靠→已验证数据揭示。调用方提供当前稿件的素材、时间和数据；不绑定某位学生、某个院校政策或本机绝对路径。

## 数据图表与已有视频迭代

需要折线、柱形或饼/环形动效时，按需读取`references/chart-motion.md`：先判断趋势、同口径比较或部分与整体关系，再选择图表。没有时间序列不强画折线；不同统计范围的比例不做跨对象排名，不从旁边的人数反推分母。

历史分数、门槛和原稿比例的标签在入场期间保持准确，动画只绘制路径、长度或扇区；保留年份、班型、约数和来源属性。融入已认可3D画面时，仅替换预留数据区中的旧卡片，保持主体和字幕连续。

通用几何函数及SVG覆盖层在`assets/chart-primitives/`。调用方提供当前稿件的数据、原始显示标签、时间、尺度和可用区域。通用组件不绑定学校数据或图片，可按需配合素材库中的PNG使用。修改后检查变化段与边界，最终MP4仍须完整解码。

## 验证

```powershell
npm test
python "<你的 Codex Skills 目录>/.system/skill-creator/scripts/quick_validate.py" .
```

某些真实 Remotion 和媒体回归检查依赖原作者工作区中的外部 fixture；在普通安装副本中会透明跳过，核心合同测试仍会执行。

## 使用许可

仅允许个人非商业安装和使用。禁止商业使用、修改后发布、复制转载、改名再发布、销售、转授权或作为付费产品/服务的一部分提供。详见 [LICENSE](LICENSE)。
