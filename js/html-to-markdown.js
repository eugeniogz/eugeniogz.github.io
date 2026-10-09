/**
 * html-to-markdown.js
 * Conversor leve e fiel de elementos DOM HTML para Markdown.
 * Usado para copiar conteúdos preservando formatação (títulos, negrito, itálico, listas, links, etc).
 */
(function(window) {
  'use strict';

  function wrapInline(text, marker) {
    if (!text) return '';
    // Preserva espaços nas pontas para não quebrar a sintaxe Markdown
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match || !match[2]) return text;
    return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
  }

  function htmlToMarkdown(element) {
    if (!element) return '';

    function processNode(node) {
      if (node.nodeType === 3) { // Node.TEXT_NODE
        return node.nodeValue;
      }
      if (node.nodeType !== 1) { // Node.ELEMENT_NODE
        return '';
      }

      const tag = (node.tagName || '').toLowerCase();

      // Ignora tags invisíveis, scripts, estilos ou controles
      if (
        ['script', 'style', 'noscript', 'button', 'svg', 'path'].includes(tag) ||
        (node.style && node.style.display === 'none') ||
        (node.classList && (
          node.classList.contains('no-copy') ||
          node.classList.contains('cronicas-reading-bar') ||
          node.classList.contains('wingene-reading-bar') ||
          node.classList.contains('ipes-reading-bar') ||
          node.classList.contains('poetry-reading-bar')
        ))
      ) {
        return '';
      }

      let childrenText = '';
      for (let i = 0; i < node.childNodes.length; i++) {
        childrenText += processNode(node.childNodes[i]);
      }

      switch (tag) {
        case 'h1': return `\n\n# ${childrenText.trim()}\n\n`;
        case 'h2': return `\n\n## ${childrenText.trim()}\n\n`;
        case 'h3': return `\n\n### ${childrenText.trim()}\n\n`;
        case 'h4': return `\n\n#### ${childrenText.trim()}\n\n`;
        case 'h5': return `\n\n##### ${childrenText.trim()}\n\n`;
        case 'h6': return `\n\n###### ${childrenText.trim()}\n\n`;

        case 'p':
          return `\n\n${childrenText.trim()}\n\n`;

        case 'strong':
        case 'b':
          return wrapInline(childrenText, '**');

        case 'em':
        case 'i':
          return wrapInline(childrenText, '*');

        case 'del':
        case 's':
          return wrapInline(childrenText, '~~');

        case 'code':
          return (node.parentNode && node.parentNode.tagName.toLowerCase() === 'pre')
            ? childrenText
            : wrapInline(childrenText, '`');

        case 'pre': {
          const codeEl = node.querySelector ? node.querySelector('code') : null;
          const langMatch = (codeEl ? codeEl.className : node.className || '').match(/language-([a-z0-9_-]+)/i);
          const lang = langMatch ? langMatch[1] : '';
          const codeText = node.innerText ? node.innerText.trim() : childrenText.trim();
          return `\n\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
        }

        case 'blockquote': {
          const lines = childrenText.trim().split('\n');
          const quoted = lines.map(line => line.trim() ? `> ${line.trim()}` : '>').join('\n');
          return `\n\n${quoted}\n\n`;
        }

        case 'a': {
          const href = node.getAttribute('href');
          const text = childrenText.trim();
          if (!href || !text || href.startsWith('javascript:')) return text || '';
          return `[${text}](${href})`;
        }

        case 'ul':
        case 'ol':
          return `\n\n${childrenText.trim()}\n\n`;

        case 'li': {
          const isOrdered = node.parentNode && node.parentNode.tagName.toLowerCase() === 'ol';
          const siblings = Array.from(node.parentNode ? node.parentNode.children : []).filter(c => c.tagName.toLowerCase() === 'li');
          const index = siblings.indexOf(node) + 1;
          const prefix = isOrdered ? `${index || 1}. ` : `- `;
          return `${prefix}${childrenText.trim()}\n`;
        }

        case 'hr':
          return `\n\n---\n\n`;

        case 'br':
          return `  \n`;

        case 'img': {
          const alt = node.getAttribute('alt') || '';
          const src = node.getAttribute('src') || '';
          return src ? `![${alt}](${src})` : '';
        }

        case 'table':
          return `\n\n${childrenText.trim()}\n\n`;

        case 'tr': {
          const cells = Array.from(node.children)
            .filter(c => ['td', 'th'].includes(c.tagName.toLowerCase()))
            .map(c => processNode(c).trim());
          if (cells.length === 0) return '';
          const row = `| ${cells.join(' | ')} |`;
          const isHeader = Array.from(node.children).some(c => c.tagName.toLowerCase() === 'th');
          if (isHeader) {
            const separator = `| ${cells.map(() => '---').join(' | ')} |`;
            return `${row}\n${separator}\n`;
          }
          return `${row}\n`;
        }

        case 'th':
        case 'td':
          return childrenText.trim();

        default:
          return childrenText;
      }
    }

    const rawMd = processNode(element);
    return rawMd
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.replace(/^[ \t]+/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  window.htmlToMarkdown = htmlToMarkdown;
})(typeof window !== 'undefined' ? window : globalThis);
