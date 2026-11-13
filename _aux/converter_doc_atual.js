/**
 * ==============================================================================
 * CONVERSOR INDIVIDUAL DE GOOGLE DOCS PARA MARKDOWN (COM MENU NO GOOGLE DOCS)
 * ==============================================================================
 * Este script adiciona um menu personalizado ao Google Docs ("📝 Markdown") para
 * converter o documento aberto diretamente em arquivo Markdown (.md) com front matter
 * Jekyll, preservando negrito, itálico, cabeçalhos, listas, tabelas, imagens e metadados.
 *
 * COMO USAR:
 * 1. No Google Docs, abra o documento que deseja converter.
 * 2. Acesse o menu: "Extensões" > "Apps Script".
 * 3. Cole todo o código deste arquivo no editor.
 * 4. Salve (Ctrl + S) com um nome (ex: "Conversor Markdown").
 * 5. Recarregue o documento no navegador (F5).
 * 6. Um novo menu "📝 Markdown" aparecerá na barra superior!
 * ==============================================================================
 */

// --- CONFIGURAÇÕES GERAIS ---
const CAMINHO_SITE_DESTINO = "Pessoal/Meus.Sites/eugeniogz.github.io";
const PASTA_FONTE_BASE = "Pessoal/Meus.Textos";
const MIME_MARKDOWN = MimeType.PLAIN_TEXT;

// REGEX PARA EXTRAÇÃO DE METADADOS
const REGEX_ORDENACAO = /Ordenação:\s*(\d+([.,]\d+)?)/i;
const REGEX_SPLIT_COMENTARIO = /^([^:]+):\s*(.*)$/;

/**
 * Renderiza o painel lateral do complemento em qualquer documento do Google Docs.
 */
function onDocsHomepage(e) {
  const doc = DocumentApp.getActiveDocument();
  const nomeDoc = doc ? doc.getName() : "Documento";

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("📝 Conversor Markdown"))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(`<b>Documento aberto:</b><br>${nomeDoc}`))
        .addWidget(
          CardService.newTextButton()
            .setText("⚡ Converter e Salvar no Drive")
            .setOnClickAction(CardService.newAction().setFunctionName("acaoConverterCard"))
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
        .addWidget(
          CardService.newTextButton()
            .setText("📋 Copiar Markdown (Janela)")
            .setOnClickAction(CardService.newAction().setFunctionName("acaoCopiarCard"))
        )
    );

  return card.build();
}

function acaoConverterCard() {
  converterDocumentoAtualParaMarkdown();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("✅ Convertido e salvo com sucesso!"))
    .build();
}

function acaoCopiarCard() {
  exibirMarkdownModal();
  return CardService.newActionResponseBuilder().build();
}
/**
 * Evento disparado quando o complemento é instalado pelo usuário.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Evento disparado automaticamente ao abrir o documento no Google Docs.
 * - Quando instalado como Extensão/Complemento independente: adiciona a opção no menu "Extensões".
 * - Quando vinculado a um documento específico: cria o menu próprio "📝 Markdown" no topo.
 */
function onOpen(e) {
  const ui = DocumentApp.getUi();
  try {
    ui.createAddonMenu()
      .addItem('⚡ Converter e Salvar no Drive/GitHub', 'converterDocumentoAtualParaMarkdown')
      .addSeparator()
      .addItem('📋 Ver e Copiar Markdown (Janela)', 'exibirMarkdownModal')
      .addToUi();
  } catch (err) {
    ui.createMenu('📝 Markdown')
      .addItem('⚡ Converter e Salvar no Drive/GitHub', 'converterDocumentoAtualParaMarkdown')
      .addSeparator()
      .addItem('📋 Ver e Copiar Markdown (Janela)', 'exibirMarkdownModal')
      .addToUi();
  }
}

/**
 * Função principal chamada pelo menu para converter o documento aberto e salvá-lo no Drive.
 */
