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
let AFORISMOS_DOC_ID = null;
let totalFiles = 0;

// --- FUNÇÕES PRINCIPAIS E DE GESTÃO DE PASTAS ---

function principal(nomePastaRaiz = "Wingene") {

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

  // GERA SITEMAP
  gerarSitemap(pastaDestinoRaiz);

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
        }
    } catch (e) {
        Logger.log(`[ERRO METADATA MD] Falha ao ler metadados do MD ${arquivoMdDestino.getName()}: ${e.toString()}`);
    }

    return { semanticOrderScore: semanticOrderScore, tempoLeitura: tempoLeitura, noIndex: noIndex };
}

/**
 * Função recursiva para converter Google Docs para Markdown, criar o index.md e 
 * processar subpastas recursivamente.
 * @returns {number} O total de arquivos .md que foram criados ou atualizados.
 */
function converterPastaParaMarkdown(pastaFonte, pastaDestino) {

    const arquivosDoc = pastaFonte.getFilesByType(MIME_GOOGLE_DOCS);
    let filesConverted = 0;
    
    // Lista para armazenar metadados e conteúdo de TODOS os arquivos na pasta.
    const arquivosParaProcessar = []; 
    const arquivosIndexados = []; 
    // Listas para a versão UPPERCASE (Caixa Alta)
    const arquivosUpperParaProcessar = [];
    const arquivosUpperIndexados = [];

    let nomePastaFonte = pastaFonte.getName();
    if (nomePastaFonte !== '_posts') {
        nomePastaFonte = nomePastaFonte.replace(/_/g, ' ');
    }
    const comentarioPasta = splitComentario(nomePastaFonte);

    // 1. PRIMEIRA PASSAGEM: Coleta metadados, calcula o conteúdo e a necessidade de conversão
    while (arquivosDoc.hasNext()) {
        const arquivoDoc = arquivosDoc.next();

        const nomeDocOriginal = arquivoDoc.getName();
        if (nomeDocOriginal === 'Config' || nomeDocOriginal === 'index') continue;

        const nomeSlug = slugifyFileName(nomeDocOriginal);
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

        if (deveConverter) {
            // Conversão pesada (Corpo e Metadados)
             ({
                markdownContent, 
                semanticOrderScore,
                tempoLeitura,
                nomeSemData,
                noIndex
            } = getMarkdownAndScoreFromDoc(arquivoDoc, nomeDocOriginal, nomeSlug, pastaDestino, comentarioPasta[0]));

            if (nomeDocOriginal === 'Aforismos') {
                gerarPostsAforismos(arquivoDoc);
            }
        } else {
            // OTIMIZAÇÃO: Extrai Metadados do MD existente, evitando abrir o Google Doc
            if (arquivoMdDestino) {
                // LÊ DO ARQUIVO MD existente
                 ({
                    semanticOrderScore,
                    tempoLeitura,
                    noIndex
                } = getMetadataFromMd(arquivoMdDestino)); 
                
                // Extração leve do Doc apenas para nome (pode ser necessário para a navegação)
                const regex = /^\d{4}-\d{2}-\d{2}-/;
                nomeSemData = nomeDocOriginal.replace(regex, '');

            } else {
                 // Fallback: lê metadados do Doc se o MD não for encontrado
                ({
                    semanticOrderScore,
                    tempoLeitura,
                    nomeSemData,
                    noIndex
                } = getMetadataFromDocLite(arquivoDoc, nomeDocOriginal));
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
            deveConverter: deveConverter,
            arquivoMdDestino: arquivoMdDestino,
            nomeSemData: nomeSemData,
            docFile: arquivoDoc,
            noIndex: noIndex
        });

        // 1.4. Adiciona metadados para indexação (lista paralela)
        if (!noIndex) {
            arquivosIndexados.push({
                original: nomeDocOriginal,
                slug: nomeSlug,
                link: `./${nomeSlug}.html`,
                time: tempoLeitura,
                semanticOrder: semanticOrderScore
            });
        }

        // --- LÓGICA ESPECÍFICA: VERSÃO CAIXA ALTA (UPPER) ---
        // Apenas para a pasta solicitada
        if (pastaDestino.getName() === 'o-cascudo-e-outras-historias') {
            const nomeSlugUpper = nomeSlug + '-upper';
            const nomeMarkdownUpper = nomeSlugUpper + '.md';
            
            // Verifica se o arquivo Upper já existe
            let arquivoMdDestinoUpper = null;
            const iterUpper = pastaDestino.getFilesByName(nomeMarkdownUpper);
            if (iterUpper.hasNext()) arquivoMdDestinoUpper = iterUpper.next();

            let deveConverterUpper = converterTodos;
            if (arquivoMdDestinoUpper) {
                if (arquivoMdDestinoUpper.getLastUpdated().getTime() < arquivoDoc.getLastUpdated().getTime()) {
                    deveConverterUpper = true;
                }
            } else {
                deveConverterUpper = true;
            }

            let contentUpper = null;
            if (deveConverterUpper) {
                // Se já convertemos o normal, reaproveitamos o conteúdo trocando apenas o layout
                if (markdownContent) {
                    contentUpper = markdownContent.replace(/^layout: .*$/m, 'layout: uppercase');
                    contentUpper = contentUpper.replace(`### [${comentarioPasta[0]}](./)`, `### [${comentarioPasta[0]}](index-upper.html)`);
                } else {
                    // Se não convertemos o normal (estava atualizado), precisamos converter agora para o Upper
                    const resUpper = getMarkdownAndScoreFromDoc(arquivoDoc, nomeDocOriginal, nomeSlugUpper, pastaDestino, comentarioPasta[0], 'uppercase');
                    contentUpper = resUpper.markdownContent;
                }
            }

            arquivosUpperParaProcessar.push({
                original: nomeDocOriginal,
                slug: nomeSlugUpper,
                markdownName: nomeMarkdownUpper,
                content: contentUpper,
                semanticOrder: semanticOrderScore,
                time: tempoLeitura,
                deveConverter: deveConverterUpper,
                arquivoMdDestino: arquivoMdDestinoUpper,
                nomeSemData: nomeSemData, // Mantém o nome visual normal, o layout fará o uppercase visual
                noIndex: noIndex
            });

            if (!noIndex) {
                arquivosUpperIndexados.push({
                    original: nomeDocOriginal,
                    slug: nomeSlugUpper,
                    link: `./${nomeSlugUpper}.html`,
                    time: tempoLeitura,
                    semanticOrder: semanticOrderScore
                });
            }
        }
    }

    // 1.5. SINCRONIZAR ASSETS (Imagens e Vídeos)
    sincronizarAssets(pastaFonte, pastaDestino);

    // 2. ORDENAÇÃO
    // Ordena listas com a função sortDocs harmonizada
    arquivosParaProcessar.sort(sortDocs);
    arquivosIndexados.sort(sortDocs);
    arquivosUpperParaProcessar.sort(sortDocs);
    arquivosUpperIndexados.sort(sortDocs);
    
    // 3. SEGUNDA PASSAGEM (Inicial): SALVA E ADICIONA LINKS DE NAVEGAÇÃO
    function executarPassagemDeConversao(force = false) {
      let filesUpdated = 0;
      const isPostsFolder = pastaDestino.getName() === '_posts';

      for (let i = 0; i < arquivosParaProcessar.length; i++) {
          const docInfo = arquivosParaProcessar[i];

          // Se 'deveConverter' é true (novo/atualizado) OU se o rodapé está sendo forçado a ser reescrito
          if (docInfo.deveConverter || force) {
              
              // Determina Anterior e Próximo com a lista JÁ ORDENADA
              const anterior = (!isPostsFolder && i > 0) ? arquivosParaProcessar[i - 1] : null;
              const proximo = (!isPostsFolder && i < arquivosParaProcessar.length - 1) ? arquivosParaProcessar[i + 1] : null;

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


    // 3.1. PASSAGEM DE CONVERSÃO PARA ARQUIVOS UPPER (Se houver)
    if (arquivosUpperParaProcessar.length > 0) {
        for (let i = 0; i < arquivosUpperParaProcessar.length; i++) {
            const docInfo = arquivosUpperParaProcessar[i];
            if (docInfo.deveConverter) {
                const anterior = (i > 0) ? arquivosUpperParaProcessar[i - 1] : null;
                const proximo = (i < arquivosUpperParaProcessar.length - 1) ? arquivosUpperParaProcessar[i + 1] : null;
                
                const wasChanged = salvarArquivoMarkdownComNavegacao(docInfo, anterior, proximo, pastaDestino);
                if (wasChanged) filesConverted++;
            }
        }
        // Gera o index-upper.md
        const tituloIndexUpper = comentarioPasta[0] + " (CAIXA ALTA)";
        criarIndexMarkdown(pastaDestino, tituloIndexUpper, arquivosUpperIndexados, [], comentarioPastaTexto, "index-upper.md");
    }


    // 4. PROCESSA SUBPASTAS RECURSIVAMENTE E COLETA METADADOS
    const subpastasIndexadas = [];
    const subpastasFonte = pastaFonte.getFolders();
    
    while (subpastasFonte.hasNext()) {
        const subpastaFonte = subpastasFonte.next();
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
    const arquivosIndexFonte = pastaFonte.getFilesByName("index");
    if (arquivosIndexFonte.hasNext()) {
        indexAlterado = copiarIndexMdFonte(arquivosIndexFonte.next(), pastaDestino);
    } else {
        indexAlterado = criarIndexMarkdown(pastaDestino, tituloIndex, arquivosIndexados, subpastasIndexadas, comentarioPastaTexto);
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
        
        // Verifica se é para copiar diretamente
        if (mime === MimeType.JAVASCRIPT || mime === MimeType.HTML || mime === MimeType.JPEG || mime === MimeType.PNG || mime === MimeType.PDF || mime.startsWith('video/')) {
            const nomeArquivo = arquivo.getName();
            const arquivosDestino = pastaDestino.getFilesByName(nomeArquivo);
            
            if (arquivosDestino.hasNext()) {
                const arquivoDestino = arquivosDestino.next();
                // Se o arquivo fonte for mais recente, atualiza
                if (arquivo.getLastUpdated().getTime() > arquivoDestino.getLastUpdated().getTime()) {
                    Logger.log(`[ASSET ATUALIZADO] ${nomeArquivo} em ${pastaDestino.getName()}`);
                    try {
                        // Atualização atômica usando Advanced Drive Service (Drive API)
                        // Requer adicionar o serviço "Drive API" no editor do Apps Script
                        Drive.Files.update({
                            title: nomeArquivo,
                            mimeType: mime
                        }, arquivoDestino.getId(), arquivo.getBlob());
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
      
      if (nome.toLowerCase().endsWith('.md')) {
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
           if (nome === 'index.md') {
              urlPath = caminhoRelativo; 
           } else {
              urlPath = caminhoRelativo + nome.substring(0, nome.length - 3) + '.html';
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
    
    const navegacaoRodape = gerarNavegacaoRodape(anterior, proximo);
    let finalContent = null;
    let existingContent = null;
    let fileChanged = false;

    // Se o conteúdo NÃO foi convertido na primeira passagem, precisamos ler o .md existente
    if (docInfo.content === null) {
        if (!docInfo.arquivoMdDestino) {
             // Isso nunca deve acontecer se a lógica de deveConverter estiver correta
             Logger.log(`[ERRO CRÍTICO] Falha ao processar "${docInfo.original}". Content=null e arquivo MD não encontrado.`);
             return false;
        }
        // Lê o conteúdo do arquivo MD existente (exclui o rodapé antigo, se houver)
        existingContent = docInfo.arquivoMdDestino.getBlob().getDataAsString();
        let bodyContent = existingContent.replace(/\n\n---\n\n[\s\S]*$/, '').trim();
        finalContent = bodyContent + navegacaoRodape;

    } else {
        // Usa o conteúdo fresco do Doc convertido
        finalContent = docInfo.content + navegacaoRodape;
    }
    
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
        // Usa o nome sem data/formatação do index
        const nomeAnterior = anterior.nomeSemData; 
        navLinksHtml.push(`<a href="./${anterior.slug}.html">&lt;&lt; ${nomeAnterior}</a>`);
    } else {
        navLinksHtml.push('<span></span>'); // Placeholder para manter o espaçamento
    }

    if (proximo) {
        const nomeProximo = proximo.nomeSemData;
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
 * Extrai APENAS os metadados (score, tempo leitura, nome sem data) de um Google Doc.
 * Evita a conversão completa para Markdown para economizar tempo.
 */
function getMetadataFromDocLite(docFile, originalFileName) {
    let semanticOrderScore = 0.0;
    let tempoLeitura = 1;
    let nomeSemData = originalFileName; 
    let noIndex = true;
    
    try {
        const doc = DocumentApp.openById(docFile.getId());
        const body = doc.getBody();
        let fullText = body.getText().trim();

        // Se o documento contiver apenas um script de redirecionamento, marque-o como noIndex.
        const redirectRegex = /^<script>\s*location\.href\s*=\s*['"].*?['"]\s*<\/script>$/i;
        if (redirectRegex.test(fullText)) {
            return {
                semanticOrderScore: 9999,
                tempoLeitura: 0,
                nomeSemData: originalFileName,
                noIndex: true
            };
        }
        
        // 1. CÁLCULO DE TEMPO DE LEITURA
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '');
        fullText = fullText.replace(/<div[^>]*>|<\/div>/gi, '');
        const words = fullText.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const rawTime = wordCount / 200.0;
        const roundedTime = Math.max(1, Math.round(rawTime));
        tempoLeitura = roundedTime;

        // 2. EXTRAÇÃO DE SCORE
        const fullBodyText = body.getText();
        const scoreMatch = fullBodyText.match(REGEX_ORDENACAO);
        if (scoreMatch) {
            const scoreStr = scoreMatch[1].replace(',', '.');
            semanticOrderScore = parseFloat(scoreStr) || semanticOrderScore;
            noIndex = false;
        }

        // 3. REMOÇÃO DA DATA DO NOME
        const regex = /^\d{4}-\d{2}-\d{2}-/;
        nomeSemData = originalFileName.replace(regex, '');

        return {
            semanticOrderScore: semanticOrderScore,
            tempoLeitura: tempoLeitura,
            nomeSemData: nomeSemData,
            noIndex: noIndex
        };

    } catch (e) {
        Logger.log(`[ERRO LITE] Falha ao extrair metadados do Doc ${docFile.getName()}: ${e.toString()}`);
        return {
            semanticOrderScore: 0.0,
            tempoLeitura: tempoLeitura,
            nomeSemData: originalFileName,
            noIndex: false
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
        const title = text.length > 30 ? text.substring(0, 30) + "..." : text;
        
        const content = `---\nlayout: post\ntitle: "${title}"\ndate: ${dateTimeStr}\n---\n\n${text}`;
        
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
    let noIndex = true;

    try {
        const doc = DocumentApp.openById(docFile.getId());
        const body = doc.getBody();
        let fullTextForRedirectCheck = body.getText().trim();

        // Se o documento contiver apenas um script de redirecionamento, marque-o como noIndex e retorne.
        const redirectRegex = /^<script>\s*location\.href\s*=\s*['"].*?['"]\s*<\/script>$/i;
        if (redirectRegex.test(fullTextForRedirectCheck)) {
            return {
                markdownContent: fullTextForRedirectCheck,
                semanticOrderScore: 9999,
                tempoLeitura: 0,
                nomeSemData: originalFileName.replace(/^\d{4}-\d{2}-\d{2}-/, ''),
                noIndex: true
            };
        }
        
        // CÁLCULO DE TEMPO DE LEITURA (INTEGRADO)
        let fullText = body.getText().trim();
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '');
        fullText = fullText.replace(/<div[^>]*>|<\/div>/gi, '');
        const words = fullText.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const rawTime = wordCount / 200.0;
        const roundedTime = Math.max(1, Math.round(rawTime));
        tempoLeitura = roundedTime;

        
        let contentElementsInReverse = [];
        let tagsFound = false;
        let scoreFound = false;
        
        // --- 1. EXTRAÇÃO DE METADADOS (SCORE e TAGS) em passagem reversa ---
        for (let i = body.getNumChildren() - 1; i >= 0; i--) {
            const element = body.getChild(i);

            if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
                const paragraph = element.asParagraph();
                const text = paragraph.getText().trim();
                
                const tagMatch = text.match(/^tags:\s*(.*)/i);
                if (tagMatch && !tagsFound) {
                    const tagsString = tagMatch[1].replace(/\.\s*$/, "");
                    tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                    tagsFound = true;
                    continue; 
                }
                
                const scoreMatch = text.match(REGEX_ORDENACAO);
                if (scoreMatch && !scoreFound) {
                    const scoreStr = scoreMatch[1].replace(',', '.');
                    semanticOrderScore = parseFloat(scoreStr) || semanticOrderScore;
                    scoreFound = true;
                    noIndex = false;
                    continue;
                }
            }
            
            contentElementsInReverse.push(element);
        }

        // Remove a data do nome para o título (ex: "2023-10-27-Titulo" vira "Titulo")
        const regex = /^\d{4}-\d{2}-\d{2}-/;
        nomeSemData = originalFileName.replace(regex, '');
        let isPost = nomeSemData !== originalFileName;
        
        // --- 2. MONTAGEM DO YAML FRONT MATTER ---
        markdown += `---\n`;
        markdown += `layout: ${customLayout ? customLayout : (isPostsFolder ? 'post' : 'default')}\n`;
        markdown += `title: "${nomeSemData}"\n`;
        // ADIÇÃO DOS METADADOS PARA OTIMIZAÇÃO FUTURA
        markdown += `reading_time: ${tempoLeitura}\n`;
        markdown += `semantic_order: ${semanticOrderScore}\n`;

        if (noIndex) {
            markdown += `no_index: true\n`;
        }

        if (tags.length > 0) {
            markdown += `tags:\n`;
            tags.forEach(tag => {
                markdown += `  - ${tag}\n`;
            });
        }

        if (isPostsFolder) {
             const dateObj = docFile.getLastUpdated();
             const dateTimeStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
             markdown += `date: ${dateTimeStr}\n`;
        }
        markdown += `--- \n\n`;

        // --- 3. CONVERSÃO DO CORPO (LIMPO) PARA MARKDOWN ---

        if (fileSlug !== 'index') {
            let linkIndex = "./";
            if (customLayout === 'uppercase') {
                linkIndex = "index-upper.html";
            }
            if (!isPost && !isPostsFolder && pastaDestino.getId() !== ROOT_DESTINATION_FOLDER_ID) markdown += `\n\n### [${tituloPasta}](${linkIndex})\n\n`;
            if (!isPostsFolder) markdown += `## ${nomeSemData}\n\n`;
        }

        const contentElements = contentElementsInReverse.reverse();

        // [Lógica de conversão de corpo para Markdown...]
        for (let i = 0; i < contentElements.length; i++) {
            const element = contentElements[i];
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
                        const textContent = textElement.getText();
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
                        const textContent = textElement.getText();
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
            }
        }
        // O link de retorno ao index da pasta será adicionado na função que gera o rodapé.

        return {
            markdownContent: markdown.trim(),
            semanticOrderScore: semanticOrderScore,
            tempoLeitura: tempoLeitura,
            nomeSemData: nomeSemData, // Retorna o nome sem data para uso na navegação
            noIndex: noIndex
        };

    } catch (e) {
        Logger.log(`[ERRO CRÍTICO] Falha ao processar o Google Doc ${docFile.getName()}: ${e.toString()}`);
        return {
            markdownContent: `\n\n[ERRO NA CONVERSÃO]: ${e.toString()}\n\n`,
            semanticOrderScore: 0.0,
            tempoLeitura: tempoLeitura,
            nomeSemData: originalFileName, // Retorna o nome original em caso de erro
            noIndex: false
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
    if (pastaDestino.getName() === '_posts') return false;

    let indexContent = '## ' + titulo + '\n\n';
    if (comentario!=="") indexContent += "#### " + comentario + "\n\n";
    
    if (arquivos.length > 0) {
        
        arquivos.forEach(doc => {
            const timeFormat = `<span class="word-count">[${doc.time} min]</span>`;
            let nome_descr = splitComentario(doc.original);
            indexContent += `### 📄 [${nome_descr[0]}](${doc.link}) ${timeFormat}\n`;
            if (nome_descr.length>1) indexContent += `${nome_descr[1]}\n`;
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
        let slug = slugifyFileName(doc.getName());
        
        if (isPostsFolder) {
             const dateObj = doc.getLastUpdated();
             const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
             if (!/^\d{4}-\d{2}-\d{2}-/.test(slug)) {
                 slug = `${dateStr}-${slug}`;
             }
        }
        // Proteção para os arquivos UpperCase na pasta específica
        if (pastaDestino.getName() === 'o-cascudo-e-outras-historias') {
            slugsFonteValidos.add(slug + "-upper.md");
        }
        slugsFonteValidos.add(slug + ".md");
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

        if (nomeArquivoMd.toLowerCase().endsWith('.md') && nomeArquivoMd !== NOME_INDEX && nomeArquivoMd !== 'index-upper.md') {    
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
    const subpastasFonte = pastaFonte.getFolders();
    while (subpastasFonte.hasNext()) {
        const subpastaFonte = subpastasFonte.next();
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
