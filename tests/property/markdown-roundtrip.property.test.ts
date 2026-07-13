import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect } from 'vitest';
import { createMarkdownParser } from '../../src/engine/markdown-parser';
import type { MdNode, MdInline } from '../../src/engine/markdown-parser';
import { createPrettyPrinter } from '../../src/engine/pretty-printer';

// Feature: birthday-playlist, Property 10: Markdown Round-Trip

/**
 * Validates: Requirements 12.3, 12.4
 *
 * For any valid markdown AST, printing it via the PrettyPrinter and then parsing
 * the result via the MarkdownParser SHALL produce structurally identical HTML output
 * (same element tree with same text content, ignoring whitespace differences).
 */

const parser = createMarkdownParser();
const printer = createPrettyPrinter();

/**
 * Arbitrary for safe text values — non-empty strings without markdown special chars
 * (*, _, #, [, ], (, ), -, digits+dot at line start) to avoid ambiguous round-trips.
 */
const safeAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,;:!?+=&%$@^~';

const safeTextArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...safeAlphabet.split('')), { minLength: 1, maxLength: 15 })
  .map((chars) => chars.join(''))
  .filter((s) => {
    if (/^\d+\./.test(s)) return false;
    if (s.trim().length === 0) return false;
    // Avoid leading/trailing whitespace — the parser trims content in list items and headings
    if (s !== s.trim()) return false;
    return true;
  });

/**
 * Arbitrary for valid link hrefs — avoids parentheses in URL since the markdown
 * parser uses balanced parentheses to detect end of link URLs.
 */
const safePathChars = 'abcdefghijklmnopqrstuvwxyz0123456789/-_.~';
const safeLinkHrefArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('https://example.com', 'http://test.org', 'https://docs.site.io'),
    fc
      .array(fc.constantFrom(...safePathChars.split('')), { minLength: 1, maxLength: 10 })
      .map((chars) => chars.join(''))
  )
  .map(([domain, path]) => `${domain}/${path}`);

/**
 * Generate a leaf text inline node
 */
const textNodeArb: fc.Arbitrary<MdInline> = safeTextArb.map(
  (value): MdInline => ({ type: 'text', value })
);

/**
 * Generate inline nodes at depth 0 (leaf level) — only text nodes.
 */
const leafInlineArb: fc.Arbitrary<MdInline> = textNodeArb;

/**
 * Generate inline nodes at depth 1 — bold, italic, or link wrapping text-only children.
 * These avoid ambiguous nesting issues:
 * - Bold contains only text children (no nested italic that would create ***)
 * - Italic contains only text children (no nested bold/italic that would create **)
 * - Link contains only text children
 */
const depth1InlineArb: fc.Arbitrary<MdInline> = fc.oneof(
  { weight: 4, arbitrary: textNodeArb },
  {
    weight: 2,
    arbitrary: fc
      .array(textNodeArb, { minLength: 1, maxLength: 2 })
      .map((children): MdInline => ({ type: 'bold', children })),
  },
  {
    weight: 2,
    arbitrary: fc
      .array(textNodeArb, { minLength: 1, maxLength: 2 })
      .map((children): MdInline => ({ type: 'italic', children })),
  },
  {
    weight: 1,
    arbitrary: fc
      .tuple(safeLinkHrefArb, fc.array(textNodeArb, { minLength: 1, maxLength: 2 }))
      .map(([href, children]): MdInline => ({ type: 'link', href, children })),
  }
);

/**
 * Generate inline content arrays (1-3 inline nodes at depth 1).
 * This produces inline content that round-trips cleanly because:
 * - No italic-in-italic (would produce ** parsed as bold)
 * - No bold-in-bold (would produce **** ambiguity)
 * - No bold adjacent to italic (could create *** ambiguity)
 *
 * Additional constraint: avoid having bold immediately adjacent to italic
 * (e.g., **text***text* would be ambiguous). We filter to ensure no
 * bold node is immediately followed by italic or vice versa.
 */
const mdInlinesArb: fc.Arbitrary<MdInline[]> = fc
  .array(depth1InlineArb, { minLength: 1, maxLength: 3 })
  .filter((nodes) => {
    // Ensure no bold immediately adjacent to italic or vice versa
    for (let i = 0; i < nodes.length - 1; i++) {
      const curr = nodes[i]!;
      const next = nodes[i + 1]!;
      if (
        (curr.type === 'bold' && next.type === 'italic') ||
        (curr.type === 'italic' && next.type === 'bold')
      ) {
        return false;
      }
    }
    return true;
  });

/**
 * Arbitrary for MdNode block-level nodes
 */
const mdNodeArb: fc.Arbitrary<MdNode> = fc.oneof(
  // Heading (levels 1-6)
  fc
    .tuple(
      fc.integer({ min: 1, max: 6 }) as fc.Arbitrary<1 | 2 | 3 | 4 | 5 | 6>,
      mdInlinesArb
    )
    .map(([level, children]): MdNode => ({ type: 'heading', level, children })),

  // Paragraph
  mdInlinesArb.map((children): MdNode => ({ type: 'paragraph', children })),

  // Unordered list
  fc
    .array(mdInlinesArb, { minLength: 1, maxLength: 4 })
    .map((items): MdNode => ({
      type: 'unordered-list',
      items: items.map((children) => ({ children })),
    })),

  // Ordered list
  fc
    .array(mdInlinesArb, { minLength: 1, maxLength: 4 })
    .map((items): MdNode => ({
      type: 'ordered-list',
      items: items.map((children) => ({ children })),
    }))
);

/**
 * Arbitrary for arrays of 1-10 MdNodes (a full document)
 */
const mdDocumentArb: fc.Arbitrary<MdNode[]> = fc.array(mdNodeArb, {
  minLength: 1,
  maxLength: 10,
});

/**
 * Normalize HTML by collapsing whitespace differences for comparison.
 */
function normalizeHtml(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('Property 10: Markdown Round-Trip', () => {
  test.prop([mdDocumentArb], { numRuns: 100 })(
    'printing AST and re-parsing produces structurally identical HTML output',
    (ast) => {
      // Step 1: Render original AST to HTML
      const originalHtml = parser.toHtml(ast);

      // Step 2: Print AST to markdown string
      const printedMarkdown = printer.print(ast);

      // Step 3: Parse the printed markdown back into AST
      const reparsedAst = parser.parse(printedMarkdown);

      // Step 4: Render re-parsed AST to HTML
      const reparsedHtml = parser.toHtml(reparsedAst);

      // Step 5: Assert structurally identical HTML (ignoring whitespace)
      expect(normalizeHtml(reparsedHtml)).toBe(normalizeHtml(originalHtml));
    }
  );
});
