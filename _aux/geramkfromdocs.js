const converterTodos = false;
/**
 * O CAMINHO COMPLETO da pasta de destino no Google Drive.
 */
const CAMINHO_PASTA_DESTINO = "Pessoal/Meus.Sites/eugeniogz.github.io";

const MIME_GOOGLE_DOCS = MimeType.GOOGLE_DOCS;
const MIME_MARKDOWN = MimeType.PLAIN_TEXT;
const NOME_INDEX = "index.md";

// REGEX PARA EXTRAÇÃO DE METADADOS DO CORPO DO DOC
// Captura "Ordenação:" seguida de um número, aceitando '.' ou ',' como separador decimal
const REGEX_ORDENACAO = /Ordenação:\s*(\d+([.,]\d+)?)/i;

// VARIÁVEL GLOBAL PARA RASTREAR A PASTA RAIZ DE DESTINO
let ROOT_DESTINATION_FOLDER_ID = null;
let ROOT_DESTINATION_FOLDER = null;
let DATA_FOLDER = null;
let AFORISMOS_DOC_ID = null;
let totalFiles = 0;

// --- FUNÇÕES PRINCIPAIS E DE GESTÃO DE PASTAS ---

function principal(nomePastaRaiz = "Wingene") {
  DATA_FOLDER = null;
  totalFiles = 0;

  const caminhoPastaFonte = "Pessoal/Meus.Textos/" + nomePastaRaiz;
  const pastaFonte = encontrarCriarPastaPorCaminho(caminhoPastaFonte, false);
  if (!pastaFonte) {
    const msg = `[ERRO] A pasta fonte "${caminhoPastaFonte}" não foi encontrada. Verifique o caminho.`;
    Logger.log(msg);
    return;
  }

  const pastaDestinoRaiz = encontrarCriarPastaPorCaminho(CAMINHO_PASTA_DESTINO, true);
  if (!pastaDestinoRaiz) {
     const msg = `[ERRO] Não foi possível encontrar/criar a pasta destino "${CAMINHO_PASTA_DESTINO}".`;
    Logger.log(msg);
    return;
  }

  // 1. INICIALIZA A ID DA PASTA RAIZ DE DESTINO
  ROOT_DESTINATION_FOLDER_ID = pastaDestinoRaiz.getId();
  ROOT_DESTINATION_FOLDER = pastaDestinoRaiz.getName();

  Logger.log(`Iniciando CONVERSÃO e INDEXAÇÃO de Docs...`);
  // A chamada agora é direta para a função recursiva única:
  const totalFilesChanged = converterPastaParaMarkdown(pastaFonte, pastaDestinoRaiz);

  Logger.log(`\nIniciando LIMPEZA de arquivos excluídos em TODA a hierarquia...`);
  
  // Chamada única para a função de limpeza recursiva
  limparArquivosExcluidos(pastaDestinoRaiz, pastaFonte);

  // GERA SITEMAP (Desativado: sitemap.xml é gerado automaticamente pelo jekyll-sitemap / GitHub Pages)
  // gerarSitemap(pastaDestinoRaiz);

  const urlDestino = pastaDestinoRaiz.getUrl();
  const msgSucesso = `
  Total de arquivos:** ${totalFiles}
  Total de arquivos Markdown alterados (criados/atualizados):** ${totalFilesChanged} arquivos.
  [SUCESSO] Sincronização concluída! Verifique os arquivos Markdown aqui: ${urlDestino}`;
  Logger.log(msgSucesso);
  
  // Recomendo enviar a notificação por e-mail, se for útil:
  // if (totalFilesChanged > 0) {
  //    enviarNotificacaoEmail(totalFilesChanged);
  // }
}

/**
 * Envia um e-mail de notificação para o usuário dono do script sobre as alterações.
 */
function enviarNotificacaoEmail(totalAlteracoes) {
    const ownerEmail = Session.getActiveUser().getEmail();

    if (!ownerEmail) {
        Logger.log("[ERRO_EMAIL] Não foi possível obter o email do usuário ativo para notificação.");
        return;
    }

    const subject = `[Google Docs Sync] Sincronização Concluída com Alterações`;

    const body = `
Olá,

A rotina de sincronização de Google Docs para Markdown foi concluída com sucesso.

**Detalhes da Sincronização:**
* **Total de arquivos Markdown alterados (criados/atualizados):** ${totalAlteracoes} arquivos.
* **Pasta de Destino:** ${CAMINHO_PASTA_DESTINO}

Você pode verificar o log de execução no Editor de Scripts para mais detalhes.

Atenciosamente,
Seu Script de Sincronização.
`;

    MailApp.sendEmail({
        to: ownerEmail,
        subject: subject,
        body: body.trim()
    });

    Logger.log(`[EMAIL] Notificação enviada para ${ownerEmail}. Total de alterações: ${totalAlteracoes}`);
}

/**
 * FUNÇÃO DE MANUTENÇÃO: Limpa todos os arquivos 'index.md'
 * da pasta de destino. Útil para forçar a regeneração completa de todos os
 * índices e remover dados de versões antigas do script.
 * Pode ser executada manualmente pelo editor do Apps Script.
 */
function limparTodosOsIndices() {
  Logger.log("--- INICIANDO LIMPEZA DE TODOS OS ARQUIVOS DE ÍNDICE ---");
  const pastaRaiz = encontrarCriarPastaPorCaminho(CAMINHO_PASTA_DESTINO, false);
  if (!pastaRaiz) {
    Logger.log("[ERRO] Não foi possível encontrar a pasta raiz para a limpeza de índices.");
    return;
  }
  
  let totalDeletado = 0;

  function apagarRecursivamente(pasta) {
    // Apaga index.md
    const indices = pasta.getFilesByName("index.md");
    while (indices.hasNext()) {
      indices.next().setTrashed(true);
      totalDeletado++;
      Logger.log(`Índice "index.md" em "${pasta.getName()}" movido para a lixeira.`);
    }

    // Chama para subpastas
    const subpastas = pasta.getFolders();
    while (subpastas.hasNext()) {
      apagarRecursivamente(subpastas.next());
    }
  }

  apagarRecursivamente(pastaRaiz);
  Logger.log(`--- LIMPEZA DE ÍNDICES CONCLUÍDA: ${totalDeletado} arquivos movidos para a lixeira. ---`);
}

/**
 * Tenta encontrar ou criar um objeto Folder do DriveApp navegando por um caminho de pastas.
 */
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

/**
 * Converte o nome de um arquivo para um formato "slug" amigável.
 */
function slugifyFileName(fileName) {
  let slug = fileName.toLowerCase();

  slug = slug.replace(/á|à|ã|â/g, 'a');
  slug = slug.replace(/é|è|ê/g, 'e');
  slug = slug.replace(/í|ì|î/g, 'i');
  slug = slug.replace(/ó|ò|õ|ô/g, 'o');
  slug = slug.replace(/ú|ù|û/g, 'u');
  slug = slug.replace(/ç/g, 'c');

  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/[^a-z0-9-]/g, '');
  slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  return slug;
}

/**
 * Converte aspas estilizadas (smart/curly quotes) para aspas normais (retas).
 */
function normalizarAspas(str) {
  if (!str) return str;
  return str
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'");
}

/**
 * Normaliza uma tag: remove aspas, primeira letra maiúscula e demais minúsculas,
 * preservando palavras como VIDA e GENE em maiúsculas se estiverem em maiúsculas na origem.
 */
function normalizarTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  const clean = normalizarAspas(tag).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  if (lower === 'método vida' || lower === 'metodo vida') {
    return 'Método VIDA';
  }
  if (lower === 'sistema gene') {
    return 'Sistema GENE';
  }
  if (lower === 'futuro ancestral') {
    return 'Futuro Ancestral';
  }

  const hasUpperVida = /\bVIDA\b/.test(clean);
  const hasUpperGene = /\bGENE\b/.test(clean);

  let result = lower.charAt(0).toUpperCase() + lower.slice(1);

  if (hasUpperVida) {
    result = result.replace(/\bvida\b/gi, 'VIDA');
  }
  if (hasUpperGene) {
    result = result.replace(/\bgene\b/gi, 'GENE');
  }

  return result;
}


/**
 * Procura um arquivo .md pelo nome em toda a hierarquia de destino.
 * (Função não usada no fluxo principal, mas mantida por ser útil)
 */
function procurarArquivoMdEmTodaHierarquia(pasta, nomeMarkdown) {
    const arquivosLocais = pasta.getFilesByName(nomeMarkdown);
    if (arquivosLocais.hasNext()) {
        return arquivosLocais.next();
    }

    const subpastas = pasta.getFolders();
    while (subpastas.hasNext()) {
        const subpasta = subpastas.next();
        const arquivoEncontrado = procurarArquivoMdEmTodaHierarquia(subpasta, nomeMarkdown);
        if (arquivoEncontrado) {
            return arquivoEncontrado;
        }
    }

    return null;
}

// --- FUNÇÕES DE CONVERSÃO E INDEXAÇÃO ---

// Função de ordenação base harmonizada para usar 'semanticOrder'
const sortDocs = (a, b) => {
  // 1. Prioridade: a.semanticOrder
  if (a.semanticOrder !== b.semanticOrder) return a.semanticOrder - b.semanticOrder; 
  // 2. Critério de Desempate: Nome Original
  return a.original.localeCompare(b.original);
};


/**
 * Tenta ler os metadados (tempo_leitura, semantic_order) de um arquivo Markdown.
 * Retorna um objeto com os valores extraídos ou padrões.
 */
