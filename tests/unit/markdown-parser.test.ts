import { describe, it, expect } from 'vitest';
import { createMarkdownParser, sanitizeHtml } from '../../src/engine/markdown-parser';

describe('MarkdownParser', () => {
  const parser = createMarkdownParser();

  describe('parse()', () => {
    it('returns empty array for empty string', () => {
      expect(parser.parse('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(parser.parse('   \n\t\n  ')).toEqual([]);
    });

    it('parses a heading level 1', () => {
      const nodes = parser.parse('# Hello');
      expect(nodes).toEqual([
        { type: 'heading', level: 1, children: [{ type: 'text', value: 'Hello' }] },
      ]);
    });

    it('parses heading levels 1 through 6', () => {
      const source = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
      const nodes = parser.parse(source);
      expect(nodes).toHaveLength(6);
      expect(nodes[0]).toMatchObject({ type: 'heading', level: 1 });
      expect(nodes[1]).toMatchObject({ type: 'heading', level: 2 });
      expect(nodes[2]).toMatchObject({ type: 'heading', level: 3 });
      expect(nodes[3]).toMatchObject({ type: 'heading', level: 4 });
      expect(nodes[4]).toMatchObject({ type: 'heading', level: 5 });
      expect(nodes[5]).toMatchObject({ type: 'heading', level: 6 });
    });

    it('parses bold text', () => {
      const nodes = parser.parse('This is **bold** text');
      expect(nodes).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'This is ' },
            { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
            { type: 'text', value: ' text' },
          ],
        },
      ]);
    });

    it('parses italic text with asterisks', () => {
      const nodes = parser.parse('This is *italic* text');
      expect(nodes).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'This is ' },
            { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
            { type: 'text', value: ' text' },
          ],
        },
      ]);
    });

    it('parses italic text with underscores', () => {
      const nodes = parser.parse('This is _italic_ text');
      expect(nodes).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'This is ' },
            { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
            { type: 'text', value: ' text' },
          ],
        },
      ]);
    });

    it('parses links', () => {
      const nodes = parser.parse('Click [here](https://example.com) now');
      expect(nodes).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Click ' },
            { type: 'link', href: 'https://example.com', children: [{ type: 'text', value: 'here' }] },
            { type: 'text', value: ' now' },
          ],
        },
      ]);
    });

    it('parses unordered list with dash', () => {
      const nodes = parser.parse('- Item 1\n- Item 2\n- Item 3');
      expect(nodes).toEqual([
        {
          type: 'unordered-list',
          items: [
            { children: [{ type: 'text', value: 'Item 1' }] },
            { children: [{ type: 'text', value: 'Item 2' }] },
            { children: [{ type: 'text', value: 'Item 3' }] },
          ],
        },
      ]);
    });

    it('parses unordered list with asterisk', () => {
      const nodes = parser.parse('* Item A\n* Item B');
      expect(nodes).toEqual([
        {
          type: 'unordered-list',
          items: [
            { children: [{ type: 'text', value: 'Item A' }] },
            { children: [{ type: 'text', value: 'Item B' }] },
          ],
        },
      ]);
    });

    it('parses ordered list', () => {
      const nodes = parser.parse('1. First\n2. Second\n3. Third');
      expect(nodes).toEqual([
        {
          type: 'ordered-list',
          items: [
            { children: [{ type: 'text', value: 'First' }] },
            { children: [{ type: 'text', value: 'Second' }] },
            { children: [{ type: 'text', value: 'Third' }] },
          ],
        },
      ]);
    });

    it('parses multiple paragraphs separated by blank lines', () => {
      const nodes = parser.parse('First paragraph\n\nSecond paragraph');
      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toMatchObject({ type: 'paragraph' });
      expect(nodes[1]).toMatchObject({ type: 'paragraph' });
    });

    it('parses inline formatting within list items', () => {
      const nodes = parser.parse('- **Bold** item\n- *Italic* item');
      expect(nodes).toEqual([
        {
          type: 'unordered-list',
          items: [
            {
              children: [
                { type: 'bold', children: [{ type: 'text', value: 'Bold' }] },
                { type: 'text', value: ' item' },
              ],
            },
            {
              children: [
                { type: 'italic', children: [{ type: 'text', value: 'Italic' }] },
                { type: 'text', value: ' item' },
              ],
            },
          ],
        },
      ]);
    });

    it('sanitizes javascript: URLs in links to #', () => {
      const nodes = parser.parse('[click](javascript:alert(1))');
      expect(nodes).toEqual([
        {
          type: 'paragraph',
          children: [
            { type: 'link', href: '#', children: [{ type: 'text', value: 'click' }] },
          ],
        },
      ]);
    });
  });

  describe('toHtml()', () => {
    it('returns empty string for empty node array', () => {
      expect(parser.toHtml([])).toBe('');
    });

    it('returns empty string for empty/whitespace input through full pipeline', () => {
      const nodes = parser.parse('');
      expect(parser.toHtml(nodes)).toBe('');
    });

    it('renders heading', () => {
      const nodes = parser.parse('## Title');
      expect(parser.toHtml(nodes)).toBe('<h2>Title</h2>');
    });

    it('renders paragraph with bold', () => {
      const nodes = parser.parse('Hello **world**');
      expect(parser.toHtml(nodes)).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('renders paragraph with italic', () => {
      const nodes = parser.parse('Hello *world*');
      expect(parser.toHtml(nodes)).toBe('<p>Hello <em>world</em></p>');
    });

    it('renders link with target="_blank" and rel="noopener noreferrer"', () => {
      const nodes = parser.parse('[Google](https://google.com)');
      expect(parser.toHtml(nodes)).toBe(
        '<p><a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a></p>'
      );
    });

    it('renders unordered list', () => {
      const nodes = parser.parse('- A\n- B');
      expect(parser.toHtml(nodes)).toBe('<ul><li>A</li><li>B</li></ul>');
    });

    it('renders ordered list', () => {
      const nodes = parser.parse('1. A\n2. B');
      expect(parser.toHtml(nodes)).toBe('<ol><li>A</li><li>B</li></ol>');
    });

    it('escapes HTML entities in text content', () => {
      const nodes = parser.parse('Use <script> and & in text');
      expect(parser.toHtml(nodes)).toBe('<p>Use &lt;script&gt; and &amp; in text</p>');
    });

    it('renders unsupported content as plain text in <p> element', () => {
      const nodes = parser.parse('Just some plain text');
      expect(parser.toHtml(nodes)).toBe('<p>Just some plain text</p>');
    });

    it('replaces javascript: URLs with # in rendered links', () => {
      const nodes = parser.parse('[evil](javascript:alert(1))');
      expect(parser.toHtml(nodes)).toBe(
        '<p><a href="#" target="_blank" rel="noopener noreferrer">evil</a></p>'
      );
    });
  });

  describe('sanitizeHtml()', () => {
    it('removes script tags with content', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      expect(sanitizeHtml(input)).toBe('<p>Hello</p><p>World</p>');
    });

    it('removes self-closing script tags', () => {
      const input = '<p>Hello</p><script src="evil.js"/><p>World</p>';
      expect(sanitizeHtml(input)).toBe('<p>Hello</p><p>World</p>');
    });

    it('removes on* event attributes', () => {
      const input = '<div onclick="alert(1)" onmouseover="hack()">content</div>';
      expect(sanitizeHtml(input)).toBe('<div>content</div>');
    });

    it('replaces javascript: URLs in href with #', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      expect(sanitizeHtml(input)).toBe('<a href="#">click</a>');
    });

    it('replaces javascript: URLs in src with #', () => {
      const input = '<img src="javascript:alert(1)">';
      expect(sanitizeHtml(input)).toBe('<img src="#">');
    });
  });
});
