import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect } from 'vitest';
import { createMarkdownParser } from '../../src/engine/markdown-parser';

// Feature: birthday-playlist, Property 11: Unsupported Markdown Fallback

/**
 * Validates: Requirements 12.6
 *
 * For any input string that does not match any supported markdown syntax
 * (headings, bold, italic, links, lists), the MarkdownParser SHALL render
 * the content as plain text wrapped in a `<p>` element.
 */

const parser = createMarkdownParser();

/**
 * Characters that are safe and won't trigger markdown parsing.
 * Excludes: # (headings), * (bold/italic/lists), _ (italic),
 * - (unordered lists), [ (links), and we avoid digits at line start
 * followed by dots (ordered lists).
 */
const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?;:\'"(){}+=@$%^&~`/<>';

const safePunctuation = fc.constantFrom(
  ',', '.', '!', '?', ';', ':', "'", '"', '(', ')', '{', '}',
  '+', '=', '@', '$', '%', '^', '&', '~', '`', '/', '<', '>'
);

/**
 * Arbitrary that generates strings containing only characters that
 * won't trigger any markdown syntax. We build strings from safe characters
 * and ensure they don't accidentally form ordered list patterns (digit + dot + space at start).
 */
const plainTextArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(...safeChars.split('')),
    { minLength: 1, maxLength: 200 }
  )
  .map((chars) => chars.join(''))
  .filter((s) => {
    const trimmed = s.trim();
    // Must have non-whitespace content
    if (trimmed.length === 0) return false;
    // Must not start with # followed by space (heading syntax)
    if (/^#{1,6}\s/.test(trimmed)) return false;
    // Must not start with - or * followed by space (unordered list)
    if (/^[-*]\s/.test(trimmed)) return false;
    // Must not start with digits followed by . and space (ordered list)
    if (/^\d+\.\s/.test(trimmed)) return false;
    // Must not contain ** or __ (bold)
    if (s.includes('**') || s.includes('__')) return false;
    // Must not contain single * or _ wrapping text (italic)
    if (/\*[^*]+\*/.test(s)) return false;
    if (/_[^_]+_/.test(s)) return false;
    // Must not contain [text](url) (link)
    if (/\[.*\]\(.*\)/.test(s)) return false;
    return true;
  });

/** HTML-escape a string the same way the parser does */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('Property 11: Unsupported Markdown Fallback', () => {
  test.prop(
    [plainTextArb],
    { numRuns: 100 },
  )(
    'plain text without markdown syntax is rendered as <p>{escaped text}</p>',
    (input) => {
      const ast = parser.parse(input);
      const html = parser.toHtml(ast);

      // The AST should contain paragraph node(s)
      expect(ast.length).toBeGreaterThan(0);
      for (const node of ast) {
        expect(node.type).toBe('paragraph');
      }

      // The HTML output should be the escaped text wrapped in <p> tags
      const expectedHtml = `<p>${escapeHtml(input)}</p>`;
      expect(html).toBe(expectedHtml);
    }
  );
});