function getMetadataFromMd(arquivoMdDestino) {
    let tempoLeitura = 1;
    let semanticOrderScore = 0.0;
    let noIndex = false;
    let hasNavigationFooter = true;
    let title = null;
    let tags = [];
    let desc = null;
    
    try {
        const content = arquivoMdDestino.getBlob().getDataAsString();
        // Regex básica para encontrar '---', capturar o conteúdo do YAML, e depois '---'
        const yamlMatch = content.match(/^---\s*([\s\S]*?)\s*---/i);

        if (yamlMatch && yamlMatch[1]) {
            const yamlBlock = yamlMatch[1];
            
            // Regex para extrair reading_time
            const timeMatch = yamlBlock.match(/reading_time:\s*(\d+)/i);
            if (timeMatch) {
                tempoLeitura = parseInt(timeMatch[1], 10) || 1;
            }
            
            // Regex para extrair semantic_order
            const scoreMatch = yamlBlock.match(/semantic_order:\s*(\d+([.,]\d+)?)/i);
            if (scoreMatch) {
                const scoreStr = scoreMatch[1].replace(',', '.');
                semanticOrderScore = parseFloat(scoreStr) || 0.0;
            }

            // Regex para extrair no_index
            if (/no_index:\s*true/i.test(yamlBlock)) {
                noIndex = true;
            }
            if (/navigation_footer:\s*false/i.test(yamlBlock)) {
                hasNavigationFooter = false;
            }
            // Regex para extrair title (com ou sem aspas)
            const titleMatch = yamlBlock.match(/^(?:title|t[ií]tulo):\s*["'“`”‘'«»]?(.*?)["'“`”‘'«»]?\s*$/im) || yamlBlock.match(/^(?:title|t[ií]tulo):\s*(.*?)\n/im);
            if (titleMatch) {
                title = normalizarAspas(titleMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
            }

            // Regex para extrair desc
            const descMatch = yamlBlock.match(/^(?:desc|description|descrição|descricao):\s*["'“`”‘'«»]?(.*?)["'“`”‘'«»]?\s*$/im);
            if (descMatch) {
                desc = normalizarAspas(descMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
            }

            // Regex para extrair tags
            const tagsBlockMatch = yamlBlock.match(/^tags:\s*\n((?:\s*-\s*.*(?:\n|$))+)/im);
            if (tagsBlockMatch) {
                tags = tagsBlockMatch[1].split('\n')
                    .map(line => line.replace(/^\s*-\s*/, '').trim())
                    .map(tag => normalizarTag(tag))
                    .filter(t => t.length > 0);
            } else {
                const tagsInlineMatch = yamlBlock.match(/^tags:\s*\[(.*?)\]/im) || yamlBlock.match(/^tags:\s*(.+)$/im);
                if (tagsInlineMatch) {
                    tags = tagsInlineMatch[1].split(',')
                        .map(tag => normalizarTag(tag))
                        .filter(t => t.length > 0);
                }
            }
        }
    } catch (e) {
        Logger.log(`[ERRO METADATA MD] Falha ao ler metadados do MD ${arquivoMdDestino.getName()}: ${e.toString()}`);
    }

    return { semanticOrderScore: semanticOrderScore, tempoLeitura: tempoLeitura, noIndex: noIndex, hasNavigationFooter: hasNavigationFooter, title: title, tags: tags || [], desc: desc };
}

/**
 * Função recursiva para converter Google Docs para Markdown, criar o index.md e 
 * processar subpastas recursivamente.
 * @returns {number} O total de arquivos .md que foram criados ou atualizados.
 */
function converterPastaParaMarkdown(pastaFonte, pastaDestino) {

    const arquivosDocIter = pastaFonte.getFilesByType(MIME_GOOGLE_DOCS);
    const listaArquivosDoc = [];
    while (arquivosDocIter.hasNext()) {
        listaArquivosDoc.push(arquivosDocIter.next());
    }

    let filesConverted = 0;
    
    // Lista para armazenar metadados e conteúdo de TODOS os arquivos na pasta.
    const arquivosParaProcessar = []; 
    const arquivosIndexados = []; 

    let nomePastaFonte = pastaFonte.getName();
    if (nomePastaFonte !== '_posts') {
        nomePastaFonte = nomePastaFonte.replace(/_/g, ' ');
    }
    const comentarioPasta = splitComentario(nomePastaFonte);

    // 1. PRIMEIRA PASSAGEM: Coleta metadados, calcula o conteúdo e a necessidade de conversão
    for (let docIdx = 0; docIdx < listaArquivosDoc.length; docIdx++) {
        const arquivoDoc = listaArquivosDoc[docIdx];

        const nomeDocOriginal = arquivoDoc.getName();
        if (nomeDocOriginal === 'Config' || nomeDocOriginal === 'index') continue;

        // Se o nome do Google Doc tiver extensão no nome (ex: .md, .html, .tex), limpa para gerar o slug correto
        const nomeDocLimpo = nomeDocOriginal.replace(/\.(md|html|tex)$/i, '');
        const nomeSlug = slugifyFileName(nomeDocLimpo);
        let nomeMarkdown = `${nomeSlug}.md`;

        if (nomeDocOriginal === 'Aforismos') {
            AFORISMOS_DOC_ID = arquivoDoc.getId();
        }

        // Lógica específica para a pasta _posts: Adiciona data ao nome do arquivo
        if (pastaDestino.getName() === '_posts') {
             const dateObj = arquivoDoc.getLastUpdated();
             const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
             // Evita duplicar a data se o nome do arquivo já começar com o padrão de data
             if (!/^\d{4}-\d{2}-\d{2}-/.test(nomeSlug)) {
                 nomeMarkdown = `${dateStr}-${nomeSlug}.md`;
             }
        }
        
        totalFiles++;

        // 1.1. Tenta encontrar o arquivo .md de destino e verifica a data
        const arquivosMdDestinoIterator = pastaDestino.getFilesByName(nomeMarkdown);
        let deveConverter = converterTodos; // Assume converterTodos (global) como padrão
        let arquivoMdDestino = null;

        const listaDeArquivosMd = [];
        while (arquivosMdDestinoIterator.hasNext()) {
            listaDeArquivosMd.push(arquivosMdDestinoIterator.next());
        }

        if (listaDeArquivosMd.length === 1) {
          arquivoMdDestino = listaDeArquivosMd[0];
        } else {
          for (let i = 0; i < listaDeArquivosMd.length; i++) {
              const arquivoAtual = listaDeArquivosMd[i];
              if (/.*\([0-9]+\).md/.test(arquivoAtual.getName())) {
                  // Todos os arquivos seguintes são duplicatas e devem ser movidos para a lixeira.
                  Logger.log(`[LIMPEZA DE DUPLICATA] Encontrado e movido para lixeira em ${pastaDestino.getName()}: "${arquivoAtual.getName()}".`);
                  arquivoAtual.setTrashed(true);
              } else {
                  arquivoMdDestino = arquivoAtual;
              }
          }
        }

        // --- INÍCIO DA LÓGICA DE DECISÃO DE CONVERSÃO/PROCESSAMENTO ---

        // Continua com a lógica de comparação de data/conversão usando o arquivo "oficial" (ou null se não encontrado)
        if (arquivoMdDestino) {
            const dataDocFonte = arquivoDoc.getLastUpdated().getTime();
            const dataMdDestino = arquivoMdDestino.getLastUpdated().getTime();
            
            if (dataMdDestino < dataDocFonte) {
                Logger.log(`[ATUALIZANDO] Doc "${nomeDocOriginal}". Doc fonte é mais recente.`);
                deveConverter = true;
            } else if (deveConverter) {
                Logger.log(`[ATUALIZANDO] Doc "${nomeDocOriginal}". converterTodos=true.`);
            } else {
                // Se deveConverter for false aqui, a conversão do corpo será evitada.
            }
        } else {
            Logger.log(`[NOVO] Doc "${nomeDocOriginal}". Arquivo MD de destino não encontrado.`);
            deveConverter = true;
        }

        // 1.2. *** FLUXO OTIMIZADO: SÓ CONVERTE O CORPO SE NECESSÁRIO ***
        let markdownContent = null;
        let semanticOrderScore = 0.0;
        let tempoLeitura = 1;
        let nomeSemData = nomeDocOriginal;
        let noIndex = false;
        let hasNavigationFooter = true;
        let tags = [];
        let desc = null;

        if (deveConverter) {
            // Conversão pesada (Corpo e Metadados)
             ({
                markdownContent, 
                semanticOrderScore,
                tempoLeitura,
                nomeSemData,
                noIndex,
                hasNavigationFooter,
                tags,
                desc
            } = getMarkdownAndScoreFromDoc(arquivoDoc, nomeDocOriginal, nomeSlug, pastaDestino, comentarioPasta[0]));

            if (nomeDocOriginal === 'Aforismos') {
                gerarPostsAforismos(arquivoDoc);
            }
        } else {
            // OTIMIZAÇÃO: Extrai Metadados do MD existente, evitando abrir o Google Doc
            if (arquivoMdDestino) {
                // LÊ DO ARQUIVO MD existente
                let customTitleFromMd = null;
                 ({
                    semanticOrderScore,
                    tempoLeitura,
                    noIndex,
                    hasNavigationFooter,
                    title: customTitleFromMd,
                    tags,
                    desc
                } = getMetadataFromMd(arquivoMdDestino)); 
                
                if (customTitleFromMd) {
                    nomeSemData = customTitleFromMd;
                } else {
                    const regex = /^\d{4}-\d{2}-\d{2}-/;
                    nomeSemData = nomeDocOriginal.replace(regex, '');
                }

            } else {
                 // Fallback: lê metadados do Doc se o MD não for encontrado
                 ({
                    semanticOrderScore,
                    tempoLeitura,
                    nomeSemData,
                    noIndex,
                    hasNavigationFooter,
                    tags,
                    desc
                } = getMetadataFromDocLite(arquivoDoc, nomeDocOriginal, pastaDestino));
            }
        }


        // 1.3. Armazena os dados
        arquivosParaProcessar.push({
            original: nomeDocOriginal,
            slug: nomeSlug,
            markdownName: nomeMarkdown,
            content: markdownContent,
            semanticOrder: semanticOrderScore, // CHAVE UNIFICADA PARA ORDENAÇÃO
            time: tempoLeitura,
            tags: tags || [],
            desc: desc,
            deveConverter: deveConverter,
            arquivoMdDestino: arquivoMdDestino,
            nomeSemData: nomeSemData,
            docFile: arquivoDoc,
            noIndex: noIndex,
            hasNavigationFooter: hasNavigationFooter
        });

        // 1.4. Adiciona metadados para indexação (lista paralela)
        if (!noIndex && hasNavigationFooter) {
            arquivosIndexados.push({
                original: nomeDocOriginal,
                title: nomeSemData || nomeDocOriginal,
                nomeSemData: nomeSemData || nomeDocOriginal,
                slug: nomeSlug,
                link: `./${nomeSlug}.html`,
                time: tempoLeitura,
                semanticOrder: semanticOrderScore,
                desc: desc
            });
        }
    }

    // 1.5. SINCRONIZAR ASSETS (Imagens e Vídeos)
    sincronizarAssets(pastaFonte, pastaDestino);

    // 2. ORDENAÇÃO
    // Ordena listas com a função sortDocs harmonizada
    arquivosParaProcessar.sort(sortDocs);
    arquivosIndexados.sort(sortDocs);
    
    // 3. SEGUNDA PASSAGEM (Inicial): SALVA E ADICIONA LINKS DE NAVEGAÇÃO
    function executarPassagemDeConversao(force = false) {
      let filesUpdated = 0;
      const isPostsFolder = pastaDestino.getName() === '_posts';

      for (let i = 0; i < arquivosParaProcessar.length; i++) {
          const docInfo = arquivosParaProcessar[i];

          // Se 'deveConverter' é true (novo/atualizado) OU se o rodapé está sendo forçado a ser reescrito
          if (docInfo.deveConverter || force) {
              
              // Determina Anterior e Próximo com a lista JÁ ORDENADA, ignorando páginas sem rodapé de navegação
              let anterior = null;
              if (!isPostsFolder) {
                  for (let j = i - 1; j >= 0; j--) {
                      if (arquivosParaProcessar[j].hasNavigationFooter !== false) {
                          anterior = arquivosParaProcessar[j];
                          break;
                      }
                  }
              }
              let proximo = null;
              if (!isPostsFolder) {
                  for (let j = i + 1; j < arquivosParaProcessar.length; j++) {
                      if (arquivosParaProcessar[j].hasNavigationFooter !== false) {
                          proximo = arquivosParaProcessar[j];
                          break;
                      }
                  }
              }

              // **OTIMIZAÇÃO 3:** Só reescreve se o conteúdo (corpo OU navegação) for diferente
              const wasChanged = salvarArquivoMarkdownComNavegacao(docInfo, anterior, proximo, pastaDestino);
              if (wasChanged) {
                  filesUpdated++;
              }
          }
      }
      return filesUpdated;
    }
    
    // Executa a conversão baseada em data/converterTodos (Passo 3)
    filesConverted += executarPassagemDeConversao(false);
    // 5. CRIA/ATUALIZA O INDEX.MD
    const comentarioPastaTexto = comentarioPasta.length > 1 ? comentarioPasta[1] : "";

    // 4. PROCESSA SUBPASTAS RECURSIVAMENTE E COLETA METADADOS
    const subpastasIndexadas = [];
    const subpastasFonteIter = pastaFonte.getFolders();
    const listaSubpastasFonte = [];
    while (subpastasFonteIter.hasNext()) {
        listaSubpastasFonte.push(subpastasFonteIter.next());
    }
    
    for (let fIdx = 0; fIdx < listaSubpastasFonte.length; fIdx++) {
        const subpastaFonte = listaSubpastasFonte[fIdx];
        let nomeSubpastaCompleto = subpastaFonte.getName();
        if (nomeSubpastaCompleto.startsWith("_") && nomeSubpastaCompleto !== "_posts") continue;

        let nomeParaProcessar = nomeSubpastaCompleto;
        if (nomeSubpastaCompleto !== '_posts') {
            nomeParaProcessar = nomeSubpastaCompleto.replace(/_/g, ' ');
        }
        const nomeComentarioSubpasta = splitComentario(nomeParaProcessar);
        const nomeSubpasta = nomeComentarioSubpasta[0];
        const comentario = nomeComentarioSubpasta.length > 1 ? nomeComentarioSubpasta[1] : "";

        let nomeDestino = nomeSubpasta;
        if (nomeSubpastaCompleto !== '_posts') {
            nomeDestino = slugifyFileName(nomeSubpasta);
        }

        // Tenta encontrar a pasta de destino
        let subpastasDestinoIterator = pastaDestino.getFoldersByName(nomeDestino);
        let subpastaDestino;

        if (subpastasDestinoIterator.hasNext()) {
            subpastaDestino = subpastasDestinoIterator.next();
        } else {
            subpastaDestino = pastaDestino.createFolder(nomeDestino);
        }

        // 4.1. Chamada Recursiva: Converte os arquivos dentro da subpasta
        filesConverted += converterPastaParaMarkdown(subpastaFonte, subpastaDestino);

        // 4.2. Extrai Semantic Score do Config.doc da subpasta
        let semanticOrderScore = 999;
        try {
            const arquivosConfig = subpastaFonte.getFilesByName("Config");
            if (arquivosConfig.hasNext()) {
                const arquivoConfig = arquivosConfig.next();
                const docConteudo = DocumentApp.openById(arquivoConfig.getId());
                const textoConfig = docConteudo.getBody().getText();
                const scoreMatch = textoConfig.match(REGEX_ORDENACAO);
                if (scoreMatch) {
                    const scoreStr = scoreMatch[1].replace(',', '.');
                    semanticOrderScore = parseFloat(scoreStr) || semanticOrderScore;
                }
            }
        } catch (e) {
            Logger.log(`[AVISO] Falha temporária ao ler o arquivo Config da pasta "${nomeSubpastaCompleto}": ${e.toString()}`);
        }
        
        // 4.3. Adiciona subpasta para indexação
        if (nomeSubpasta.toLowerCase() !== 'figuras') {
            subpastasIndexadas.push({
              name: nomeSubpasta,
              comentario: comentario,
              link: `./${nomeDestino}/`,
              semanticOrder: semanticOrderScore
            });
        }
    }

    subpastasIndexadas.sort((a, b) => a.semanticOrder - b.semanticOrder);

    
    const tituloIndex = comentarioPasta[0];
    
    let indexAlterado = false;
    try {
        const arquivosIndexHtmlFonte = pastaFonte.getFilesByName("index.html");
        if (arquivosIndexHtmlFonte.hasNext()) {
            Logger.log(`[INDEX] "index.html" encontrado na fonte. Ignorando a geração de "index.md" em "${pastaDestino.getName()}".`);
            // Remove o index.md existente caso ele tenha sido gerado anteriormente
            const indexExistente = pastaDestino.getFilesByName(NOME_INDEX);
            while (indexExistente.hasNext()) {
                indexExistente.next().setTrashed(true);
            }
        } else {
            const arquivosIndexFonte = pastaFonte.getFilesByName("index");
            if (arquivosIndexFonte.hasNext()) {
                indexAlterado = copiarIndexMdFonte(arquivosIndexFonte.next(), pastaDestino);
            } else {
                indexAlterado = criarIndexMarkdown(pastaDestino, tituloIndex, arquivosIndexados, subpastasIndexadas, comentarioPastaTexto);
            }
        }
    } catch (e) {
        Logger.log(`[AVISO] Falha temporária ao verificar/criar o índice da pasta "${pastaDestino.getName()}": ${e.toString()}`);
    }
    
    // 5.1. REORDENA O ARQUIVO JSON EM _DATA DE ACORDO COM A ORDEM DO INDEX.MD
    try {
        reordenarDataJsonDaPasta(pastaDestino, arquivosIndexados);
    } catch (e) {
        Logger.log(`[AVISO] Falha ao reordenar JSON da pasta "${pastaDestino.getName()}": ${e.toString()}`);
    }

    // 6. VERIFICA O REQUISITO DE RECONVERSÃO
    if (indexAlterado && arquivosParaProcessar.length > 0) {
        Logger.log(`[FORÇANDO RECONVERSÃO] Index.md em ${pastaDestino.getName()} foi alterado. Reconvertendo arquivos desta pasta para atualizar a navegação.`);
        // Força a segunda passagem de conversão para todos os arquivos da pasta (Passo 3 repetido)
        filesConverted += executarPassagemDeConversao(true);
    }

    return filesConverted;
}

/**
 * Sincroniza arquivos estáticos (JPG, PNG, Vídeos) da fonte para o destino.
 */
function sincronizarAssets(pastaFonte, pastaDestino) {
    const arquivos = pastaFonte.getFiles();
    while (arquivos.hasNext()) {
        const arquivo = arquivos.next();
        const mime = arquivo.getMimeType();
        const nomeArquivo = arquivo.getName();
        
        // Google Docs são convertidos e gerenciados separadamente, NUNCA copiados como assets
        if (mime === MimeType.GOOGLE_DOCS) {
            continue;
        }

        // Verifica se é para copiar diretamente
        if (mime === MimeType.JAVASCRIPT || mime === MimeType.HTML || mime === MimeType.JPEG || mime === MimeType.PNG || mime === MimeType.PDF || mime.startsWith('video/') || mime === MimeType.GIF || mime === MimeType.SVG || mime === 'application/x-tex' || nomeArquivo.toLowerCase().endsWith('.tex')  || nomeArquivo.toLowerCase().endsWith('.md')) {
            const arquivosDestino = pastaDestino.getFilesByName(nomeArquivo);
            
            if (arquivosDestino.hasNext()) {
                const arquivoDestino = arquivosDestino.next();
                // Se o arquivo fonte for mais recente, atualiza
                if (arquivo.getLastUpdated().getTime() > arquivoDestino.getLastUpdated().getTime()) {
                    Logger.log(`[ASSET ATUALIZADO] ${nomeArquivo} em ${pastaDestino.getName()}`);
                    try {
                        // Atualização atômica usando Advanced Drive Service (Drive API)
                        // Requer adicionar o serviço "Drive API" no editor do Apps Script
                        let blob = arquivo.getBlob();
                        
                        // Previne erro "Invalid MIME type" na API para arquivos .tex e .md customizados
                        if (mime === 'application/x-tex' || nomeArquivo.toLowerCase().endsWith('.tex') || nomeArquivo.toLowerCase().endsWith('.md')) {
                            blob.setContentType('text/plain');
                        }
                        
                        Drive.Files.update({
                            title: nomeArquivo
                        }, arquivoDestino.getId(), blob);
                    } catch (e) {
                        Logger.log(`[ERRO] Falha ao atualizar asset via Drive API: ${e.toString()}. Verifique se o Serviço Avançado 'Drive' está ativado.`);
                    }
                }
            } else {
                Logger.log(`[ASSET NOVO] ${nomeArquivo} em ${pastaDestino.getName()}`);
                arquivo.makeCopy(nomeArquivo, pastaDestino);
            }
        }
    }
}

/**
 * Gera um sitemap XML com os arquivos Markdown convertidos (mapeados para .html).
 * Ignora pastas começando com '_' (exceto _posts) ou '.' (padrão Jekyll).
 */
function gerarSitemap(pastaRaiz) {
  const URL_BASE = "https://blog.wingene.com.br/";
  const NOME_SITEMAP = "sitemap.xml";
  
  Logger.log(`[SITEMAP] Iniciando geração de ${NOME_SITEMAP}...`);

  let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlContent += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  function traverse(pasta, caminhoRelativo) {
    const isPostsFolder = pasta.getName() === '_posts';

    // 1. Arquivos
    const arquivos = pasta.getFiles();
    while (arquivos.hasNext()) {
      const arquivo = arquivos.next();
      const nome = arquivo.getName();
      
      if ((nome.toLowerCase().endsWith('.md') || nome.toLowerCase().endsWith('.html')) && !nome.startsWith('~')) {
        // NOVO: Verifica se o arquivo deve ser excluído do sitemap
        try {
            const content = arquivo.getBlob().getDataAsString();
            // Se o arquivo tiver 'no_index: true' no frontmatter, pula ele.
            if (/no_index:\s*true/i.test(content)) {
                Logger.log(`[SITEMAP] Ignorando (no_index: true): ${caminhoRelativo}${nome}`);
                continue;
            }
        } catch (e) {
            Logger.log(`[SITEMAP] Erro ao ler o arquivo ${nome}, pulando. Detalhes: ${e.toString()}`);
            continue;
        }

        let urlPath = '';
        let shouldAdd = false;

        if (isPostsFolder) {
           // _posts: YYYY-MM-DD-slug.md -> YYYY/MM/DD/slug.html
           const match = nome.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
           if (match) {
               urlPath = `${match[1]}/${match[2]}/${match[3]}/${match[4]}.html`;
               shouldAdd = true;
           }
        } else {
           // Normal: slug.md -> path/slug.html (ou path/ se index)
           if (nome === 'index.md' || nome.toLowerCase() === 'index.html') {
              urlPath = caminhoRelativo; 
           } else if (nome.toLowerCase().endsWith('.md')) {
              urlPath = caminhoRelativo + nome.substring(0, nome.length - 3) + '.html';
           } else if (nome.toLowerCase().endsWith('.html')) {
              urlPath = caminhoRelativo + nome;
           }
           shouldAdd = true;
        }
        
        if (shouldAdd) {
           const lastMod = Utilities.formatDate(arquivo.getLastUpdated(), Session.getScriptTimeZone(), "yyyy-MM-dd");
           xmlContent += '  <url>\n';
           xmlContent += `    <loc>${URL_BASE}${urlPath}</loc>\n`;
           xmlContent += `    <lastmod>${lastMod}</lastmod>\n`;
           xmlContent += '  </url>\n';
        }
      }
    }
    
    // 2. Subpastas
    const subpastas = pasta.getFolders();
    while (subpastas.hasNext()) {
      const subpasta = subpastas.next();
      const nomeSub = subpasta.getName();
      
      if (nomeSub.startsWith('.')) continue;

      if (nomeSub === '_posts') {
          traverse(subpasta, caminhoRelativo);
      } else if (nomeSub.startsWith('_')) {
          continue;
      } else {
          traverse(subpasta, caminhoRelativo + nomeSub + '/');
      }
    }
  }

  traverse(pastaRaiz, "");
  
  xmlContent += '</urlset>';
  
  // Salva/Atualiza
  const arquivosSitemap = pastaRaiz.getFilesByName(NOME_SITEMAP);
  if (arquivosSitemap.hasNext()) {
    arquivosSitemap.next().setContent(xmlContent);
    Logger.log(`[SITEMAP] Atualizado com sucesso.`);
  } else {
    pastaRaiz.createFile(NOME_SITEMAP, xmlContent, 'application/xml');
    Logger.log(`[SITEMAP] Criado com sucesso.`);
  }
}

/**
 * Salva/Atualiza o arquivo .md com o rodapé de navegação Anterior/Próximo.
 * * **OTIMIZAÇÃO 3:** Se o conteúdo não foi convertido (docInfo.content é null), 
 * ele lê o arquivo existente para injetar o rodapé.
 * * @returns {boolean} True se o arquivo foi criado ou alterado.
 */
function salvarArquivoMarkdownComNavegacao(docInfo, anterior, proximo, pastaDestino) {
    
    const navegacaoRodape = docInfo.hasNavigationFooter === false ? "" : gerarNavegacaoRodape(anterior, proximo);
    let finalContent = null;
    let existingContent = null;
    let fileChanged = false;
    let bodyContent;

    // Se o conteúdo NÃO foi convertido na primeira passagem, precisamos ler o .md existente
    if (docInfo.content === null) {
        if (!docInfo.arquivoMdDestino) {
             // Isso nunca deve acontecer se a lógica de deveConverter estiver correta
             Logger.log(`[ERRO CRÍTICO] Falha ao processar "${docInfo.original}". Content=null e arquivo MD não encontrado.`);
             return false;
        }
        // Lê o conteúdo do arquivo MD existente (exclui o rodapé antigo, se houver)
        existingContent = docInfo.arquivoMdDestino.getBlob().getDataAsString();
        bodyContent = existingContent.replace(/\n\n---\n\n[\s\S]*$/, '').trim();

    } else {
        // Usa o conteúdo fresco do Doc convertido
        bodyContent = docInfo.content;
    }

    // NOVO: Remove qualquer <div style="clear: both;"></div> do final do conteúdo do corpo
    // para evitar duplicação, já que o rodapé de navegação irá adicioná-lo.
    const clearDivRegex = /(\s*<div style="clear: both;"><\/div>\s*)+$/;
    bodyContent = bodyContent.replace(clearDivRegex, '').trim();
    
    finalContent = bodyContent + navegacaoRodape;

    // Salva/Atualiza o arquivo com o novo conteúdo
    if (docInfo.arquivoMdDestino) {
        if (!existingContent) {
           // Se existingContent for null, lemos para a comparação, exceto se já tivermos lido acima
           existingContent = docInfo.arquivoMdDestino.getBlob().getDataAsString();
        }
        
        if (existingContent.trim() !== finalContent.trim()) {
            docInfo.arquivoMdDestino.setContent(finalContent);
            fileChanged = true;
        } else if (docInfo.deveConverter) {
            // Atualiza o timestamp para evitar reprocessamento eterno se o conteúdo for idêntico
            docInfo.arquivoMdDestino.setContent(finalContent);
            Logger.log(`[SYNC] Timestamp atualizado para "${docInfo.markdownName}" (conteúdo idêntico).`);
        }
    } else {
        // ARQUIVO NOVO: Cria
        const novoArquivo = pastaDestino.createFile(docInfo.markdownName, finalContent, MIME_MARKDOWN);
        docInfo.arquivoMdDestino = novoArquivo;
        fileChanged = true;
    }

    if (fileChanged || docInfo.deveConverter) {
        atualizarDataJsonSeNecessario(docInfo, pastaDestino);
    }

    return fileChanged;
}


/**
 * Gera o rodapé de navegação (Anterior/Próximo)
 */
function gerarNavegacaoRodape(anterior, proximo) {
    if (!anterior && !proximo) return "";
    let rodape = '\n<div style="clear: both;"></div>\n\n---\n\n'; // Separador visual com clear fix
    let navLinksHtml = [];

    if (anterior) {
        // Usa o título do documento (definido no front-matter / rodapé)
        const nomeAnterior = anterior.nomeSemData || anterior.original;
        navLinksHtml.push(`<a href="./${anterior.slug}.html">&lt;&lt; ${nomeAnterior}</a>`);
    } else {
        navLinksHtml.push('<span></span>'); // Placeholder para manter o espaçamento
    }

    if (proximo) {
        const nomeProximo = proximo.nomeSemData || proximo.original;
        navLinksHtml.push(`<a href="./${proximo.slug}.html">${nomeProximo} &gt;&gt;</a>`);
    } else {
        navLinksHtml.push('<span></span>'); // Placeholder para manter o espaçamento
    }

    if (anterior || proximo) {
        // Coloca os links lado a lado se houver os dois, ou apenas um.
        rodape += `<div style="display: flex; justify-content: space-between;">\n`;
        rodape += `  ${navLinksHtml[0]}\n`;
        rodape += `  ${navLinksHtml[1]}\n`;
        rodape += `</div>\n`;
    }

    return rodape;
}

/**
 * Extrai APENAS os metadados (score, tempo leitura, nome sem data, tags) de um Google Doc.
 * Evita a conversão completa para Markdown para economizar tempo.
 */
function getMetadataFromDocLite(docFile, originalFileName, pastaDestino = null) {
    let semanticOrderScore = 0.0;
    let tempoLeitura = 1;
    let nomeSemData = originalFileName; 
    let tags = [];
    let desc = null;
    const isPostsFolder = pastaDestino && pastaDestino.getName() === '_posts';
    let noIndex = !isPostsFolder;
    let hasNavigationFooter = true;
    
    try {
        const doc = DocumentApp.openById(docFile.getId());
        const body = doc.getBody();
        const fullText = body.getText().trim();

        // NOVO: Se o documento tiver apenas uma linha de texto, trata como um redirecionamento.
        // Apenas marca como noIndex para otimização, a conversão real acontece em getMarkdownAndScoreFromDoc.
        if (fullText.length > 0 && !fullText.includes('\n')) {
            return {
                semanticOrderScore: 9999,
                tempoLeitura: 0,
                nomeSemData: originalFileName,
                noIndex: true,
                hasNavigationFooter: false,
                tags: [],
                desc: null
            };
        }
        
        // 1. CÁLCULO DE TEMPO DE LEITURA
        let textForReadingTime = fullText.replace(/\[.*?\]\(.*?\)/g, '');
        textForReadingTime = textForReadingTime.replace(/<div[^>]*>|<\/div>/gi, '');
        const words = textForReadingTime.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const rawTime = wordCount / 200.0;
        const roundedTime = Math.max(1, Math.round(rawTime));
        tempoLeitura = roundedTime;

        // 2. EXTRAÇÃO DE SCORE E TAGS
        const fullBodyText = body.getText();
        const scoreMatch = fullBodyText.match(REGEX_ORDENACAO);
        if (scoreMatch) {
            const scoreStr = scoreMatch[1].replace(',', '.');
            semanticOrderScore = parseFloat(scoreStr) || semanticOrderScore;
            noIndex = false;
        }

        const tagMatch = fullBodyText.match(/^\s*tags:\s*(.*)/im);
        if (tagMatch) {
            const tagsString = tagMatch[1].replace(/\.\s*$/, "");
            tags = tagsString.split(',')
                .map(tag => normalizarTag(tag))
                .filter(tag => tag.length > 0);
        }

        const descMatch = fullBodyText.match(/^\s*(?:desc|Desc|descrição|Descrição|description|Description):\s*(.+)$/im);
        if (descMatch) {
            desc = normalizarAspas(descMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        }
        
        const footerMatch = fullBodyText.match(/^\s*(?:Footer|Fotter):\s*(n[ãa]o|no)/im);
        if (footerMatch) {
            hasNavigationFooter = false;
            noIndex = false;
        }

        // 3. EXTRAÇÃO DE TÍTULO CUSTOMIZADO OU REMOÇÃO DA DATA DO NOME
        const titleMatch = fullBodyText.match(/^\s*(?:T[ií]tulo|Title):\s*(.+)$/im);
        if (titleMatch) {
            nomeSemData = normalizarAspas(titleMatch[1]).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        } else {
            const regex = /^\d{4}-\d{2}-\d{2}-/;
            nomeSemData = normalizarAspas(originalFileName.replace(regex, ''));
        }

        return {
            semanticOrderScore: semanticOrderScore,
            tempoLeitura: tempoLeitura,
            nomeSemData: nomeSemData,
            noIndex: noIndex,
            hasNavigationFooter: hasNavigationFooter,
            tags: tags,
            desc: desc
        };

    } catch (e) {
        Logger.log(`[ERRO LITE] Falha ao extrair metadados do Doc ${docFile.getName()}: ${e.toString()}`);
        return {
            semanticOrderScore: 0.0,
            tempoLeitura: tempoLeitura,
            nomeSemData: originalFileName,
            noIndex: false,
            hasNavigationFooter: true,
            tags: [],
            desc: null
        };
    }
}

/**
 * Gera posts individuais na pasta _posts para cada parágrafo do documento Aforismos.
 */
function gerarPostsAforismos(docFile) {
    const rootFolder = DriveApp.getFolderById(ROOT_DESTINATION_FOLDER_ID);
    let postsFolder;
    const postsIter = rootFolder.getFoldersByName('_posts');
    if (postsIter.hasNext()) {
        postsFolder = postsIter.next();
    } else {
        postsFolder = rootFolder.createFolder('_posts');
    }

    const doc = DocumentApp.openById(docFile.getId());
    const body = doc.getBody();
    const paragraphs = body.getParagraphs();

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        let text = p.getText().trim();
        
        // Ignora parágrafos vazios ou títulos (assume que aforismos são texto normal)
        if (!text || p.getHeading() !== DocumentApp.ParagraphHeading.NORMAL) continue;

        // Verifica se existe data customizada no formato <!--dd/mm/yy--> no final
        const matchDate = text.match(/<!--\s*(\d{2})\/(\d{2})\/(\d{2,4})\s*-->$/);
        
        if (!matchDate) continue;

        const day = parseInt(matchDate[1], 10);
        const month = parseInt(matchDate[2], 10) - 1;
        let year = parseInt(matchDate[3], 10);
        if (year < 100) year += 2000;

        const customDate = new Date(year, month, day, 12, 0, 0);
        const dateStr = Utilities.formatDate(customDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        const dateTimeStr = Utilities.formatDate(customDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        
        // Remove a data do texto
        text = text.substring(0, matchDate.index).trim();
        if (!text) continue;

        let slug = slugifyFileName(text);
        if (slug.length > 50) slug = slug.substring(0, 50).replace(/-$/, '');
        
        const fileName = `${dateStr}-${slug}.md`;
        const rawTitle = text.length > 30 ? text.substring(0, 30) + "..." : text;
        const cleanTitle = normalizarAspas(rawTitle).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        const normText = normalizarAspas(text);
        
        const content = `---\nlayout: post\ntitle: "${cleanTitle}"\ndate: ${dateTimeStr}\n---\n\n${normText}`;
        
        // VERIFICAÇÃO DE EXISTÊNCIA PARA EVITAR DUPLICATAS
        const existingFiles = postsFolder.getFilesByName(fileName);
        if (existingFiles.hasNext()) {
            const file = existingFiles.next();
            if (file.getBlob().getDataAsString() !== content) {
                file.setContent(content);
            }
            // Remove duplicatas extras se houver (limpeza de execuções anteriores)
            while (existingFiles.hasNext()) {
                existingFiles.next().setTrashed(true);
            }
        } else {
            postsFolder.createFile(fileName, content, MIME_MARKDOWN);
        }
    }
}

/**
 * Helper para obter os nomes de arquivos que seriam gerados pelo Aforismos.
 * Usado para evitar que a limpeza apague esses arquivos.
 */
function obterNomesArquivosAforismos(docFile) {
    const nomes = [];
    const doc = DocumentApp.openById(docFile.getId());
    const body = doc.getBody();
    const paragraphs = body.getParagraphs();

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        let text = p.getText().trim();
        
        if (!text || p.getHeading() !== DocumentApp.ParagraphHeading.NORMAL) continue;

        const matchDate = text.match(/<!--\s*(\d{2})\/(\d{2})\/(\d{2,4})\s*-->$/);
        if (!matchDate) continue;

        const day = parseInt(matchDate[1], 10);
        const month = parseInt(matchDate[2], 10) - 1;
        let year = parseInt(matchDate[3], 10);
        if (year < 100) year += 2000;

        const customDate = new Date(year, month, day, 12, 0, 0);
        const dateStr = Utilities.formatDate(customDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        
        text = text.substring(0, matchDate.index).trim();
        if (!text) continue;

        let slug = slugifyFileName(text);
        if (slug.length > 50) slug = slug.substring(0, 50).replace(/-$/, '');
        
        nomes.push(`${dateStr}-${slug}.md`);
    }
    return nomes;
}

/**
 * Converte o conteúdo de um Google Doc para uma string Markdown simples,
 * **SEM adicionar o rodapé de navegação Anterior/Próximo/Voltar Index.**
 * Inclui metadados no Front Matter.
 * @returns {{markdownContent: string, semanticOrderScore: number, tempoLeitura: number, nomeSemData: string}}
 */
function getMarkdownAndScoreFromDoc(docFile, originalFileName, fileSlug, pastaDestino, tituloPasta, customLayout = null) {
    let markdown = '';
    let tags = [];
    let semanticOrderScore = 0.0;
    let tempoLeitura = 1;
    let nomeSemData = originalFileName; // Inicializa com o nome original
    const isPostsFolder = pastaDestino.getName() === '_posts';
    let noIndex = !isPostsFolder;
    let hasNavigationFooter = true;

    try {
        const doc = DocumentApp.openById(docFile.getId());
        const body = doc.getBody();
        const fullText = body.getText().trim();

        // NOVO: Se o documento tiver apenas uma linha de texto, trata como um redirecionamento.
        if (fullText.length > 0 && !fullText.includes('\n')) {
            const redirectSlug = slugifyFileName(fullText);
            
            // Monta o conteúdo do arquivo de redirecionamento com front matter
            let redirectMarkdown = `---\n`;
            redirectMarkdown += `title: "${originalFileName}"\n`;
            redirectMarkdown += `layout: null\n`; // Não usa um layout do Jekyll
            redirectMarkdown += `no_index: true\n`; // Impede a indexação pelo nosso script
            redirectMarkdown += `search: false\n`; // Impede a indexação pela busca do Jekyll
            redirectMarkdown += `---\n\n`;
            redirectMarkdown += `<script>window.location.href="./${redirectSlug}.html"</script>`;

            return {
                markdownContent: redirectMarkdown,
                semanticOrderScore: 9999,
                tempoLeitura: 0,
                nomeSemData: originalFileName,
                noIndex: true,
                hasNavigationFooter: false,
                tags: [],
                desc: null
            };
        }
        
        // CÁLCULO DE TEMPO DE LEITURA (INTEGRADO)
        let textForReadingTime = fullText.replace(/\[.*?\]\(.*?\)/g, '');
        textForReadingTime = textForReadingTime.replace(/<div[^>]*>|<\/div>/gi, '');
        const words = textForReadingTime.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const rawTime = wordCount / 200.0;
        const roundedTime = Math.max(1, Math.round(rawTime));
        tempoLeitura = roundedTime;

        
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
        
        // --- 1. EXTRAÇÃO DE METADADOS (SCORE e TAGS) em passagem reversa ---
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
                
                // Pula o parágrafo atual se ele continha alguma propriedade de metadados
                if (isMetadata) {
                    continue;
                }
            }
            
            contentElementsInReverse.push(element);
        }

        // Se encontramos um título customizado no rodapé do documento, usamos ele.
        // Caso contrário, removemos a data do nome do arquivo para usar como título.
        if (customTitle) {
            nomeSemData = customTitle;
        } else {
            const regex = /^\d{4}-\d{2}-\d{2}-/;
            nomeSemData = normalizarAspas(originalFileName.replace(regex, ''));
        }
        let isPost = /^\d{4}-\d{2}-\d{2}-/.test(originalFileName);
        
        // --- 1.5 PRESERVAÇÃO DE METADADOS DO ARQUIVO DESTINO EXISTENTE ---
        // Se o Google Doc não possui tags ou descrição própria, preservamos o que já existe no .md destino.
        const targetMdFileName = `${fileSlug}.md`;
        try {
            const existingFiles = pastaDestino.getFilesByName(targetMdFileName);
            if (existingFiles.hasNext()) {
                const existingMdContent = existingFiles.next().getBlob().getDataAsString();
                const fmMatch = existingMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (fmMatch) {
                    const fmText = fmMatch[1];
                    // Preservar tags se o Google Doc não definiu nenhuma
                    if (!tagsFound || tags.length === 0) {
                        const tagsBlockMatch = fmText.match(/^tags:\s*\n((?:\s*-\s*.*(?:\n|$))+)/im);
                        if (tagsBlockMatch) {
                            tags = tagsBlockMatch[1].split('\n')
                                .map(line => {
                                    const m = line.match(/^\s*-\s*(.+)$/);
                                    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
                                })
                                .filter(Boolean);
                        } else {
                            const tagsInlineMatch = fmText.match(/^tags:\s*\[(.*?)\]/im);
                            if (tagsInlineMatch) {
                                tags = tagsInlineMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                            }
                        }
                    }
                    // Preservar descrição/desc se o Google Doc não definiu
                    if (!customDesc) {
                        const descMatch = fmText.match(/^(description|desc):\s*["']?(.*?)["']?\s*$/im);
                        if (descMatch) {
                            descKey = descMatch[1].toLowerCase();
                            customDesc = descMatch[2].trim();
                        }
                    }
                }
            }
        } catch (e) {
            Logger.log(`[AVISO] Falha ao ler metadados existentes em "${targetMdFileName}": ${e.toString()}`);
        }

        // --- 2. MONTAGEM DO YAML FRONT MATTER ---
        const cleanTitle = normalizarAspas(nomeSemData).replace(/^["'“`”‘'«»]+|["'“`”‘'«»]+$/g, '').trim();
        const defaultFolderLayout = obterLayoutDaPasta(pastaDestino);
        const chosenLayout = customDocLayout ? customDocLayout : (customLayout ? customLayout : (isPostsFolder ? 'post' : defaultFolderLayout));
        markdown += `---\n`;
        markdown += `layout: ${chosenLayout}\n`;
        markdown += `title: "${cleanTitle}"\n`;
        // ADIÇÃO DOS METADADOS PARA OTIMIZAÇÃO FUTURA
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

        if (isPostsFolder) {
             const dateObj = docFile.getLastUpdated();
             const dateTimeStr = customDateStr ? customDateStr : Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
             markdown += `date: ${dateTimeStr}\n`;
        }
        markdown += `--- \n\n`;

        // --- 3. CONVERSÃO DO CORPO (LIMPO) PARA MARKDOWN ---

        if (fileSlug !== 'index') {
            let linkIndex = "./";
            if (!isPost && !isPostsFolder && pastaDestino.getId() !== ROOT_DESTINATION_FOLDER_ID) markdown += `\n\n### [${tituloPasta}](${linkIndex})\n\n`;
        }

        const contentElements = contentElementsInReverse.reverse();

        // Filtrar elementos de Front Matter no início do documento para não repetir no corpo
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

        // [Lógica de conversão de corpo para Markdown...]
        for (let i = 0; i < bodyElements.length; i++) {
            const element = bodyElements[i];
            const elementType = element.getType();

            if (elementType === DocumentApp.ElementType.PARAGRAPH) {
                const paragraph = element.asParagraph();
                const heading = paragraph.getHeading();

                let rawText = '';
                let inBoldRun = false;
                let inItalicRun = false;
                let inBoldItalicRun = false;
                for (let j = 0; j < paragraph.getNumChildren(); j++) {
                    const child = paragraph.getChild(j);
                    if (child.getType() === DocumentApp.ElementType.TEXT) {
                        const textElement = child.asText();
                        const textContent = normalizarAspas(textElement.getText());
                        for (let k = 0; k < textContent.length; k++) {
                            const char = textContent[k];
                            const isBold = textElement.isBold(k);
                            const isItalic = textElement.isItalic(k);
                            
                            // Lógica de itálico/negrito
                            if (char === '\r' || char === '\n') {
                                if (inBoldItalicRun) {
                                    rawText += "***";
                                    inBoldItalicRun = false; inBoldRun = false; inItalicRun = false;
                                } else {
                                    if (inBoldRun) { rawText += '**'; inBoldRun = false; }
                                    if (inItalicRun) { rawText += '*'; inItalicRun = false; }
                                }
                                rawText += char;
                                continue;
                            }

                            if (char===' ' && inBoldItalicRun) { 
                              rawText +="*** "; 
                              inBoldItalicRun = false,  inBoldRun = false; inItalicRun = false;
                              continue;
                            }

                            if (isBold && !inBoldRun & char!==' ') { rawText += '**'; inBoldRun = true; } 
                            else if (!isBold && inBoldRun) { rawText += '**'; inBoldRun = false; }
                            
                            if (isItalic && !inItalicRun & char!==' ') { rawText += '*'; inItalicRun = true; } 
                            else if (!isItalic && inItalicRun) {   rawText += '*'; inItalicRun = false; }
                            
                            inBoldItalicRun = inItalicRun && inBoldRun;
                            
                            rawText += char;
                        }
                        if (inBoldRun) { rawText += '**'; inBoldRun = false; }
                        if (inItalicRun) { rawText += '*'; inItalicRun = false; }
                        

                    } else {
                        rawText += child.getText ? child.getText() : '';
                    }
                }

                let text = rawText.replace(/(\r\n|\r|\n)/g, '  \n');
                
                // Formata imagens com hNN% (largura) ou vNN% (altura)
                // hr e vr alinham a figura a direita
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
                let inBoldRun = false;
                let inItalicRun = false;
                let inBoldItalicRun = false;
                for (let j = 0; j < listItem.getNumChildren(); j++) {
                    const child = listItem.getChild(j);
                    if (child.getType() === DocumentApp.ElementType.TEXT) {
                        const textElement = child.asText();
                        const textContent = normalizarAspas(textElement.getText());
                        for (let k = 0; k < textContent.length; k++) {
                            const char = textContent[k];
                            const isBold = textElement.isBold(k);
                            const isItalic = textElement.isItalic(k);
                            
                            if (char === '\r' || char === '\n') {
                                if (inBoldItalicRun) {
                                    rawText += "***";
                                    inBoldItalicRun = false; inBoldRun = false; inItalicRun = false;
                                } else {
                                    if (inBoldRun) { rawText += '**'; inBoldRun = false; }
                                    if (inItalicRun) { rawText += '*'; inItalicRun = false; }
                                }
                                rawText += char;
                                continue;
                            }

                            if (char===' ' && inBoldItalicRun) { 
                              rawText +="*** "; 
                              inBoldItalicRun = false; inBoldRun = false; inItalicRun = false;
                              continue;
                            }

                            if (isBold && !inBoldRun && char!==' ') { rawText += '**'; inBoldRun = true; } 
                            else if (!isBold && inBoldRun) { rawText += '**'; inBoldRun = false; }
                            
                            if (isItalic && !inItalicRun && char!==' ') { rawText += '*'; inItalicRun = true; } 
                            else if (!isItalic && inItalicRun) {   rawText += '*'; inItalicRun = false; }
                            
                            if (!inBoldItalicRun) {
                              inBoldItalicRun = inItalicRun && inBoldRun;
                            }

                            rawText += char;
                        }
                        if (inBoldRun) { rawText += '**'; inBoldRun = false; }
                        if (inItalicRun) { rawText += '*'; inItalicRun = false; }
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

                    // Determina a quantidade máxima de colunas na tabela
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

                                    // Processa elementos internos da célula para manter negrito e itálico
                                    for (let j = 0; j < cell.getNumChildren(); j++) {
                                        const child = cell.getChild(j);
                                        if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
                                            const p = child.asParagraph();
                                            let pText = '';
                                            let inBoldRun = false;
                                            let inItalicRun = false;
                                            let inBoldItalicRun = false;

                                            for (let k = 0; k < p.getNumChildren(); k++) {
                                                const textChild = p.getChild(k);
                                                if (textChild.getType() === DocumentApp.ElementType.TEXT) {
                                                    const textElement = textChild.asText();
                                                    const textContent = normalizarAspas(textElement.getText());
                                                    for (let chIdx = 0; chIdx < textContent.length; chIdx++) {
                                                        const char = textContent[chIdx];
                                                        const isBold = textElement.isBold(chIdx);
                                                        const isItalic = textElement.isItalic(chIdx);

                                                        if (char === '\r' || char === '\n') {
                                                            if (inBoldItalicRun) {
                                                                pText += "***";
                                                                inBoldItalicRun = false; inBoldRun = false; inItalicRun = false;
                                                            } else {
                                                                if (inBoldRun) { pText += '**'; inBoldRun = false; }
                                                                if (inItalicRun) { pText += '*'; inItalicRun = false; }
                                                            }
                                                            pText += ' ';
                                                            continue;
                                                        }

                                                        if (char === ' ' && inBoldItalicRun) {
                                                            pText += "*** ";
                                                            inBoldItalicRun = false; inBoldRun = false; inItalicRun = false;
                                                            continue;
                                                        }

                                                        if (isBold && !inBoldRun && char !== ' ') { pText += '**'; inBoldRun = true; }
                                                        else if (!isBold && inBoldRun) { pText += '**'; inBoldRun = false; }

                                                        if (isItalic && !inItalicRun && char !== ' ') { pText += '*'; inItalicRun = true; }
                                                        else if (!isItalic && inItalicRun) { pText += '*'; inItalicRun = false; }

                                                        inBoldItalicRun = inItalicRun && inBoldRun;
                                                        pText += char;
                                                    }
                                                    if (inBoldRun) { pText += '**'; inBoldRun = false; }
                                                    if (inItalicRun) { pText += '*'; inItalicRun = false; }
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

                                    // Fallback caso não tenha obtido texto via filhos
                                    if (!cellFormattedText) {
                                        cellFormattedText = cell.getText() ? cell.getText().trim() : '';
                                    }

                                    // Escapa pipes e converte eventuais quebras restantes para <br>
                                    let cleanCell = cellFormattedText
                                        .replace(/\|/g, '\\|')
                                        .replace(/(\r\n|\r|\n)/g, '<br>')
                                        .trim();

                                    cellTexts.push(cleanCell);
                                } else {
                                    cellTexts.push('');
                                }
                            }

                            // Linha de dados da tabela
                            tableMarkdown += `| ${cellTexts.join(' | ')} |\n`;

                            // Insere o divisor de cabeçalho padrão logo após a primeira linha (Row 0)
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
        // O link de retorno ao index da pasta será adicionado na função que gera o rodapé.

        return {
            markdownContent: markdown.trim(),
            semanticOrderScore: semanticOrderScore,
            tempoLeitura: tempoLeitura,
            nomeSemData: nomeSemData, // Retorna o nome sem data para uso na navegação
            noIndex: noIndex,
            hasNavigationFooter: hasNavigationFooter,
            tags: tags,
            desc: customDesc
        };

    } catch (e) {
        Logger.log(`[ERRO CRÍTICO] Falha ao processar o Google Doc ${docFile.getName()}: ${e.toString()}`);
        return {
            markdownContent: `\n\n[ERRO NA CONVERSÃO]: ${e.toString()}\n\n`,
            semanticOrderScore: 0.0,
            tempoLeitura: tempoLeitura,
            nomeSemData: originalFileName, // Retorna o nome original em caso de erro
            noIndex: false,
            hasNavigationFooter: true,
            tags: [],
            desc: null
        };
    }
}

function splitComentario(texto) {
  
  // A Regex para capturar a primeira parte (até o primeiro ':') e o resto.
  var regex = /^([^:]+):\s*(.*)$/;
  
  var resultado = texto.match(regex);
  
  if (resultado) {
    return [resultado[1], resultado[2]];
  } else {
    return [texto];
  }
}

/**
 * Copia o arquivo index.md da pasta fonte para a pasta destino se ele existir.
 * Retorna true se o arquivo foi criado ou atualizado.
 */
function copiarIndexMdFonte(arquivoFonte, pastaDestino) {
    try {
        const conteudoFonte = DocumentApp.openById(arquivoFonte.getId()).getBody().getText();
        const arquivosDestino = pastaDestino.getFilesByName(NOME_INDEX);

        if (arquivosDestino.hasNext()) {
            const arquivoDestino = arquivosDestino.next();
            const conteudoDestino = arquivoDestino.getBlob().getDataAsString();
            
            if (conteudoFonte !== conteudoDestino) {
                arquivoDestino.setContent(conteudoFonte);
                Logger.log(`[INDEX] ${NOME_INDEX} copiado da fonte e ATUALIZADO em ${pastaDestino.getName()}`);
                return true;
            }
            return false;
        } else {
            pastaDestino.createFile(NOME_INDEX, conteudoFonte, MIME_MARKDOWN);
            Logger.log(`[INDEX] ${NOME_INDEX} copiado da fonte e CRIADO em ${pastaDestino.getName()}`);
            return true;
        }
    } catch (e) {
        Logger.log(`[AVISO] Falha temporária ao copiar index da fonte para "${pastaDestino.getName()}": ${e.toString()}`);
        return false;
    }
}

/**
 * Gera e salva/atualiza o arquivo index.md na pasta de destino.
 * @returns {boolean} True se o index.md foi criado ou teve seu conteúdo alterado.
 */
function criarIndexMarkdown(pastaDestino, titulo, arquivos, subpastas, comentario, nomeArquivoIndex = "index.md") {

    // Não gera index na pasta se não houver conteúdo nela
    if (arquivos.length === 0 && subpastas.length === 0) { 
      return false;
    }
    const isRootFolder = pastaDestino.getId() === ROOT_DESTINATION_FOLDER_ID;
    if (isRootFolder) return false;
    const folderLayout = obterLayoutDaPasta(pastaDestino);
    let indexContent = `---\nlayout: ${folderLayout}\n---\n\n## ${titulo}\n\n`;
    if (comentario!=="") indexContent += "#### " + comentario + "\n\n";
    
    if (arquivos.length > 0) {
        
        arquivos.forEach(doc => {
            const timeFormat = `<span class="word-count">[${doc.time} min]</span>`;
            const docTitle = doc.title || doc.nomeSemData || splitComentario(doc.original)[0];
            const nome_descr = splitComentario(doc.original);
            indexContent += `### 📄 [${docTitle}](${doc.link}) ${timeFormat}\n`;
            if (doc.desc) {
                indexContent += `${doc.desc}\n`;
            } else if (nome_descr.length > 1) {
                indexContent += `${nome_descr[1]}\n`;
            }
        });
        indexContent += `\n`;
    }

    if (subpastas.length > 0) {
        subpastas.forEach(sub => {
            indexContent += `### 📁 [${sub.name.replace(/_/g, ' ')}](${sub.link})\n`;
            if (sub.comentario.length>1) indexContent += `${sub.comentario}\n`;
          });
    }

    // 2. ADICIONA LINK DE VOLTA
    let finalContent = indexContent.trim();

    // 3. VERIFICA E ATUALIZA
    try {
        const arquivosIndex = pastaDestino.getFilesByName(nomeArquivoIndex);

        if (arquivosIndex.hasNext()) {
            const indexFile = arquivosIndex.next();

            const existingContent = indexFile.getBlob().getDataAsString();

            if (existingContent.trim() === finalContent.trim()) {
                return false; // Não foi alterado
            }

            indexFile.setContent(finalContent);
            Logger.log(`${nomeArquivoIndex} ATUALIZADO em: ${pastaDestino.getName()} (Conteúdo alterado).`);
            return true; // Foi atualizado
        } else {
            // ARQUIVO NÃO EXISTE: Cria
            pastaDestino.createFile(nomeArquivoIndex, finalContent, MIME_MARKDOWN);
            Logger.log(`${nomeArquivoIndex} CRIADO em: ${pastaDestino.getName()}.`);
            return true; // Foi criado
        }
    } catch (e) {
        Logger.log(`[AVISO] Falha temporária ao criar/atualizar ${nomeArquivoIndex} em "${pastaDestino.getName()}": ${e.toString()}`);
        return false;
    }
}

// --- FUNÇÕES DE LIMPEZA ---

/**
 * Função recursiva para limpar arquivos .md no destino que não têm um Doc original na fonte.
 * Itera em toda a hierarquia de forma recursiva.
 */
function limparArquivosExcluidos(pastaDestino, pastaFonte) {

    // 1. Otimização: Coleta todos os slugs válidos da pasta fonte.
    const slugsFonteValidos = new Set();
    const arquivosDocFonte = pastaFonte.getFilesByType(MIME_GOOGLE_DOCS);
    
    const isPostsFolder = pastaDestino.getName() === '_posts';

    while (arquivosDocFonte.hasNext()) {
        const doc = arquivosDocFonte.next();
        const nomeDoc = doc.getName();
        let slug = slugifyFileName(nomeDoc);
        
        if (isPostsFolder) {
             const dateObj = doc.getLastUpdated();
             const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
             if (!/^\d{4}-\d{2}-\d{2}-/.test(slug)) {
                 slug = `${dateStr}-${slug}`;
             }
        }
        slugsFonteValidos.add(slug + ".md");
    }

    // Protege arquivos .md nativos que foram copiados diretamente da origem
    const arquivosNativosFonte = pastaFonte.getFiles();
    while (arquivosNativosFonte.hasNext()) {
        const arq = arquivosNativosFonte.next();
        const nomeArq = arq.getName();
        if (nomeArq.toLowerCase().endsWith('.md')) {
            slugsFonteValidos.add(nomeArq);
        }
    }

    if (isPostsFolder && AFORISMOS_DOC_ID) {
         try {
             const aforismosDoc = DriveApp.getFileById(AFORISMOS_DOC_ID);
             const nomesAforismos = obterNomesArquivosAforismos(aforismosDoc);
             nomesAforismos.forEach(nome => slugsFonteValidos.add(nome));
         } catch(e) {
             Logger.log("Erro ao ler Aforismos na limpeza: " + e);
         }
    }

    // 2. Limpeza: Itera apenas nos arquivos .md do destino.
    const arquivosDestino = pastaDestino.getFiles();
    while (arquivosDestino.hasNext()) {
        const arquivoMd = arquivosDestino.next();
        const nomeArquivoMd = arquivoMd.getName();

        if (nomeArquivoMd.toLowerCase().endsWith('.md') && nomeArquivoMd !== NOME_INDEX) {    
            if (!slugsFonteValidos.has(nomeArquivoMd)) {
                Logger.log(`[LIMPEZA] Arquivo .md "${nomeArquivoMd}" (em ${pastaDestino.getName()}) movido para lixeira.`);
                arquivoMd.setTrashed(true);
            } else if (/.*\([0-9]+\).md/.test(nomeArquivoMd)) {
                Logger.log(`[LIMPEZA] Arquivo .md "${nomeArquivoMd}" (em ${pastaDestino.getName()}) movido para lixeira.`);
                arquivoMd.setTrashed(true);
            }
        }
    }
    // 3. Processa as subpastas recursivamente
    const subpastasFonteIter = pastaFonte.getFolders();
    const listaSubpastas = [];
    while (subpastasFonteIter.hasNext()) {
        listaSubpastas.push(subpastasFonteIter.next());
    }

    for (let fIdx = 0; fIdx < listaSubpastas.length; fIdx++) {
        const subpastaFonte = listaSubpastas[fIdx];
        let nomeSubpastaCompleto = subpastaFonte.getName();
        let nomeParaProcessar = nomeSubpastaCompleto;
        if (nomeSubpastaCompleto !== '_posts') {
            nomeParaProcessar = nomeSubpastaCompleto.replace(/_/g, ' ');
        }
        
        const nomeSubpasta = splitComentario(nomeParaProcessar)[0];
        
        let nomeDestino = nomeSubpasta;
        if (nomeSubpastaCompleto !== '_posts') {
            nomeDestino = slugifyFileName(nomeSubpasta);
        }

        const subpastasDestinoIterator = pastaDestino.getFoldersByName(nomeDestino);

        if (subpastasDestinoIterator.hasNext()) {
            limparArquivosExcluidos(subpastasDestinoIterator.next(), subpastaFonte);
        }
    }
}

// --- SINCRONIZAÇÃO DE METADADOS COM A PASTA _DATA ---

/**
 * Obtém a pasta _data da raiz do site.
 */
function obterPastaData() {
    if (DATA_FOLDER) return DATA_FOLDER;
    let root = null;
    if (ROOT_DESTINATION_FOLDER_ID) {
        try {
            root = DriveApp.getFolderById(ROOT_DESTINATION_FOLDER_ID);
        } catch (e) {}
    }
    if (!root) {
        root = encontrarCriarPastaPorCaminho(CAMINHO_PASTA_DESTINO, false);
    }
    if (!root) return null;
    const dataIter = root.getFoldersByName("_data");
    if (dataIter.hasNext()) {
        DATA_FOLDER = dataIter.next();
        return DATA_FOLDER;
    }
    return null;
}

/**
 * Atualiza o tempo de leitura, tags e desc em arquivos .json na pasta _data,
 * se o nome do json estiver contido no nome da pasta de destino e houver item com o filename correspondente.
 * Se o item não existir no JSON, insere-o automaticamente.
 */
function atualizarDataJsonSeNecessario(docInfo, pastaDestino) {
    try {
        const pastaData = obterPastaData();
        if (!pastaData) return;

        const folderName = pastaDestino.getName().toLowerCase();
        const normFolderName = folderName.replace(/[-_]/g, '');
        const filesIter = pastaData.getFiles();

        while (filesIter.hasNext()) {
            const file = filesIter.next();
            const fileName = file.getName();
            if (!fileName.toLowerCase().endsWith('.json')) continue;

            const jsonBaseName = fileName.replace(/\.json$/i, '').toLowerCase();
            const normJsonName = jsonBaseName.replace(/[-_]/g, '');

            // Verifica se o nome do json está contido no nome da pasta ou vice-versa
            if (!normFolderName.includes(normJsonName) && !normJsonName.includes(normFolderName)) {
                continue;
            }

            let contentStr = file.getBlob().getDataAsString();
            let dataObj;
            try {
                dataObj = JSON.parse(contentStr);
            } catch (e) {
                Logger.log(`[AVISO _DATA] JSON inválido em "${fileName}": ${e.toString()}`);
                continue;
            }

            const formattedTime = `${docInfo.time} min`;
            const itemJaExiste = itemExisteNoObjeto(
                dataObj,
                docInfo.slug,
                docInfo.markdownName,
                pastaDestino.getName()
            );

            let wasUpdated = false;

            if (itemJaExiste) {
                wasUpdated = atualizarItemNoObjeto(
                    dataObj,
                    docInfo.slug,
                    docInfo.markdownName,
                    pastaDestino.getName(),
                    formattedTime,
                    docInfo.tags,
                    docInfo.desc,
                    docInfo.nomeSemData
                );
            } else {
                wasUpdated = inserirItemNoObjetoSeNaoExistir(
                    dataObj,
                    docInfo,
                    pastaDestino.getName(),
                    formattedTime
                );
            }

            // Sempre reordena o JSON de acordo com a ordem do index.md
            const ordemSlugsIndex = extrairOrdemDoIndexMd(pastaDestino);
            const foiReordenado = reordenarObjetoJson(dataObj, ordemSlugsIndex, pastaDestino.getName());

            if (wasUpdated || foiReordenado) {
                const newContent = JSON.stringify(dataObj, null, 2) + '\n';
                if (contentStr.trim() !== newContent.trim()) {
                    file.setContent(newContent);
                    Logger.log(`[_DATA] Atualizado/Reordenado em "${fileName}" para "${docInfo.slug}" (tempo: ${formattedTime}, tags: ${JSON.stringify(docInfo.tags || [])}, desc: ${docInfo.desc ? `"${docInfo.desc}"` : 'não alterado'}).`);
                }
            }
        }
    } catch (e) {
        Logger.log(`[ERRO _DATA] Falha ao atualizar dados em _data para "${docInfo.slug}": ${e.toString()}`);
    }
}

/**
 * Retorna o layout customizado associado ao nome da pasta de destino.
 */
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

/**
 * Extrai a ordem dos slugs dos arquivos listados em index.md da pasta destino.
 */
function extrairOrdemDoIndexMd(pastaDestino) {
    const arquivosIndex = pastaDestino.getFilesByName(NOME_INDEX);
    if (!arquivosIndex.hasNext()) return [];

    try {
        const indexFile = arquivosIndex.next();
        const content = indexFile.getBlob().getDataAsString();

        // Regex para capturar links em Markdown ex: [Título](./filename.html) ou [Título](filename.html)
        const regexLink = /\]\(\s*(?:\.\/)?([^)\s]+)\s*\)/g;
        const slugs = [];
        let match;

        while ((match = regexLink.exec(content)) !== null) {
            const rawPath = match[1];
            if (!rawPath) continue;
            const filename = rawPath.split('/').pop().trim();
            if (filename && filename !== 'index.html' && filename !== 'index.md' && !filename.endsWith('/') && !filename.startsWith('http') && !filename.startsWith('#')) {
                const slug = filename.replace(/\.(html|md)$/i, '');
                if (!slugs.includes(slug)) {
                    slugs.push(slug);
                }
            }
        }
        return slugs;
    } catch (e) {
        Logger.log(`[AVISO] Falha ao extrair ordem do index.md em "${pastaDestino.getName()}": ${e.toString()}`);
        return [];
    }
}

/**
 * Reordena os itens no array JSON (ou lista de stories) com base na ordem dos slugs.
 * Atualiza a propriedade 'number' (1, 2, 3...) se ela existir nos itens do array.
 * Retorna true se a ordem ou as propriedades 'number' foram alteradas.
 */
function reordenarObjetoJson(dataObj, ordemSlugs, folderName) {
    if (!dataObj || typeof dataObj !== 'object' || !ordemSlugs || ordemSlugs.length === 0) return false;
    let foiAlterado = false;

    function getSlugDoItem(item) {
        if (!item || typeof item !== 'object') return '';
        if (item.id && typeof item.id === 'string') return item.id.trim();
        if (item.filename && typeof item.filename === 'string') {
            return item.filename.split('/').pop().replace(/\.(html|md)$/i, '').trim();
        }
        return '';
    }

    function getRankDoItem(item) {
        const slug = getSlugDoItem(item);
        if (!slug) return 9999;
        const idx = ordemSlugs.indexOf(slug);
        return idx !== -1 ? idx : 9999;
    }

    if (Array.isArray(dataObj)) {
        const isVolumeList = dataObj.some(item => item && Array.isArray(item.stories));

        if (isVolumeList) {
            const normFolderName = folderName.toLowerCase().replace(/[-_]/g, '');
            for (let i = 0; i < dataObj.length; i++) {
                const vol = dataObj[i];
                if (!vol || !Array.isArray(vol.stories)) continue;
                const volFolder = (vol.folder || '').toLowerCase().replace(/[-_/\\]/g, '');
                const volId = (vol.id || '').toLowerCase().replace(/[-_]/g, '');

                if (volFolder === normFolderName || volId === normFolderName || normFolderName.includes(volId) || volId.includes(normFolderName)) {
                    const originalStr = JSON.stringify(vol.stories.map(getSlugDoItem));
                    vol.stories.sort((a, b) => getRankDoItem(a) - getRankDoItem(b));
                    const newStr = JSON.stringify(vol.stories.map(getSlugDoItem));
                    if (originalStr !== newStr) {
                        foiAlterado = true;
                    }
                }
            }
        } else {
            const temPropriedadeNumber = dataObj.some(item => item && typeof item.number === 'number');
            const originalStr = JSON.stringify(dataObj.map(getSlugDoItem));

            dataObj.sort((a, b) => getRankDoItem(a) - getRankDoItem(b));

            const newStr = JSON.stringify(dataObj.map(getSlugDoItem));
            if (originalStr !== newStr) {
                foiAlterado = true;
            }

            if (temPropriedadeNumber) {
                for (let i = 0; i < dataObj.length; i++) {
                    if (dataObj[i] && typeof dataObj[i] === 'object') {
                        if (dataObj[i].number !== i + 1) {
                            dataObj[i].number = i + 1;
                            foiAlterado = true;
                        }
                    }
                }
            }
        }
    }

    return foiAlterado;
}

/**
 * Reordena todos os arquivos .json em _data correspondentes à pastaDestino
 * com base na ordem dos arquivos no index.md (ou em arquivosIndexados).
 */
function reordenarDataJsonDaPasta(pastaDestino, arquivosIndexados = []) {
    try {
        const pastaData = obterPastaData();
        if (!pastaData) return;

        let ordemSlugs = extrairOrdemDoIndexMd(pastaDestino);

        if (ordemSlugs.length === 0 && arquivosIndexados && arquivosIndexados.length > 0) {
            ordemSlugs = arquivosIndexados.map(doc => doc.slug);
        }

        if (ordemSlugs.length === 0) return;

        const folderName = pastaDestino.getName().toLowerCase();
        const normFolderName = folderName.replace(/[-_]/g, '');
        const filesIter = pastaData.getFiles();

        while (filesIter.hasNext()) {
            const file = filesIter.next();
            const fileName = file.getName();
            if (!fileName.toLowerCase().endsWith('.json')) continue;

            const jsonBaseName = fileName.replace(/\.json$/i, '').toLowerCase();
            const normJsonName = jsonBaseName.replace(/[-_]/g, '');

            if (!normFolderName.includes(normJsonName) && !normJsonName.includes(normFolderName)) {
                continue;
            }

            let contentStr = file.getBlob().getDataAsString();
            let dataObj;
            try {
                dataObj = JSON.parse(contentStr);
            } catch (e) {
                continue;
            }

            const foiReordenado = reordenarObjetoJson(dataObj, ordemSlugs, pastaDestino.getName());

            if (foiReordenado) {
                const newContent = JSON.stringify(dataObj, null, 2) + '\n';
                if (contentStr.trim() !== newContent.trim()) {
                    file.setContent(newContent);
                    Logger.log(`[_DATA REORDENADO] Reordenado "${fileName}" de acordo com a ordem do index.md.`);
                }
            }
        }
    } catch (e) {
        Logger.log(`[ERRO REORDENAR _DATA] Falha ao reordenar JSON para pasta "${pastaDestino.getName()}": ${e.toString()}`);
    }
}

/**
 * Verifica se um item já existe no objeto/array JSON pelo slug ou filename.
 */
function itemExisteNoObjeto(obj, slug, markdownName, folderName) {
    if (!obj || typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (itemExisteNoObjeto(obj[i], slug, markdownName, folderName)) {
                return true;
            }
        }
        return false;
    }

    const htmlName = `${slug}.html`;
    const relativeHtml = `${folderName}/${htmlName}`;

    if (obj.filename && typeof obj.filename === 'string') {
        const fn = obj.filename.trim();
        if (fn === htmlName || fn === relativeHtml || fn === markdownName || fn.endsWith('/' + htmlName)) {
            return true;
        } else if (fn.replace(/\.(html|md)$/i, '') === slug || fn.replace(/\.(html|md)$/i, '').endsWith('/' + slug)) {
            return true;
        }
    } else if (obj.id && typeof obj.id === 'string' && obj.id.trim() === slug) {
        if (!obj.stories && !obj.items && !obj.children) {
            return true;
        }
    }

    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (itemExisteNoObjeto(obj[key], slug, markdownName, folderName)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Percorre recursivamente o objeto/array JSON e atualiza tempo, tags e desc do item com filename correspondente.
 */
function atualizarItemNoObjeto(obj, slug, markdownName, folderName, formattedTime, tags, desc, title) {
    if (!obj || typeof obj !== 'object') return false;
    let anyUpdated = false;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (atualizarItemNoObjeto(obj[i], slug, markdownName, folderName, formattedTime, tags, desc, title)) {
                anyUpdated = true;
            }
        }
        return anyUpdated;
    }

    // Verifica se este objeto é o item procurado
    const htmlName = `${slug}.html`;
    const relativeHtml = `${folderName}/${htmlName}`;
    let isMatch = false;

    if (obj.filename && typeof obj.filename === 'string') {
        const fn = obj.filename.trim();
        if (fn === htmlName || fn === relativeHtml || fn === markdownName || fn.endsWith('/' + htmlName)) {
            isMatch = true;
        } else if (fn.replace(/\.(html|md)$/i, '') === slug || fn.replace(/\.(html|md)$/i, '').endsWith('/' + slug)) {
            isMatch = true;
        }
    } else if (obj.id && typeof obj.id === 'string' && obj.id.trim() === slug) {
        if (!obj.stories && !obj.items && !obj.children) {
            isMatch = true;
        }
    }

    if (isMatch) {
        // Atualiza título se fornecido
        if (title && typeof title === 'string' && title.trim().length > 0) {
            const cleanTitle = title.trim();
            if (obj.title !== undefined && obj.title !== cleanTitle) {
                obj.title = cleanTitle;
                anyUpdated = true;
            }
            if (obj.name !== undefined && obj.name !== cleanTitle) {
                obj.name = cleanTitle;
                anyUpdated = true;
            }
        }

        // Atualiza tempo de leitura
        if (obj.meta !== undefined) {
            if (obj.meta !== formattedTime) {
                obj.meta = formattedTime;
                anyUpdated = true;
            }
        } else {
            if (obj.time !== formattedTime) {
                obj.time = formattedTime;
                anyUpdated = true;
            }
        }

        // Tags generation in JSON removed per user preference (managed by AI/pre-commit)

        // Atualiza desc se fornecido
        if (desc && typeof desc === 'string' && desc.trim().length > 0) {
            const cleanDesc = desc.trim();
            if (obj.desc !== cleanDesc) {
                obj.desc = cleanDesc;
                anyUpdated = true;
            }
        }
    }

    // Percorre propriedades filhas (ex: stories em cronicas.json ou chaves em reflexoes.json)
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (atualizarItemNoObjeto(obj[key], slug, markdownName, folderName, formattedTime, tags, desc, title)) {
                anyUpdated = true;
            }
        }
    }

    // Recalcula timeTotal e count se houver lista de stories
    if (obj.stories && Array.isArray(obj.stories)) {
        if (obj.count !== undefined && obj.count !== obj.stories.length) {
            obj.count = obj.stories.length;
            anyUpdated = true;
        }
        if (obj.timeTotal !== undefined) {
            let totalMin = 0;
            for (let s = 0; s < obj.stories.length; s++) {
                const story = obj.stories[s];
                if (story.time) {
                    const m = parseInt(story.time, 10);
                    if (!isNaN(m)) totalMin += m;
                }
            }
            const newTotalStr = `${totalMin} min`;
            if (obj.timeTotal !== newTotalStr) {
                obj.timeTotal = newTotalStr;
                anyUpdated = true;
            }
        }
    }

    return anyUpdated;
}

/**
 * Insere um novo item no objeto/array JSON caso ele não exista.
 */
function inserirItemNoObjetoSeNaoExistir(dataObj, docInfo, folderName, formattedTime) {
    if (!dataObj || typeof dataObj !== 'object') return false;

    if (Array.isArray(dataObj)) {
        // Verifica se é uma lista de volumes com stories (ex: cronicas.json)
        const isVolumeList = dataObj.some(item => item && Array.isArray(item.stories));

        if (isVolumeList) {
            const normFolderName = folderName.toLowerCase().replace(/[-_]/g, '');
            let targetVolume = null;

            for (let i = 0; i < dataObj.length; i++) {
                const vol = dataObj[i];
                if (!vol) continue;
                const volFolder = (vol.folder || '').toLowerCase().replace(/[-_/\\]/g, '');
                const volId = (vol.id || '').toLowerCase().replace(/[-_]/g, '');

                if (volFolder === normFolderName || volId === normFolderName || normFolderName.includes(volId) || volId.includes(normFolderName)) {
                    targetVolume = vol;
                    break;
                }
            }

            const newStory = {
                id: docInfo.slug,
                title: docInfo.nomeSemData || docInfo.original,
                time: formattedTime,
                filename: `${folderName}/${docInfo.slug}.html`,
                desc: docInfo.desc || ""
            };


            if (targetVolume) {
                if (!Array.isArray(targetVolume.stories)) {
                    targetVolume.stories = [];
                }
                const alreadyExists = targetVolume.stories.some(st =>
                    (st.id && st.id === docInfo.slug) ||
                    (st.filename && (st.filename === `${folderName}/${docInfo.slug}.html` || st.filename === `${docInfo.slug}.html` || st.filename.endsWith('/' + docInfo.slug + '.html')))
                );
                if (alreadyExists) {
                    return false;
                }
                targetVolume.stories.push(newStory);
                targetVolume.count = targetVolume.stories.length;

                let totalMin = 0;
                for (let s = 0; s < targetVolume.stories.length; s++) {
                    const st = targetVolume.stories[s];
                    if (st.time) {
                        const m = parseInt(st.time, 10);
                        if (!isNaN(m)) totalMin += m;
                    }
                }
                targetVolume.timeTotal = `${totalMin} min`;
                return true;
            } else {
                const newVol = {
                    id: folderName,
                    title: docInfo.nomeSemData || folderName,
                    folder: `${folderName}/`,
                    desc: "",
                    count: 1,
                    timeTotal: formattedTime,
                    stories: [newStory]
                };
                dataObj.push(newVol);
                return true;
            }
        } else {
            // Lista plana de itens (ex: poesias.json, ipes.json, cascudo.json, wingene.json)
            const alreadyExists = dataObj.some(item =>
                (item.id && item.id === docInfo.slug) ||
                (item.filename && (item.filename === `${docInfo.slug}.html` || item.filename === `${folderName}/${docInfo.slug}.html` || item.filename.endsWith('/' + docInfo.slug + '.html')))
            );
            if (alreadyExists) {
                return false;
            }

            const newItem = {
                id: docInfo.slug,
                title: docInfo.nomeSemData || docInfo.original,
                time: formattedTime,
                filename: `${docInfo.slug}.html`,
                desc: docInfo.desc || ""
            };

            if (dataObj.length > 0 && typeof dataObj[0].number === 'number') {
                newItem.number = dataObj.length + 1;
            }
            dataObj.push(newItem);
            return true;
        }
    } else {
        // Objeto chave-valor (ex: reflexoes.json)
        if (!dataObj[docInfo.slug]) {
            const newObj = {
                id: docInfo.slug,
                name: docInfo.nomeSemData || docInfo.original,
                filename: `${docInfo.slug}.html`,
                meta: formattedTime,
                desc: docInfo.desc || ""
            };

            dataObj[docInfo.slug] = newObj;
            return true;
        }
    }

    return false;
}
