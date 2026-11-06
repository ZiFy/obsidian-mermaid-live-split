export interface MermaidBlock {
  from: number;
  to: number;
  codeFrom: number;
  codeTo: number;
  code: string;
}

/** Ignore Mermaid-looking text inside other fenced code blocks. */
export function findMermaidBlocks(text: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let offset = 0;
  let fence: { marker: string; length: number; from: number; codeFrom: number; mermaid: boolean } | undefined;
  for (const line of text.split('\n')) {
    if (!fence) {
      const opening = /^( {0,3})(\x60{3,}|~{3,})([^\r]*)\r?$/.exec(line);
      if (opening) {
        fence = { marker: opening[2][0], length: opening[2].length, from: offset,
          codeFrom: offset + line.length + 1, mermaid: /^mermaid\s*$/i.test(opening[3].trim()) };
      }
    } else {
      const closing = /^( {0,3})(\x60+|~+)[ \t]*\r?$/.exec(line);
      if (closing && closing[2][0] === fence.marker && closing[2].length >= fence.length) {
        if (fence.mermaid) {
          const codeFrom = Math.min(fence.codeFrom, offset);
          const codeTo = Math.max(codeFrom, offset - (text[offset - 2] === '\r' ? 2 : 1));
          blocks.push({ from: fence.from, to: offset + line.length, codeFrom, codeTo,
            code: text.slice(codeFrom, codeTo) });
        }
        fence = undefined;
      }
    }
    offset += line.length + 1;
  }
  return blocks;
}
