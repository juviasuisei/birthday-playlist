import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect } from 'vitest';
import { createMarkdownParser, sanitizeHtml } from '../../src/engine/markdown-parser';

// Feature: birthday-playlist, Property 9: Markdown Sanitization

/**
 * Validates: Requirements 7.3
 *
 * For any input string containing <script> tags, on* event handler attributes,
 * or javascript: protocol URLs, the MarkdownParser's HTML output SHALL not
 * contain any executable script content.
 */

const parser = createMarkdownParser();

/** Arbitrary for generating strings containing <script> tags with arbitrary content */
const scriptTagArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 30 }),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 30 })
  )
  .map(([before, scriptContent, after]) => `${before}<script>${scriptContent}</script>${after}`);

/** Arbitrary for generating strings with on* event handler attributes */
const onEventArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(
      'onclick',
      'onmouseover',
      'onload',
      'onerror',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onkeydown',
      'onkeyup'
    ),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.string({ minLength: 0, maxLength: 20 })
  )
  .map(
    ([handler, handlerValue, after]) =>
      `<div ${handler}="${handlerValue}">content</div>${after}`
  );

/** Arbitrary for generating links with javascript: protocol URLs */
const javascriptUrlArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.string({ minLength: 0, maxLength: 30 }),
    fc.string({ minLength: 0, maxLength: 20 })
  )
  .map(
    ([before, jsCode, after]) =>
      `${before}[click me](javascript:${jsCode})${after}`
  );

describe('Property 9: Markdown Sanitization', () => {
  test.prop([scriptTagArb], { numRuns: 100 })(
    'HTML output does not contain <script tags after parsing strings with script tags',
    (input) => {
      const nodes = parser.parse(input);
      const html = parser.toHtml(nodes);

      // The parser escapes HTML, so <script should become &lt;script in output
      expect(html.toLowerCase()).not.toContain('<script');
    }
  );

  test.prop([onEventArb], { numRuns: 100 })(
    'HTML output does not contain on* event handler attributes after parsing strings with event handlers',
    (input) => {
      const nodes = parser.parse(input);
      const html = parser.toHtml(nodes);

      // Verify no on* event attributes remain in actual HTML tags (not escaped text).
      // We look for on* attributes inside real tags: < ... on*= ... >
      // Escaped content like &lt;div onclick=... is safe — it renders as visible text.
      const realTags = html.match(/<[^>]+>/g) || [];
      for (const tag of realTags) {
        expect(tag).not.toMatch(/\s+on[a-z]+\s*=/i);
      }
    }
  );

  test.prop([javascriptUrlArb], { numRuns: 100 })(
    'HTML output does not contain javascript: protocol URLs after parsing strings with javascript: links',
    (input) => {
      const nodes = parser.parse(input);
      const html = parser.toHtml(nodes);

      // Verify no javascript: URLs remain in href or src attributes
      expect(html.toLowerCase()).not.toMatch(/href\s*=\s*["']javascript:/);
      expect(html.toLowerCase()).not.toMatch(/src\s*=\s*["']javascript:/);
    }
  );

  test.prop([scriptTagArb], { numRuns: 100 })(
    'sanitizeHtml removes script tags from arbitrary HTML containing scripts',
    (input) => {
      const sanitized = sanitizeHtml(input);
      expect(sanitized.toLowerCase()).not.toMatch(/<script[\s>]/);
    }
  );

  test.prop([onEventArb], { numRuns: 100 })(
    'sanitizeHtml removes on* event handlers from arbitrary HTML with event attributes',
    (input) => {
      const sanitized = sanitizeHtml(input);
      expect(sanitized).not.toMatch(/\bon[a-z]+\s*=/i);
    }
  );

  test.prop([javascriptUrlArb], { numRuns: 100 })(
    'sanitizeHtml neutralizes javascript: URLs in href/src attributes',
    (input) => {
      // Wrap in an anchor tag to test sanitizeHtml directly with a javascript: URL
      const htmlInput = `<a href="javascript:${input}">link</a>`;
      const sanitized = sanitizeHtml(htmlInput);
      expect(sanitized.toLowerCase()).not.toMatch(/href\s*=\s*["']javascript:/);
    }
  );
});
