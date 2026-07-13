import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect } from 'vitest';
import { createMarkdownParser } from '../../src/engine/markdown-parser';

// Feature: birthday-playlist, Property 8: Empty Input Produces Empty Output

/**
 * Validates: Requirements 7.2, 12.5
 *
 * For any string that is empty or composed entirely of whitespace characters,
 * the MarkdownParser SHALL return an empty array from parse(), and toHtml()
 * SHALL return an empty string.
 */

const parser = createMarkdownParser();

/** Arbitrary for generating whitespace-only strings (spaces, tabs, newlines in various combinations) */
const whitespaceOnlyArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r', '\r\n'), { minLength: 0, maxLength: 100 })
  .map((chars) => chars.join(''));

describe('Property 8: Empty Input Produces Empty Output', () => {
  test.prop(
    [whitespaceOnlyArb],
    { numRuns: 100 },
  )(
    'empty or whitespace-only input produces empty AST and empty HTML',
    (input) => {
      const ast = parser.parse(input);
      const html = parser.toHtml(ast);

      // parse() SHALL return an empty array
      expect(ast).toEqual([]);

      // toHtml() SHALL return an empty string
      expect(html).toBe('');
    }
  );
});
