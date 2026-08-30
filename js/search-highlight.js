/**
 * search-highlight.js
 * Destaca todas as ocorrências dos termos pesquisados na página, posiciona
 * suavemente a tela na melhor ocorrência e disponibiliza uma barra flutuante
 * interativa para navegar entre as ocorrências do texto e entre os artigos da busca.
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

  const cleanQuery = rawQuery.trim();
  const queryTerms = cleanQuery
    .split(/\s+/)
    .filter(t => t.length >= 2);

  if (queryTerms.length === 0) return;

  const termsToHighlight = cleanQuery.includes(' ')
    ? [cleanQuery, ...queryTerms]
    : queryTerms;

  let allMarks = [];
  let currentMarkIndex = 0;
  let matchingDocs = [];
  let currentDocIndex = -1;

  function highlightTextNode(node, terms, isPrimaryBlock) {
    const parent = node.parentNode;
    if (!parent) return [];

    const originalText = node.nodeValue;
    if (!originalText || !originalText.trim()) return [];

    const normText = removeAccents(originalText);
    const matches = [];

    for (const term of terms) {
      const normTerm = removeAccents(term);
      if (!normTerm || normTerm.length < 2) continue;

      let startPos = 0;
      while ((startPos = normText.indexOf(normTerm, startPos)) !== -1) {
        matches.push({
          start: startPos,
          end: startPos + normTerm.length
        });
        startPos += normTerm.length;
      }
    }

    if (matches.length === 0) return [];

    matches.sort((a, b) => a.start - b.start);
    const mergedMatches = [];
    let current = { start: matches[0].start, end: matches[0].end };

    for (let i = 1; i < matches.length; i++) {
      const next = matches[i];
      if (next.start <= current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        mergedMatches.push(current);
        current = { start: next.start, end: next.end };
      }
    }
    mergedMatches.push(current);

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const createdMarks = [];

    for (const match of mergedMatches) {
      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.substring(lastIndex, match.start)));
      }
      const mark = document.createElement('mark');
      mark.className = isPrimaryBlock
        ? 'search-highlight-pulse search-highlight-primary'
        : 'search-highlight-term';
      mark.textContent = originalText.substring(match.start, match.end);
      createdMarks.push(mark);
      fragment.appendChild(mark);
      lastIndex = match.end;
    }

    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.substring(lastIndex)));
    }

    parent.replaceChild(fragment, node);
    return createdMarks;
  }

  function goToOccurrence(index, autoScroll = true) {
    if (!allMarks.length) return;
    if (index < 0) index = allMarks.length - 1;
    if (index >= allMarks.length) index = 0;

    allMarks.forEach((m, i) => {
      if (i === index) {
        m.classList.add('search-highlight-pulse', 'search-highlight-primary');
      } else {
        m.classList.remove('search-highlight-pulse', 'search-highlight-primary');
      }
    });

    currentMarkIndex = index;

    const occCounter = document.getElementById('search-nav-occ-counter');
    if (occCounter) {
      occCounter.textContent = `${currentMarkIndex + 1}/${allMarks.length}`;
    }

    if (autoScroll && allMarks[currentMarkIndex]) {
      allMarks[currentMarkIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function renderNavigatorWidget() {
    if (document.getElementById('search-navigator-widget')) return;

    const widget = document.createElement('aside');
    widget.id = 'search-navigator-widget';
    widget.className = 'search-nav-widget';
    widget.setAttribute('aria-label', 'Navegador de pesquisa');

    const totalOccurrences = allMarks.length;
    const initialOccText = totalOccurrences > 0 ? `${currentMarkIndex + 1}/${totalOccurrences}` : '0/0';
    const encodedQuery = encodeURIComponent(cleanQuery);
    const searchPageUrl = `/Search.html?q=${encodedQuery}`;

    widget.innerHTML = `
      <div class="search-nav-content">
        <div class="search-nav-query-group" title="Termo pesquisado: ${cleanQuery}">
          <span class="search-nav-icon">🔍</span>
          <span class="search-nav-query-text">"${cleanQuery}"</span>
        </div>

        <div class="search-nav-divider"></div>

        <div class="search-nav-group search-nav-docs-group">
          <span class="search-nav-label">Textos</span>
          <span class="search-nav-counter" id="search-nav-doc-counter">...</span>
          <div class="search-nav-btn-group">
            <button type="button" class="search-nav-btn" id="search-nav-prev-doc" title="Texto anterior com o termo" aria-label="Texto anterior" disabled>◀</button>
            <button type="button" class="search-nav-btn" id="search-nav-next-doc" title="Próximo texto com o termo" aria-label="Próximo texto" disabled>▶</button>
          </div>
        </div>

        <div class="search-nav-divider"></div>

        <div class="search-nav-group search-nav-occ-group">
          <span class="search-nav-label">No texto</span>
          <span class="search-nav-counter" id="search-nav-occ-counter">${initialOccText}</span>
          <div class="search-nav-btn-group">
            <button type="button" class="search-nav-btn" id="search-nav-prev-occ" title="Ocorrência anterior (Shift+Enter)" aria-label="Ocorrência anterior" ${totalOccurrences <= 1 ? 'disabled' : ''}>▲</button>
            <button type="button" class="search-nav-btn" id="search-nav-next-occ" title="Próxima ocorrência (Enter)" aria-label="Próxima ocorrência" ${totalOccurrences <= 1 ? 'disabled' : ''}>▼</button>
          </div>
        </div>

        <div class="search-nav-divider"></div>

        <div class="search-nav-group search-nav-actions-group">
          <a href="${searchPageUrl}" class="search-nav-btn search-nav-btn-link" title="Ver todos os resultados na página de busca" aria-label="Ver todos os resultados">☰</a>
          <button type="button" class="search-nav-btn search-nav-close-btn" id="search-nav-close" title="Fechar e remover destaques" aria-label="Fechar">✕</button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Eventos de ocorrências no mesmo texto
    const prevOccBtn = document.getElementById('search-nav-prev-occ');
    const nextOccBtn = document.getElementById('search-nav-next-occ');
    if (prevOccBtn) prevOccBtn.addEventListener('click', () => goToOccurrence(currentMarkIndex - 1));
    if (nextOccBtn) nextOccBtn.addEventListener('click', () => goToOccurrence(currentMarkIndex + 1));

    // Evento de fechamento
    const closeBtn = document.getElementById('search-nav-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        widget.remove();
        // Remove os destaques preservando o texto original
        document.querySelectorAll('mark.search-highlight-term, mark.search-highlight-pulse').forEach(m => {
          const text = document.createTextNode(m.textContent);
          m.parentNode.replaceChild(text, m);
        });
        // Remove parâmetro highlight da URL sem recarregar a página
        const url = new URL(window.location.href);
        url.searchParams.delete('highlight');
        url.searchParams.delete('q');
        window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
      });
    }

    // Carrega a lista completa de artigos correspondentes a partir do search.json
    loadMatchingDocuments(cleanQuery);
  }

  async function loadMatchingDocuments(query) {
    try {
      const res = await fetch('/search.json');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const normQuery = removeAccents(query);
      const terms = normQuery.split(/\s+/).filter(t => t.length >= 2);

      const matches = data.filter(item => {
        if (!item || !item.url) return false;
        const normTitle = removeAccents(item.title || '');
        const normContent = removeAccents(item.content || '');
        const fullText = normTitle + ' ' + normContent;

        // Frase completa ou todos os termos
        if (normQuery.length > 2 && fullText.includes(normQuery)) return true;
        return terms.every(t => fullText.includes(t));
      });

      matchingDocs = matches.length > 0 ? matches : data.filter(item => {
        const fullText = removeAccents((item.title || '') + ' ' + (item.content || ''));
        return terms.some(t => fullText.includes(t));
      });

      if (!matchingDocs.length) {
        const docCounter = document.getElementById('search-nav-doc-counter');
        if (docCounter) docCounter.textContent = '1/1';
        return;
      }

      // Localiza o documento atual na lista de resultados
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
      currentDocIndex = matchingDocs.findIndex(doc => {
        const docPath = (doc.url || '').replace(/\/$/, '') || '/';
        return docPath === currentPath || currentPath.endsWith(docPath);
      });

      if (currentDocIndex === -1) currentDocIndex = 0;

      const docCounter = document.getElementById('search-nav-doc-counter');
      if (docCounter) {
        docCounter.textContent = `${currentDocIndex + 1}/${matchingDocs.length}`;
      }

      const prevDocBtn = document.getElementById('search-nav-prev-doc');
      const nextDocBtn = document.getElementById('search-nav-next-doc');

      if (matchingDocs.length > 1) {
        if (prevDocBtn) {
          prevDocBtn.disabled = false;
          prevDocBtn.addEventListener('click', () => {
            const prevIndex = (currentDocIndex - 1 + matchingDocs.length) % matchingDocs.length;
            const targetUrl = new URL(matchingDocs[prevIndex].url, window.location.origin);
            targetUrl.searchParams.set('highlight', cleanQuery);
            window.location.href = targetUrl.pathname + targetUrl.search;
          });
        }
        if (nextDocBtn) {
          nextDocBtn.disabled = false;
          nextDocBtn.addEventListener('click', () => {
            const nextIndex = (currentDocIndex + 1) % matchingDocs.length;
            const targetUrl = new URL(matchingDocs[nextIndex].url, window.location.origin);
            targetUrl.searchParams.set('highlight', cleanQuery);
            window.location.href = targetUrl.pathname + targetUrl.search;
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar lista de artigos da busca:', e);
    }
  }

  function highlightAndScroll() {
    const main = document.getElementById('main-content') || document.body;
    if (!main) return;

    // 1. Identifica o melhor bloco de conteúdo específico (parágrafos, estrofes, cartões, citações)
    const candidateBlocks = main.querySelectorAll(
      'p, blockquote, li, h1, h2, h3, h4, h5, h6, .reflexao-card, .prose-block, .poem-stanza, .text-block'
    );

    const normFullQuery = removeAccents(cleanQuery);
    let bestBlock = null;
    let highestScore = -1;

    const blocksToCheck = candidateBlocks.length > 0 ? Array.from(candidateBlocks) : [main];

    function isNavigationOrMetadataElement(el) {
      if (!el) return false;
      return !!(
        el.closest('#sidebar') ||
        el.closest('.header-nav-container') ||
        el.closest('.search-page-wrapper') ||
        el.closest('nav') ||
        el.closest('#search-navigator-widget') ||
        el.closest('.article-nav') ||
        el.closest('.reflexao-nav-footer') ||
        el.closest('.poetry-nav-footer') ||
        el.closest('.cronicas-nav-footer') ||
        el.closest('.wingene-nav-footer') ||
        el.closest('.pillar-nav') ||
        el.closest('div[style*="justify-content"]') ||
        el.closest('.tags-container') ||
        el.closest('.tag-cloud') ||
        el.closest('.poetry-article-tags') ||
        el.closest('.poetry-tag') ||
        el.closest('.poetry-meta-top') ||
        el.closest('.poetry-reading-bar') ||
        el.closest('.cronicas-meta-pills') ||
        el.closest('.cronicas-reading-bar') ||
        el.closest('.meta-pills') ||
        el.closest('.meta-tags') ||
        el.closest('.tag-pill') ||
        el.closest('footer')
      );
    }

    for (const block of blocksToCheck) {
      if (isNavigationOrMetadataElement(block)) {
        continue;
      }

      const text = removeAccents(block.textContent || '');
      if (!text) continue;

      let score = 0;
      if (normFullQuery.length > 3 && text.includes(normFullQuery)) {
        score = 1000 + normFullQuery.length;
      } else {
        let matchedCount = 0;
        for (const term of queryTerms) {
          if (text.includes(removeAccents(term))) {
            matchedCount++;
          }
        }
        if (matchedCount > 0) {
          score = matchedCount * 50;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestBlock = block;
      }
    }

    // 2. Coleta todos os nós de texto legíveis
    const walker = document.createTreeWalker(
      main,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (isNavigationOrMetadataElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    const allTextNodes = [];
    let n;
    while ((n = walker.nextNode())) {
      allTextNodes.push(n);
    }

    allMarks = [];
    let primaryMarkIndex = 0;

    // 3. Aplica o destaque e cataloga todas as marcas em ordem no documento
    for (const node of allTextNodes) {
      const isInsideBestBlock = bestBlock && (node.parentElement === bestBlock || bestBlock.contains(node.parentElement));
      const marks = highlightTextNode(node, termsToHighlight, isInsideBestBlock);

      for (const m of marks) {
        if (isInsideBestBlock && primaryMarkIndex === 0 && allMarks.length > 0) {
          primaryMarkIndex = allMarks.length;
        }
        allMarks.push(m);
      }
    }

    // 4. Inicia no melhor resultado e posiciona suavemente
    if (allMarks.length > 0) {
      currentMarkIndex = primaryMarkIndex < allMarks.length ? primaryMarkIndex : 0;
      goToOccurrence(currentMarkIndex, true);
    } else if (bestBlock) {
      setTimeout(() => {
        bestBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    // 5. Exibe a barra de navegação flutuante
    renderNavigatorWidget();
  }

  // Atalhos de teclado para navegação rápida (Enter / Shift+Enter / Esc)
  document.addEventListener('keydown', (e) => {
    if (!allMarks.length) return;
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag.toUpperCase())) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToOccurrence(currentMarkIndex - 1);
      } else {
        goToOccurrence(currentMarkIndex + 1);
      }
    } else if (e.key === 'Escape') {
      const closeBtn = document.getElementById('search-nav-close');
      if (closeBtn) closeBtn.click();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(highlightAndScroll, 250));
  } else {
    setTimeout(highlightAndScroll, 250);
  }
})();
