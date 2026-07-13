import { describe, it, expect } from 'vitest';
import { createPrettyPrinter } from '../../src/engine/pretty-printer';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { MdNode } from '../../src/engine/markdown-parser';

const printer = createPrettyPrinter();
const parser = createMarkdownParser();

describe('PrettyPrinter', () => {
  it('returns empty string for empty AST', () => {
    expect(printer.print([])).toBe('');
  });

  it('prints headings with correct prefix', () => {
    const nodes: MdNode[] = [
      { type: 'heading', level: 1, children: [{ type: 'text', value: 'Title' }] },
      { type: 'heading', level: 3, children: [{ type: 'text', value: 'Sub' }] },
    ];
    expect(printer.print(nodes)).toBe('# Title\n\n### Sub');
  });

  it('prints paragraphs', () => {
    const nodes: MdNode[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'Hello world' }] },
    ];
    expect(printer.print(nodes)).toBe('Hello world');
  });

  it('prints bold and italic inline', () => {
    const nodes: MdNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
          { type: 'text', value: ' and ' },
          { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
        ],
      },
    ];
    expect(printer.print(nodes)).toBe('**bold** and *italic*');
  });

  it('prints links', () => {
    const nodes: MdNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'link', href: 'https://example.com', children: [{ type: 'text', value: 'click' }] },
        ],
      },
    ];
    expect(printer.print(nodes)).toBe('[click](https://example.com)');
  });

  it('prints unordered lists', () => {
    const nodes: MdNode[] = [
      {
        type: 'unordered-list',
        items: [
          { children: [{ type: 'text', value: 'item one' }] },
          { children: [{ type: 'text', value: 'item two' }] },
        ],
      },
    ];
    expect(printer.print(nodes)).toBe('- item one\n- item two');
  });

  it('prints ordered lists', () => {
    const nodes: MdNode[] = [
      {
        type: 'ordered-list',
        items: [
          { children: [{ type: 'text', value: 'first' }] },
          { children: [{ type: 'text', value: 'second' }] },
          { children: [{ type: 'text', value: 'third' }] },
        ],
      },
    ];
    expect(printer.print(nodes)).toBe('1. first\n2. second\n3. third');
  });

  it('separates blocks with blank lines', () => {
    const nodes: MdNode[] = [
      { type: 'heading', level: 2, children: [{ type: 'text', value: 'Title' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'Text here.' }] },
    ];
    expect(printer.print(nodes)).toBe('## Title\n\nText here.');
  });

  it('round-trips: parse(print(ast)) produces equivalent HTML', () => {
    const source = '## Hello\n\nThis is **bold** and *italic*.\n\n- one\n- two';
    const ast = parser.parse(source);
    const printed = printer.print(ast);
    const reparsedAst = parser.parse(printed);

    const originalHtml = parser.toHtml(ast);
    const roundTripHtml = parser.toHtml(reparsedAst);
    expect(roundTripHtml).toBe(originalHtml);
  });

  it('round-trips ordered lists', () => {
    const source = '1. first\n2. second\n3. third';
    const ast = parser.parse(source);
    const printed = printer.print(ast);
    const reparsedAst = parser.parse(printed);

    const originalHtml = parser.toHtml(ast);
    const roundTripHtml = parser.toHtml(reparsedAst);
    expect(roundTripHtml).toBe(originalHtml);
  });

  it('handles nested inline formatting in headings', () => {
    const nodes: MdNode[] = [
      {
        type: 'heading',
        level: 2,
        children: [
          { type: 'text', value: 'A ' },
          { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
          { type: 'text', value: ' heading' },
        ],
      },
    ];
    expect(printer.print(nodes)).toBe('## A **bold** heading');
  });
});
