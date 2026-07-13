/** AST node types for supported markdown */
export type MdNode =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "unordered-list"; items: MdListItem[] }
  | { type: "ordered-list"; items: MdListItem[] };

export type MdInline =
  | { type: "text"; value: string }
  | { type: "bold"; children: MdInline[] }
  | { type: "italic"; children: MdInline[] }
  | { type: "link"; href: string; children: MdInline[] };

export interface MdListItem {
  children: MdInline[];
}

export interface MarkdownParser {
  /** Parse markdown string into AST */
  parse(source: string): MdNode[];
  /** Render AST to sanitized HTML string */
  toHtml(nodes: MdNode[]): string;
}

export function createMarkdownParser(): MarkdownParser {
  return {
    parse,
    toHtml,
  };
}

// --- Block-level parsing ---

function parse(source: string): MdNode[] {
  if (!source || source.trim().length === 0) {
    return [];
  }

  const lines = source.split("\n");
  const nodes: MdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading: lines starting with # through ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2]!;
      nodes.push({ type: "heading", level, children: parseInline(content) });
      i++;
      continue;
    }

    // Unordered list: lines starting with `- ` or `* `
    if (/^[-*]\s+/.test(line)) {
      const items: MdListItem[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        const itemContent = lines[i]!.replace(/^[-*]\s+/, "");
        items.push({ children: parseInline(itemContent) });
        i++;
      }
      nodes.push({ type: "unordered-list", items });
      continue;
    }

    // Ordered list: lines starting with `1. `, `2. `, etc.
    if (/^\d+\.\s+/.test(line)) {
      const items: MdListItem[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        const itemContent = lines[i]!.replace(/^\d+\.\s+/, "");
        items.push({ children: parseInline(itemContent) });
        i++;
      }
      nodes.push({ type: "ordered-list", items });
      continue;
    }

    // Everything else: paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.match(/^(#{1,6})\s+/) &&
      !/^[-*]\s+/.test(lines[i]!) &&
      !/^\d+\.\s+/.test(lines[i]!)
    ) {
      paragraphLines.push(lines[i]!);
      i++;
    }
    const paragraphContent = paragraphLines.join(" ");
    nodes.push({ type: "paragraph", children: parseInline(paragraphContent) });
  }

  return nodes;
}

// --- Inline parsing ---

function parseInline(source: string): MdInline[] {
  const nodes: MdInline[] = [];
  let remaining = source;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      nodes.push({ type: "bold", children: parseInline(boldMatch[1]!) });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^\*(.+?)\*/) ?? remaining.match(/^_(.+?)_/);
    if (italicMatch) {
      nodes.push({ type: "italic", children: parseInline(italicMatch[1]!) });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link: [text](url) — handle balanced parentheses in URL
    const linkMatch = matchLink(remaining);
    if (linkMatch) {
      const href = sanitizeUrl(linkMatch.href);
      nodes.push({ type: "link", href, children: parseInline(linkMatch.text) });
      remaining = remaining.slice(linkMatch.fullLength);
      continue;
    }

    // Plain text: consume until next special character
    const nextSpecial = remaining.slice(1).search(/[*_\[]/);
    if (nextSpecial === -1) {
      nodes.push({ type: "text", value: remaining });
      remaining = "";
    } else {
      nodes.push({ type: "text", value: remaining.slice(0, nextSpecial + 1) });
      remaining = remaining.slice(nextSpecial + 1);
    }
  }

  return nodes;
}

// --- HTML rendering ---

function toHtml(nodes: MdNode[]): string {
  if (nodes.length === 0) {
    return "";
  }

  return nodes.map(renderNode).join("");
}

function renderNode(node: MdNode): string {
  switch (node.type) {
    case "heading":
      return `<h${node.level}>${renderInlineNodes(node.children)}</h${node.level}>`;
    case "paragraph":
      return `<p>${renderInlineNodes(node.children)}</p>`;
    case "unordered-list":
      return `<ul>${node.items.map((item) => `<li>${renderInlineNodes(item.children)}</li>`).join("")}</ul>`;
    case "ordered-list":
      return `<ol>${node.items.map((item) => `<li>${renderInlineNodes(item.children)}</li>`).join("")}</ol>`;
  }
}

function renderInlineNodes(nodes: MdInline[]): string {
  return nodes.map(renderInlineNode).join("");
}

function renderInlineNode(node: MdInline): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "bold":
      return `<strong>${renderInlineNodes(node.children)}</strong>`;
    case "italic":
      return `<em>${renderInlineNodes(node.children)}</em>`;
    case "link":
      return `<a href="${escapeAttr(node.href)}" target="_blank" rel="noopener noreferrer">${renderInlineNodes(node.children)}</a>`;
  }
}

// --- Link matching with balanced parentheses ---

interface LinkMatch {
  text: string;
  href: string;
  fullLength: number;
}

function matchLink(source: string): LinkMatch | null {
  if (!source.startsWith("[")) return null;

  // Find closing bracket
  const closeBracket = source.indexOf("]");
  if (closeBracket === -1) return null;

  // Expect `(` immediately after `]`
  if (source[closeBracket + 1] !== "(") return null;

  const text = source.slice(1, closeBracket);
  const urlStart = closeBracket + 2;

  // Find matching closing paren, accounting for balanced parens
  let depth = 1;
  let pos = urlStart;
  while (pos < source.length && depth > 0) {
    if (source[pos] === "(") depth++;
    else if (source[pos] === ")") depth--;
    pos++;
  }

  if (depth !== 0) return null;

  const href = source.slice(urlStart, pos - 1);
  return { text, href, fullLength: pos };
}

// --- Sanitization utilities ---

function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) {
    return "#";
  }
  return url.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sanitize raw HTML output by stripping script tags, on* attributes,
 * and javascript: URLs. Used as a final pass on rendered HTML.
 */
export function sanitizeHtml(html: string): string {
  let result = html;

  // Remove <script> tags and their content
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<script[^>]*\/?>/gi, "");

  // Remove on* event handler attributes
  result = result.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");

  // Replace javascript: protocol in href/src attributes with #
  result = result.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
  result = result.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");

  return result;
}
