# Educational Explainer Video Skill

把教育文稿、讲解稿或 SRT 字幕转化为内容驱动的解释型信息动画生产流程。它会从每篇新文稿重新解析人物、物件、动作、概念、关系、公式和数据，而不是默认套用老师、黑板或课堂模板。

## 能做什么

- 生成可验证的 production brief 和 SRT 帧时间轴
- 根据 A/B/C 风险闸门决定完整样片、微样或直接制作
- 提供“标准高效（默认）”与“严格审计”两种审查模式
- 支持 16:9 与 9:16 的独立布局和字幕安全区
- 提供中性的 Remotion starter
- 验证媒体编码、画幅、帧率、帧数、音轨、时长和完整解码

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

## 验证

```powershell
npm test
python "<你的 Codex Skills 目录>/.system/skill-creator/scripts/quick_validate.py" .
```

某些真实 Remotion 和媒体回归检查依赖原作者工作区中的外部 fixture；在普通安装副本中会透明跳过，核心合同测试仍会执行。

## 使用许可

仅允许个人非商业安装和使用。禁止商业使用、修改后发布、复制转载、改名再发布、销售、转授权或作为付费产品/服务的一部分提供。详见 [LICENSE](LICENSE)。