function converterDocumentoAtualParaMarkdown() {
  const ui = DocumentApp.getUi();

  try {
    const doc = DocumentApp.getActiveDocument();
    if (!doc) {
      ui.alert('Erro', 'Nenhum documento ativo encontrado.', ui.ButtonSet.OK);
      return;
    }

    const docId = doc.getId();
    const docFile = DriveApp.getFileById(docId);
    const nomeDocOriginal = doc.getName();

    // 1. Determina a pasta de destino correspondente
    const pastaDestinoInfo = determinarPastaDestino(docFile);
    const pastaDestino = pastaDestinoInfo.pasta;
    const isPostsFolder = pastaDestinoInfo.isPosts;

    // 2. Determina o nome do arquivo .md (slug)
    const nomeDocLimpo = nomeDocOriginal.replace(/\.(md|html|tex)$/i, '');
    const nomeSlug = slugifyFileName(nomeDocLimpo);
    let nomeMarkdown = `${nomeSlug}.md`;

    // Se for pasta de posts, adiciona a data YYYY-MM-DD se ainda não estiver no slug
    if (isPostsFolder) {
      const dateObj = docFile.getLastUpdated();
      const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (!/^\d{4}-\d{2}-\d{2}-/.test(nomeSlug)) {
        nomeMarkdown = `${dateStr}-${nomeSlug}.md`;
      }
    }

    // 3. Converte o documento para Markdown
    const resultado = getMarkdownFromActiveDoc(doc, docFile, nomeDocOriginal, nomeSlug, pastaDestino);
    const conteudoMarkdown = resultado.markdownContent;

    // 4. Salva ou atualiza o arquivo .md na pasta de destino
    let arquivoCriadoOuAtualizado = null;
    let acaoRealizada = 'criado';

    const arquivosExistentes = pastaDestino.getFilesByName(nomeMarkdown);
    if (arquivosExistentes.hasNext()) {
      arquivoCriadoOuAtualizado = arquivosExistentes.next();
      arquivoCriadoOuAtualizado.setContent(conteudoMarkdown);
      acaoRealizada = 'atualizado';
    } else {
      arquivoCriadoOuAtualizado = pastaDestino.createFile(nomeMarkdown, conteudoMarkdown, MIME_MARKDOWN);
      acaoRealizada = 'criado';
    }

    // 5. Mensagem de sucesso ao usuário
    const caminhoDestinoExibicao = pastaDestinoInfo.caminhoExibicao || pastaDestino.getName();
    const msg = `✅ Arquivo Markdown ${acaoRealizada} com sucesso!\n\n` +
      `📄 Nome: ${nomeMarkdown}\n` +
      `📁 Pasta Destino: ${caminhoDestinoExibicao}\n` +
      `⏱️ Tempo de Leitura: ${resultado.tempoLeitura} min\n` +
      `🏷️ Tags: ${resultado.tags.length > 0 ? resultado.tags.join(', ') : 'Nenhuma'}\n\n` +
      `Link do arquivo: ${arquivoCriadoOuAtualizado.getUrl()}`;

    ui.alert('Conversão Concluída!', msg, ui.ButtonSet.OK);

  } catch (error) {
    Logger.log('Erro na conversão: ' + error.toString());
    ui.alert('Erro na Conversão', 'Ocorreu um erro ao processar o documento:\n' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Exibe o Markdown gerado em uma janela modal com botão para copiar diretamente.
 */
function exibirMarkdownModal() {
  const ui = DocumentApp.getUi();

  try {
    const doc = DocumentApp.getActiveDocument();
    if (!doc) {
      ui.alert('Erro', 'Nenhum documento ativo encontrado.', ui.ButtonSet.OK);
      return;
    }

    const docId = doc.getId();
    const docFile = DriveApp.getFileById(docId);
    const nomeDocOriginal = doc.getName();
    const pastaDestinoInfo = determinarPastaDestino(docFile);
    const nomeSlug = slugifyFileName(nomeDocOriginal.replace(/\.(md|html|tex)$/i, ''));

    const resultado = getMarkdownFromActiveDoc(doc, docFile, nomeDocOriginal, nomeSlug, pastaDestinoInfo.pasta);

    const escapeHtml = (str) => {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 16px; color: #1e293b; }
          h3 { margin-top: 0; color: #0f172a; display: flex; align-items: center; gap: 8px; }
          textarea { width: 100%; height: 380px; box-sizing: border-box; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; resize: vertical; }
          .actions { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
          button { background: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
          button:hover { background: #1d4ed8; }
          .copied-badge { color: #16a34a; font-size: 13px; font-weight: 600; display: none; }
        </style>
      </head>
      <body>
        <h3><span>📝</span> Prévia do Markdown Gerado</h3>
        <textarea id="markdownArea" readonly>${escapeHtml(resultado.markdownContent)}</textarea>
        <div class="actions">
          <button type="button" onclick="copiarMarkdown()">📋 Copiar para Área de Transferência</button>
          <span id="copiedMsg" class="copied-badge">✓ Copiado!</span>
        </div>
        <script>
          function copiarMarkdown() {
            var copyText = document.getElementById("markdownArea");
            copyText.select();
            copyText.setSelectionRange(0, 999999);
            document.execCommand("copy");
            var msg = document.getElementById("copiedMsg");
            msg.style.display = "inline";
            setTimeout(function() { msg.style.display = "none"; }, 2500);
          }
        </script>
      </body>
      </html>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(720)
      .setHeight(500);

    ui.showModalDialog(htmlOutput, 'Markdown: ' + nomeDocOriginal);

  } catch (error) {
    ui.alert('Erro', 'Não foi possível gerar a prévia:\n' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Determina onde o arquivo Markdown deve ser salvo:
 * 1. Tenta espelhar o caminho da pasta fonte no caminho do site Jekyll (CAMINHO_SITE_DESTINO).
 * 2. Se não encontrar ou não estiver sob a pasta fonte padrão, salva na mesma pasta do próprio documento no Drive.
 */
/**
 * Localiza a pasta raiz do site ("eugeniogz.github.io") no Google Drive.
 * 1. Tenta pelo caminho completo configurado ("Pessoal/Meus.Sites/eugeniogz.github.io").
 * 2. Tenta por busca direta do nome da pasta em todo o Google Drive.
 * 3. Se não encontrar, lança um erro crítico para JAMAIS salvar em local indevido.
 */
function obterPastaRaizSite() {
  // 1. Tenta pelo caminho completo
  if (CAMINHO_SITE_DESTINO) {
    const pastaPorCaminho = encontrarCriarPastaPorCaminho(CAMINHO_SITE_DESTINO, false);
    if (pastaPorCaminho) {
      return pastaPorCaminho;
    }
  }

  // 2. Busca direta por nome da pasta em todo o Drive (elimina falhas caso "Pessoal" ou "Meus.Sites" variem de nível)
  const nomePastaFinal = CAMINHO_SITE_DESTINO.split('/').pop().trim();
  const pastasEncontradas = DriveApp.getFoldersByName(nomePastaFinal);
  while (pastasEncontradas.hasNext()) {
    const f = pastasEncontradas.next();
    if (!f.isTrashed()) {
      Logger.log(`[PASTA SITE LOCALIZADA] ID: ${f.getId()} - Nome: ${f.getName()}`);
      return f;
    }
  }

  // 3. Trava de segurança: lança erro explícito e nunca permite salvar na pasta do próprio doc
  throw new Error(
    `[ERRO CRÍTICO] A pasta de destino do site ("${CAMINHO_SITE_DESTINO}") não foi encontrada no seu Google Drive.\n\n` +
    `A conversão foi cancelada para evitar salvar na pasta de origem dos textos.`
  );
}

/**
 * Determina onde o arquivo Markdown DEVE ser salvo:
 * 1. Mapeia a hierarquia da pasta fonte (sob "Wingene" ou "Meus.Textos") para o site de destino.
 * 2. Valida com trava de segurança para NUNCA salvar na pasta de origem do Google Doc.
 */
function determinarPastaDestino(docFile) {
  const pastaRaizSite = obterPastaRaizSite();

  const parents = docFile.getParents();
  if (!parents.hasNext()) {
    throw new Error("[ERRO] Não foi possível identificar a pasta de origem do documento no Drive.");
  }

  const pastaDoc = parents.next();
  const idPastaDoc = pastaDoc.getId();

  // 1. Coleta a cadeia de pastas ancestrais a partir da pasta do doc até 'Wingene' ou 'Meus.Textos'
  const cadeiaPastas = [];
  let atual = pastaDoc;
  const nomesRaizTexto = ['wingene', 'meus.textos', 'meustextos', 'textos'];

  while (atual) {
    const nomeAtual = atual.getName();
    if (nomesRaizTexto.includes(nomeAtual.toLowerCase())) {
      break;
    }
    cadeiaPastas.unshift(nomeAtual);

    const pais = atual.getParents();
    if (pais.hasNext()) {
      atual = pais.next();
    } else {
      break;
    }
  }

  // Se o doc estiver na raiz dos textos (ex: direto em 'Wingene'), o destino é a própria raiz do site
  if (cadeiaPastas.length === 0) {
    if (pastaRaizSite.getId() === idPastaDoc) {
      throw new Error(`[ERRO DE SEGURANÇA] A pasta do documento é a própria raiz do site. Operação abortada.`);
    }
    return {
      pasta: pastaRaizSite,
      isPosts: false,
      caminhoExibicao: pastaRaizSite.getName()
    };
  }

  // 2. Mapeia e navega (ou cria) as subpastas correspondentes dentro de pastaRaizSite
  let pastaDestinoAtual = pastaRaizSite;
  let isPosts = false;
  const partesCaminhoExibicao = [pastaRaizSite.getName()];

  for (let i = 0; i < cadeiaPastas.length; i++) {
    const nomePastaFonte = cadeiaPastas[i];
    let nomePastaDestino;

    if (nomePastaFonte === '_posts') {
      nomePastaDestino = '_posts';
      isPosts = true;
    } else {
      // Remove anotações após dois pontos ex: "poesias_e_aforismos: versos" -> "poesias_e_aforismos"
      const nomeSemComentario = splitComentario(nomePastaFonte.replace(/_/g, ' '))[0];
      nomePastaDestino = slugifyFileName(nomeSemComentario);
    }

    if (!nomePastaDestino) continue;

    const subpastas = pastaDestinoAtual.getFoldersByName(nomePastaDestino);
    if (subpastas.hasNext()) {
      pastaDestinoAtual = subpastas.next();
    } else {
      pastaDestinoAtual = pastaDestinoAtual.createFolder(nomePastaDestino);
      Logger.log(`[CRIADA SUBPASTA NO DESTINO] "${nomePastaDestino}" em "${pastaDestinoAtual.getName()}"`);
    }
    partesCaminhoExibicao.push(nomePastaDestino);
  }

  // 3. TRAVA DE SEGURANÇA ABSOLUTA:
  // A pasta final de destino NUNCA pode ser a mesma pasta onde o documento Google Doc reside!
  if (pastaDestinoAtual.getId() === idPastaDoc) {
    throw new Error(
      `[ERRO DE SEGURANÇA BLOQUEADO] A pasta de destino calculada (${pastaDestinoAtual.getName()}) ` +
      `possui o mesmo ID da pasta de origem do Google Doc! A operação foi abortada imediatamente para não poluir sua pasta de textos.`
    );
  }

  return {
    pasta: pastaDestinoAtual,
    isPosts: isPosts,
    caminhoExibicao: partesCaminhoExibicao.join('/')
  };
}

/**
 * Converte o documento ativo para Markdown com Front Matter Jekyll.
 */
function getMarkdownFromActiveDoc(doc, docFile, originalFileName, fileSlug, pastaDestino) {
  let markdown = '';
  let tags = [];
  let semanticOrderScore = 0.0;
  let tempoLeitura = 1;
  let nomeSemData = originalFileName;
  const isPostsFolder = pastaDestino ? (pastaDestino.getName() === '_posts') : false;
  let noIndex = !isPostsFolder;
  let hasNavigationFooter = true;

  const body = doc.getBody();
  const fullText = body.getText().trim();

  // Se o documento tiver apenas uma linha de texto, trata como redirecionamento
  if (fullText.length > 0 && !fullText.includes('\n')) {
    const redirectSlug = slugifyFileName(fullText);
    let redirectMarkdown = `---\n`;
    redirectMarkdown += `layout: null\n`;
    redirectMarkdown += `title: "${originalFileName}"\n`;
    redirectMarkdown += `no_index: true\n`;
    redirectMarkdown += `search: false\n`;
    redirectMarkdown += `---\n\n`;
    redirectMarkdown += `<script>window.location.href="./${redirectSlug}.html"</script>`;

    return {
      markdownContent: redirectMarkdown,
      semanticOrderScore: 9999,
      tempoLeitura: 0,
      nomeSemData: originalFileName,
      noIndex: true,
      hasNavigationFooter: false,
      tags: []
    };
  }

  // Cálculo de tempo de leitura
  tempoLeitura = calcularTempoLeitura(fullText);

  let contentElementsInReverse = [];
  let tagsFound = false;
  let scoreFound = false;
  let customTitle = null;
  let titleFound = false;
  let pillar = null;
  let customDateStr = null;
  let customDocLayout = null;
  let customDesc = null;
  let descKey = 'description';
  let redirectFrom = [];
  let redirectFromFound = false;

  // 1. Extração de metadados em passagem reversa (do fim para o início)
  for (let i = body.getNumChildren() - 1; i >= 0; i--) {
    const element = body.getChild(i);

    if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const paragraph = element.asParagraph();
      const text = paragraph.getText().trim();
      let isMetadata = false;

      const tagMatch = text.match(/^\s*tags:\s*(.*)/im);
      if (tagMatch && !tagsFound) {
        const tagsString = tagMatch[1].replace(/\.\s*$/, "");
        tags = tagsString.split(',')
          .map(tag => normalizarTag(tag))
          .filter(tag => tag.length > 0);
        tagsFound = true;
        isMetadata = true;
      }

      const scoreMatch = text.match(REGEX_ORDENACAO);
      if (scoreMatch && !scoreFound) {
        const scoreStr = scoreMatch[1].replace(',', '.');
        semanticOrderScore = parseFloat(scoreStr) || semanticOrderScore;
        scoreFound = true;
        noIndex = false;
        isMetadata = true;
      }

      const footerMatch = text.match(/^\s*(?:Footer|Fotter):\s*(n[ãa]o|no)/im);
      if (footerMatch && hasNavigationFooter) {
        hasNavigationFooter = false;
        noIndex = false;
        isMetadata = true;
      }

      const titleMatch = text.match(/^\s*(?:T[ií]tulo|Title):\s*(.+)$/i);
      if (titleMatch && !titleFound) {
        customTitle = normalizarAspas(titleMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        titleFound = true;
        isMetadata = true;
      }

      const descMatch = text.match(/^\s*(?:desc|Desc|descrição|Descrição|description|Description):\s*(.+)$/i);
      if (descMatch && !customDesc) {
        customDesc = normalizarAspas(descMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        isMetadata = true;
      }

      const redirectMatch = text.match(/^\s*(?:redirect_from|redirect|redirecionamento):\s*(.*)/i);
      if (redirectMatch && !redirectFromFound) {
        const redirectString = redirectMatch[1].replace(/\.\s*$/, "").trim();
        if (redirectString) {
          redirectFrom = redirectString.split(',')
            .map(r => r.trim().replace(/^['"]|['"]$/g, ''))
            .filter(r => r.length > 0);
        }
        redirectFromFound = true;
        isMetadata = true;
      }

      const pillarMatch = text.match(/^\s*(?:Pilar|pillar):\s*["'“`”‘'«»]?(.*?)["'“`”‘'«»]?\s*$/i);
      if (pillarMatch && !pillar) {
        pillar = normalizarAspas(pillarMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        isMetadata = true;
      }

      const dateMatch = text.match(/^\s*(?:date|data):\s*["'“`”‘'«»]?(.*?)["'“`”‘'«»]?\s*$/i);
      if (dateMatch && !customDateStr) {
        customDateStr = normalizarAspas(dateMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        isMetadata = true;
      }

      const layoutMatch = text.match(/^\s*(?:layout|Layout):\s*["'“`”‘'«»]?(.*?)["'“`”‘'«»]?\s*$/i);
      if (layoutMatch && !customDocLayout) {
        customDocLayout = normalizarAspas(layoutMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        isMetadata = true;
      }

      if (isMetadata) {
        continue;
      }
    }

    contentElementsInReverse.push(element);
  }

  // Título do documento
  if (customTitle) {
    nomeSemData = customTitle;
  } else {
    const regex = /^\d{4}-\d{2}-\d{2}-/;
    nomeSemData = normalizarAspas(originalFileName.replace(regex, ''));
  }
  const cleanTitle = normalizarAspas(nomeSemData).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();

  // Layout
  const defaultFolderLayout = obterLayoutDaPasta(pastaDestino);
  const chosenLayout = customDocLayout ? customDocLayout : (isPostsFolder ? 'post' : defaultFolderLayout);

  // 2. Montagem do Front Matter YAML
  markdown += `---\n`;
  markdown += `layout: ${chosenLayout}\n`;
  markdown += `title: "${cleanTitle}"\n`;
  markdown += `reading_time: ${tempoLeitura}\n`;
  markdown += `semantic_order: ${semanticOrderScore}\n`;

  if (customDesc) {
    markdown += `${descKey || 'description'}: "${customDesc}"\n`;
  }

  if (pillar) {
    const cleanPillar = normalizarAspas(pillar).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
    markdown += `pillar: "${cleanPillar}"\n`;
  }

  if (noIndex) {
    markdown += `no_index: true\n`;
  }

  if (!hasNavigationFooter) {
    markdown += `navigation_footer: false\n`;
  }

  if (tags.length > 0) {
    markdown += `tags:\n`;
    tags.forEach(tag => {
      markdown += `  - ${tag}\n`;
    });
  }

  if (redirectFrom && redirectFrom.length > 0) {
    markdown += `redirect_from:\n`;
    redirectFrom.forEach(rf => {
      markdown += `  - ${rf}\n`;
    });
  }

  if (isPostsFolder) {
    const dateObj = docFile.getLastUpdated();
    const dateTimeStr = customDateStr ? customDateStr : Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    markdown += `date: ${dateTimeStr}\n`;
  }

  markdown += `---\n\n`;

  // 3. Conversão do Corpo do Documento
  const contentElements = contentElementsInReverse.reverse();

  // Filtrar elementos residuais de metadados no início
  let firstNonMetaIndex = 0;
  let inFrontMatterBlock = false;

  for (let i = 0; i < contentElements.length; i++) {
    const elem = contentElements[i];
    if (elem.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const txt = elem.asParagraph().getText().trim();
      if (!txt) {
        if (i === firstNonMetaIndex) firstNonMetaIndex = i + 1;
        continue;
      }
      if (txt === '---') {
        inFrontMatterBlock = !inFrontMatterBlock;
        firstNonMetaIndex = i + 1;
        continue;
      }
      if (inFrontMatterBlock || txt.match(/^(layout|title|t[ií]tulo|date|data|pillar|pilar|reading_time|semantic_order|tags|no_index|navigation_footer|desc|descri[cç][aã]o|description):\s*/i)) {
        firstNonMetaIndex = i + 1;
        continue;
      }
    }
    break;
  }

  const bodyElements = contentElements.slice(firstNonMetaIndex);

  for (let i = 0; i < bodyElements.length; i++) {
    const element = bodyElements[i];
    const elementType = element.getType();

    if (elementType === DocumentApp.ElementType.PARAGRAPH) {
      const paragraph = element.asParagraph();
      const heading = paragraph.getHeading();

      let rawText = '';
      for (let j = 0; j < paragraph.getNumChildren(); j++) {
        const child = paragraph.getChild(j);
        if (child.getType() === DocumentApp.ElementType.TEXT) {
          rawText += formatarTextElementMarkdown(child.asText(), false);
        } else {
          rawText += child.getText ? child.getText() : '';
        }
      }

      let text = rawText.replace(/(\r\n|\r|\n)/g, '  \n');

      // Formatação de imagens com estilos de tamanho e alinhamento
      text = text.replace(/!\[h(\d+)%\s*(.*?)\]\((.*?)\)/g, '<img src="$3" alt="$2" style="float: left; width: $1%; margin-right: 10px; margin-bottom: 10px; border-radius: 15px;">');
      text = text.replace(/!\[v(\d+)%\s*(.*?)\]\((.*?)\)/g, '<img src="$3" alt="$2" style="float: left; height: $1%; margin-right: 10px; margin-bottom: 10px; border-radius: 15px;">');
      text = text.replace(/!\[hr(\d+)%\s*(.*?)\]\((.*?)\)/g, '<img src="$3" alt="$2" style="float: right; width: $1%; margin-left: 10px; margin-bottom: 10px; border-radius: 15px;">');
      text = text.replace(/!\[vr(\d+)%\s*(.*?)\]\((.*?)\)/g, '<img src="$3" alt="$2" style="float: right; height: $1%; margin-left: 10px; margin-bottom: 10px; border-radius: 15px;">');

      text = text.trim();

      if (text) {
        switch (heading) {
          case DocumentApp.ParagraphHeading.HEADING1: markdown += `# ${text}\n\n`; break;
          case DocumentApp.ParagraphHeading.HEADING2: markdown += `## ${text}\n\n`; break;
          case DocumentApp.ParagraphHeading.HEADING3: markdown += `### ${text}\n\n`; break;
          case DocumentApp.ParagraphHeading.HEADING4: markdown += `#### ${text}\n\n`; break;
          case DocumentApp.ParagraphHeading.HEADING5: markdown += `##### ${text}\n\n`; break;
          case DocumentApp.ParagraphHeading.HEADING6: markdown += `###### ${text}\n\n`; break;
          default: markdown += `${text}\n\n`; break;
        }
      }
    } else if (elementType === DocumentApp.ElementType.LIST_ITEM) {
      const listItem = element.asListItem();
      const nesting = listItem.getNestingLevel();
      const glyph = listItem.getGlyphType();
      let prefix = '';
      for (let n = 0; n < nesting; n++) prefix += '  ';

      if (glyph === DocumentApp.GlyphType.BULLET || glyph === DocumentApp.GlyphType.HOLLOW_BULLET || glyph === DocumentApp.GlyphType.SQUARE_BULLET) {
        prefix += '* ';
      } else {
        prefix += '1. ';
      }

      let rawText = '';
      for (let j = 0; j < listItem.getNumChildren(); j++) {
        const child = listItem.getChild(j);
        if (child.getType() === DocumentApp.ElementType.TEXT) {
          rawText += formatarTextElementMarkdown(child.asText(), false);
        } else {
          rawText += child.getText ? child.getText() : '';
        }
      }
      let text = rawText.replace(/(\r\n|\r|\n)/g, '  \n').trim();
      if (text) markdown += `${prefix}${text}\n\n`;

    } else if (elementType === DocumentApp.ElementType.TABLE) {
      const table = element.asTable();
      const numRows = table.getNumRows();

      if (numRows > 0) {
        let tableMarkdown = '';
        let maxCols = 0;

        for (let r = 0; r < numRows; r++) {
          maxCols = Math.max(maxCols, table.getRow(r).getNumCells());
        }

        if (maxCols > 0) {
          for (let r = 0; r < numRows; r++) {
            const row = table.getRow(r);
            const numCells = row.getNumCells();
            const cellTexts = [];

            for (let c = 0; c < maxCols; c++) {
              if (c < numCells) {
                const cell = row.getCell(c);
                let cellFormattedText = '';

                for (let j = 0; j < cell.getNumChildren(); j++) {
                  const child = cell.getChild(j);
                  if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
                    const p = child.asParagraph();
                    let pText = '';
                    for (let k = 0; k < p.getNumChildren(); k++) {
                      const textChild = p.getChild(k);
                      if (textChild.getType() === DocumentApp.ElementType.TEXT) {
                        pText += formatarTextElementMarkdown(textChild.asText(), true);
                      } else {
                        pText += textChild.getText ? textChild.getText() : '';
                      }
                    }
                    if (pText.trim()) {
                      if (cellFormattedText.length > 0) cellFormattedText += '<br>';
                      cellFormattedText += pText.trim();
                    }
                  } else {
                    const childText = child.getText ? child.getText().trim() : '';
                    if (childText) {
                      if (cellFormattedText.length > 0) cellFormattedText += '<br>';
                      cellFormattedText += childText;
                    }
                  }
                }

                if (!cellFormattedText) {
                  cellFormattedText = cell.getText() ? cell.getText().trim() : '';
                }

                let cleanCell = cellFormattedText
                  .replace(/\|/g, '\\|')
                  .replace(/(\r\n|\r|\n)/g, '<br>')
                  .trim();

                cellTexts.push(cleanCell);
              } else {
                cellTexts.push('');
              }
            }

            tableMarkdown += `| ${cellTexts.join(' | ')} |\n`;

            if (r === 0) {
              const headerDivider = Array(maxCols).fill('---').join(' | ');
              tableMarkdown += `| ${headerDivider} |\n`;
            }
          }

          markdown += tableMarkdown + '\n';
        }
      }
    }
  }

  return {
    markdownContent: markdown.trim(),
    semanticOrderScore: semanticOrderScore,
    tempoLeitura: tempoLeitura,
    nomeSemData: nomeSemData,
    noIndex: noIndex,
    hasNavigationFooter: hasNavigationFooter,
    tags: tags
  };
}

/**
 * Formata um elemento de texto do Google Docs para Markdown,
 * preservando negrito, itálico e links de hipertexto de forma eficiente em blocos (runs).
 */
function formatarTextElementMarkdown(textElement, isTableCell = false) {
  const rawContent = textElement.getText();
  if (!rawContent) return '';
  const textContent = normalizarAspas(rawContent);

  let indices;
  try {
    indices = textElement.getTextAttributeIndices();
  } catch (e) {
    indices = [0];
  }
  if (!indices || indices.length === 0) {
    indices = [0];
  }

  let result = '';
  let inBoldRun = false;
  let inItalicRun = false;
  let inBoldItalicRun = false;

  for (let r = 0; r < indices.length; r++) {
    const start = indices[r];
    const end = (r < indices.length - 1) ? indices[r + 1] : textContent.length;
    if (start >= end) continue;

    let isBold = false;
    let isItalic = false;
    let linkUrl = null;

    try {
      isBold = !!textElement.isBold(start);
      isItalic = !!textElement.isItalic(start);
      linkUrl = textElement.getLinkUrl(start);
    } catch (e) {
      isBold = false;
      isItalic = false;
      linkUrl = null;
    }

    let runText = textContent.substring(start, end);

    // Se o bloco inteiro não tem formatação de estilo
    if (!isBold && !isItalic && !inBoldRun && !inItalicRun) {
      let formattedRun = isTableCell ? runText.replace(/(\r\n|\r|\n)/g, ' ') : runText;
      if (linkUrl && formattedRun.trim()) {
        result += `[${formattedRun}](${linkUrl})`;
      } else {
        result += formattedRun;
      }
      continue;
    }

    // Processamento de transições de estilo
    let styledRun = '';
    for (let k = 0; k < runText.length; k++) {
      const char = runText[k];

      if (char === '\r' || char === '\n') {
        if (inBoldItalicRun) {
          styledRun += "***";
          inBoldItalicRun = false;
          inBoldRun = false;
          inItalicRun = false;
        } else {
          if (inBoldRun) { styledRun += '**'; inBoldRun = false; }
          if (inItalicRun) { styledRun += '*'; inItalicRun = false; }
        }
        styledRun += isTableCell ? ' ' : char;
        continue;
      }

      if (char === ' ' && inBoldItalicRun) {
        styledRun += "*** ";
        inBoldItalicRun = false;
        inBoldRun = false;
        inItalicRun = false;
        continue;
      }

      if (isBold && !inBoldRun && char !== ' ') {
        styledRun += '**';
        inBoldRun = true;
      } else if (!isBold && inBoldRun) {
        styledRun += '**';
        inBoldRun = false;
      }

      if (isItalic && !inItalicRun && char !== ' ') {
        styledRun += '*';
        inItalicRun = true;
      } else if (!isItalic && inItalicRun) {
        styledRun += '*';
        inItalicRun = false;
      }

      inBoldItalicRun = inItalicRun && inBoldRun;
      styledRun += char;
    }

    if (linkUrl && styledRun.trim()) {
      result += `[${styledRun}](${linkUrl})`;
    } else {
      result += styledRun;
    }
  }

  if (inBoldRun) { result += '**'; inBoldRun = false; }
  if (inItalicRun) { result += '*'; inItalicRun = false; }

  return result;
}

/**
 * Utilitários auxiliares
 */
function splitComentario(texto) {
  if (!texto) return [texto || ''];
  const resultado = texto.match(REGEX_SPLIT_COMENTARIO);
  if (resultado) {
    return [resultado[1].trim(), resultado[2].trim()];
  } else {
    return [texto.trim()];
  }
}

function slugifyFileName(fileName) {
  if (!fileName) return '';
  let slug = fileName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/[^a-z0-9-]/g, '');
  slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug;
}

function normalizarAspas(str) {
  if (!str) return str;
  return str.replace(/[“”„«»]/g, '"').replace(/[‘’‚]/g, "'");
}

function normalizarTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  const clean = normalizarAspas(tag).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  if (lower === 'método vida' || lower === 'metodo vida') return 'Método VIDA';
  if (lower === 'sistema gene') return 'Sistema GENE';
  if (lower === 'futuro ancestral') return 'Futuro Ancestral';

  const hasUpperVida = /\bVIDA\b/.test(clean);
  const hasUpperGene = /\bGENE\b/.test(clean);
  let result = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (hasUpperVida) result = result.replace(/\bvida\b/gi, 'VIDA');
  if (hasUpperGene) result = result.replace(/\bgene\b/gi, 'GENE');
  return result;
}

function calcularTempoLeitura(fullText) {
  if (!fullText) return 1;
  const text = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/<div[^>]*>|<\/div>/gi, '');
  const words = text.split(/\s+/).filter(word => word.length > 0);
  return Math.max(1, Math.round(words.length / 200.0));
}

function obterLayoutDaPasta(pastaDestino) {
  if (!pastaDestino) return 'default';
  const name = pastaDestino.getName().toLowerCase();
  if (name === 'wingene') return 'wingene';
  if (name === 'reflexoes') return 'reflections';
  if (name === 'o-cascudo-e-outras-historias') return 'cascudo';
  if (name === 'poesias-e-aforismos') return 'poetry';
  if (name === 'ipes-e-tijolos') return 'ipes';
  if (name.includes('cronicas')) return 'cronicas';
  return 'default';
}

function encontrarCriarPastaPorCaminho(caminhoCompleto, criar = false) {
  let pastaAtual = DriveApp.getRootFolder();
  const nomesPastas = caminhoCompleto.split('/');

  for (const nome of nomesPastas) {
    if (!nome.trim()) continue;
    let pastaEncontrada = null;
    const subpastas = pastaAtual.getFoldersByName(nome.trim());

    if (subpastas.hasNext()) {
      pastaEncontrada = subpastas.next();
    } else if (criar) {
      pastaEncontrada = pastaAtual.createFolder(nome.trim());
    } else {
      return null;
    }
    pastaAtual = pastaEncontrada;
  }
  return pastaAtual;
}

