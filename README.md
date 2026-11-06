# Mermaid Live Split

在 Obsidian 实时预览中，左侧编辑 Mermaid 源码，右侧显示原生实时图表。源码模式和阅读视图保持原有行为。

Edit Mermaid source beside a native live diagram preview in Obsidian Live Preview. Source mode and Reading view retain their standard behavior.

作者 / Author: **赵梁zifiii** · 版本 / Version: **0.16.1** · 许可证 / License: **MIT**

## 环境要求 / Requirements

需要 Obsidian 桌面版 1.15.0 或更新版本。目前未声明支持移动端。

Requires Obsidian desktop 1.15.0 or later. Mobile support is not currently declared.

## 安装 / Installation

社区页面：[Mermaid Live Split](https://community.obsidian.md/plugins/mermaid-live-split)。插件已提交社区并发布页面，自动审核仍在进行。

Community listing: [Mermaid Live Split](https://community.obsidian.md/plugins/mermaid-live-split). The listing is published; automated review is still in progress.

手动安装：从 [GitHub Release](https://github.com/ZiFy/obsidian-mermaid-live-split/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`，放入 `<vault>/.obsidian/plugins/mermaid-live-split/`，然后在「设置 → 第三方插件」中启用 **Mermaid Live Split**。

Manual installation: download `main.js`, `manifest.json`, and `styles.css` from the [GitHub release](https://github.com/ZiFy/obsidian-mermaid-live-split/releases/latest). Place them in `<vault>/.obsidian/plugins/mermaid-live-split/`, then enable **Mermaid Live Split** in Settings → Community plugins.

## 使用 / Usage

在**实时预览**中打开包含顶层 `mermaid` 围栏代码块的笔记。在左侧编辑源码，停止输入约 250 ms 后右侧更新。语法错误会显示在预览中，修正后自动恢复。支持中文输入、行号、Tab 缩进和自动换行。

Open a note containing a top-level fenced `mermaid` block in **Live Preview**. Edit the source on the left; the preview updates after approximately 250 ms without input. Syntax errors appear in the preview and clear after correction. The editor supports Chinese input, line numbers, Tab indentation, and line wrapping.

| 操作 / Action | 效果 / Behavior |
| --- | --- |
| 拖动中间分隔条 / Drag the middle divider | 源码宽度 20%–80% / Source width between 20% and 80% |
| 拖动底部横条 / Drag the bottom handle | 默认高度 440 px，最小 240 px / Default height 440 px, minimum 240 px |
| 双击手柄 / Double-click a handle | 恢复对应默认尺寸 / Reset its dimension |
| 聚焦手柄后按方向键 / Arrow keys on a focused handle | 微调尺寸，Shift 加大步长 / Resize; hold Shift for larger steps |
| Home / End | Home 选择最小值；中线 End 选择最大源码宽度 / Home selects the minimum; End on the middle divider selects maximum source width |
| Cmd/Ctrl+Z；Cmd/Ctrl+Shift+Z 或 Ctrl+Y | 使用笔记历史撤销/重做 / Undo/redo using the host note history |
| Escape | 回到代码块后的正文 / Return focus to the surrounding note |

原生缩放和平移遵循 Obsidian 的渲染设置，保持图表宽高比；是否显示工具栏由宿主配置决定。

Native zoom and pan follow Obsidian’s rendering settings and preserve diagram aspect ratios. Toolbar availability depends on the host configuration.

## 支持范围 / Limitations

尺寸仅保留在当前组件或视图中，重新创建后恢复默认值，不写入笔记。支持闭合的顶层反引号或波浪线围栏；列表、引用中的嵌套围栏以及未闭合围栏保持原始编辑行为。

Dimensions are local to the current widget/view and reset when it is recreated; they are not stored in notes. Complete top-level backtick or tilde fences are supported. Nested fences in lists or blockquotes and unclosed fences retain normal editing behavior.

## 开发与验证 / Development and validation

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

生产插件通过 Obsidian 的 `MarkdownRenderer` 渲染，不打包独立的 Mermaid 运行时。自动化测试覆盖围栏解析、编辑器同步、撤销重做、异步渲染生命周期和尺寸调整。适配器测试使用模拟的 Obsidian API，不等同于运行中 Obsidian 的端到端验证。

The production plugin renders through Obsidian’s `MarkdownRenderer` without bundling a separate Mermaid runtime. Automated tests cover fence parsing, editor synchronization, history, asynchronous rendering lifecycle, and resizing. Adapter tests use a mocked Obsidian API and do not establish end-to-end compatibility inside a running Obsidian application.

## 隐私 / Privacy

插件不会向外部服务发送笔记内容，也不添加分析统计。图表预览交由 Obsidian 渲染。

The plugin does not send note content to external services or add analytics. Preview rendering is delegated to Obsidian.

## 许可证 / License

采用 MIT 许可证，详见 [LICENSE](LICENSE)。

Released under the MIT license; see [LICENSE](LICENSE).
