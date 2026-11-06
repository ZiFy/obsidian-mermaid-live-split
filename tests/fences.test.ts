import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMermaidBlocks } from '../src/fences';

test('reports exact document and code offsets for multiple fences', () => {
  const text = 'intro\n```mermaid\ngraph TD\n```\ntext\n~~~MERMAID\na-->b\n~~~\nend';
  assert.deepEqual(findMermaidBlocks(text), [
    { from: 6, to: 29, codeFrom: 17, codeTo: 25, code: 'graph TD' },
    { from: 35, to: 55, codeFrom: 46, codeTo: 51, code: 'a-->b' },
  ]);
});

test('ignores nested examples, wrong markers, short closers and unclosed fences', () => {
  assert.deepEqual(findMermaidBlocks('````markdown\n```mermaid\ngraph TD\n```\n````'), []);
  assert.deepEqual(findMermaidBlocks('    ```mermaid\na-->b\n    ```'), []);
  assert.deepEqual(findMermaidBlocks('```mermaid extra\na-->b\n```'), []);
  assert.deepEqual(findMermaidBlocks('```mermaid\na-->b'), []);
  const text = '  ````mermaid\ngraph TD\n```\n~~~\n  `````  ';
  assert.equal(findMermaidBlocks(text)[0]?.code, 'graph TD\n```\n~~~');
});

test('handles CRLF, empty blocks and a closing fence at EOF', () => {
  const text = '```mermaid\r\ngraph TD\r\n```';
  assert.deepEqual(findMermaidBlocks(text), [
    { from: 0, to: 25, codeFrom: 12, codeTo: 20, code: 'graph TD' },
  ]);
  for (const source of ['```mermaid\n```', '~~~mermaid\r\n~~~']) {
    const [block] = findMermaidBlocks(source);
    assert.equal(block.code, '');
    assert.equal(block.codeFrom, block.codeTo);
  }
});

test('preserves Chinese mindmap and styled flowchart source as independent fences', () => {
  const text = ['```mermaid', 'mindmap', '  root((团队计划))', '    架构', '      设计', '```', '',
    '```mermaid', 'flowchart TD', '  classDef base fill:#A7D8F0,stroke:#5FA8D3',
    '  subgraph 基座主流程', '    A[软件工厂]:::base --> B[规划]:::base', '  end', '```'].join('\n');
  const blocks = findMermaidBlocks(text);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].code, /^mindmap\n/);
  assert.match(blocks[1].code, /^flowchart TD\n/);
  assert.match(blocks[0].code, /团队计划/);
  assert.match(blocks[1].code, /classDef base/);
  for (const block of blocks) {
    assert.equal(text.slice(block.codeFrom, block.codeTo), block.code);
    assert.match(text.slice(block.from, block.to), /^```mermaid\n[\s\S]*\n```$/);
  }
});
