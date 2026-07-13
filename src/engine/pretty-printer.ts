import type { MdNode, MdInline } from './markdown-parser';

export interface PrettyPrinter {
  /** Convert AST back to markdown string */
  print(nodes: MdNode[]): string;
}

export function createPrettyPrinter(): PrettyPrinter {
  return { print };
}

function print(nodes: MdNode[]): string {
  if (nodes.length === 0) {
    return '';
  }

  return nodes.map(printBlock).join('\n\n');
}

function printBlock(node: MdNode): string {
  switch (node.type) {
    case 'heading':
      return '#'.repeat(node.level) + ' ' + printInlines(node.children);
    case 'paragraph':
      return printInlines(node.children);
    case 'unordered-list':
      return node.items.map((item) => '- ' + printInlines(item.children)).join('\n');
    case 'ordered-list':
      return node.items
        .map((item, index) => `${index + 1}. ` + printInlines(item.children))
        .join('\n');
  }
}

function printInlines(nodes: MdInline[]): string {
  return nodes.map(printInline).join('');
}

function printInline(node: MdInline): string {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'bold':
      return '**' + printInlines(node.children) + '**';
    case 'italic':
      return '*' + printInlines(node.children) + '*';
    case 'link':
      return '[' + printInlines(node.children) + '](' + node.href + ')';
  }
}
