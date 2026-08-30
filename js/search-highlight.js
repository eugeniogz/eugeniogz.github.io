/**
 * search-highlight.js
 * Posiciona suavemente e destaca o primeiro termo pesquisado ao navegar a partir da busca.
 */
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const rawQuery = urlParams.get('highlight') || urlParams.get('q');
  if (!rawQuery) return;

  function removeAccents(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  const queryTerms = rawQuery
    .trim()
    .split(/\s+/)
    .filter(t => t.length >= 2);

  if (queryTerms.length === 0) return;

  function highlightAndScroll() {
    const main = document.getElementById('main-content') || document.body;
    if (!main) return;

    const walker = document.createTreeWalker(
      main,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'NAV', 'HEADER'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('#sidebar') || parent.closest('.header-nav-container') || parent.closest('.search-page-wrapper')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let targetNode = null;
    let matchWord = null;
    let matchIndex = -1;
    let node;

    while ((node = walker.nextNode())) {
      const normalizedContent = removeAccents(node.nodeValue);
      for (const term of queryTerms) {
        const normalizedTerm = removeAccents(term);
        const idx = normalizedContent.indexOf(normalizedTerm);
        if (idx !== -1) {
          targetNode = node;
          matchWord = term;
          matchIndex = idx;
          break;
        }
      }
      if (targetNode) break;
    }

    if (!targetNode || !targetNode.parentNode) return;

    try {
      const parent = targetNode.parentNode;
      const originalText = targetNode.nodeValue;
      const matchedLength = matchWord.length;

      const beforeText = originalText.substring(0, matchIndex);
      const matchedText = originalText.substring(matchIndex, matchIndex + matchedLength);
      const afterText = originalText.substring(matchIndex + matchedLength);

      const beforeNode = document.createTextNode(beforeText);
      const mark = document.createElement('mark');
      mark.className = 'search-highlight-pulse';
      mark.textContent = matchedText;
      const afterNode = document.createTextNode(afterText);

      parent.insertBefore(beforeNode, targetNode);
      parent.insertBefore(mark, targetNode);
      parent.insertBefore(afterNode, targetNode);
      parent.removeChild(targetNode);

      // Posiciona suavemente o elemento no centro da tela
      setTimeout(() => {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (e) {
      if (targetNode && targetNode.parentElement) {
        targetNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Executa após o carregamento inicial e dá uma margem para templates dinâmicos (como reflexões e contos)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(highlightAndScroll, 250));
  } else {
    setTimeout(highlightAndScroll, 250);
  }
})();
