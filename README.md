# Mermaid Live Split

Edit Mermaid source beside a live diagram preview in Obsidian Live Preview. Rendering uses Obsidian’s native Markdown renderer. Source mode and Reading view retain their standard behavior.

Author: 赵梁zifiii · Version: 0.16.0 · License: MIT

## Requirements

Obsidian desktop 1.15.0 or later. Mobile support is not currently declared.

## Installation

Until the plugin is accepted into the community directory, download `main.js`, `manifest.json`, and `styles.css` from a GitHub release. Place them in `<vault>/.obsidian/plugins/mermaid-live-split/`, then enable **Mermaid Live Split** in Settings → Community plugins.

## Usage

Open a note in **Live Preview** containing a top-level fenced `mermaid` block. Edit its source in the left pane; the right pane updates after approximately 250 ms without input. Syntax errors appear in the preview and clear after correction.

- Drag the middle divider to adjust the source width between 20% and 80%.
- Drag the bottom handle to adjust height; default 440 px, minimum 240 px.
- Double-click either handle to reset its dimension.
- Focus a handle and use arrow keys to resize. Hold Shift for larger steps. Home selects the minimum; End selects the maximum source width.
- Undo and redo use the host note’s history. Escape returns focus to the surrounding note.
- Native diagram zoom and pan follow Obsidian’s rendering settings. The plugin preserves diagram aspect ratios.

Dimensions are local to the current widget/view and reset when it is recreated. They are not stored in notes. Only complete top-level backtick or tilde fences are supported; nested fences in lists or blockquotes retain normal editing behavior.

## 中文说明

在 Obsidian **编辑模式 → 实时预览**中，Mermaid 代码块显示为左侧源码、右侧原生图表。拖动中间分隔条调整左右比例，拖动底部横条调整高度，双击恢复默认尺寸。支持中文输入、行号、Tab 缩进、撤销重做与键盘调整尺寸。源码模式和阅读视图保持原有行为。

需要 Obsidian 桌面版 1.15.0 或更新版本。尺寸只保留在当前视图，不写入笔记。尚未支持列表或引用内的嵌套代码块。

## Development

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The production bundle delegates rendering to `MarkdownRenderer` and does not bundle a separate Mermaid runtime. Automated tests cover fence parsing, nested editor synchronization, history, asynchronous render lifecycle, and resizing. Adapter tests use a mocked Obsidian API; they do not establish end-to-end compatibility inside a running Obsidian application.

## Privacy

The plugin does not send note content to external services or add analytics. Preview rendering is delegated to Obsidian.

## License

MIT — see [LICENSE](LICENSE).
