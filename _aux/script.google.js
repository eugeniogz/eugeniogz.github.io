/**
 * O CAMINHO COMPLETO da pasta fonte no Google Drive.
 */
const CAMINHO_PASTA_FONTE = "Pessoal/Meus.Textos/Finalizados";
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
let totalFiles = 0;

// --- FUNÇÕES PRINCIPAIS E DE GESTÃO DE PASTAS ---

function principal() {

  const pastaFonte = encontrarCriarPastaPorCaminho(CAMINHO_PASTA_FONTE, false);
  if (!pastaFonte) {
    const msg = `[ERRO] A pasta fonte "${CAMINHO_PASTA_FONTE}" não foi encontrada. Verifique o caminho.`;
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
    const comentarioPasta = splitComentario(pastaFonte.getName());

    // 1. PRIMEIRA PASSAGEM: Coleta metadados, calcula o conteúdo e a necessidade de conversão
    while (arquivosDoc.hasNext()) {
        const arquivoDoc = arquivosDoc.next();

        const nomeDocOriginal = arquivoDoc.getName();
        if (nomeDocOriginal === 'Config' || nomeDocOriginal === 'index') continue;

        const nomeSlug = slugifyFileName(nomeDocOriginal);
        const nomeMarkdown = `${nomeSlug}.md`;
        
        totalFiles++;

        // 1.1. EXTRAÇÃO DE CONTEÚDO E SCORE SEMÂNTICO
        const {
            markdownContent, 
            semanticOrderScore,
            tempoLeitura,
            nomeSemData
        } = getMarkdownAndScoreFromDoc(arquivoDoc, nomeDocOriginal, nomeSlug, pastaDestino);

        // 1.2. Tenta encontrar o arquivo .md de destino e verifica a data
        const arquivosMdDestino = pastaDestino.getFilesByName(nomeMarkdown);
        let deveConverter = converterTodos; // Assume converterTodos (global) como padrão
        let arquivoMdDestino = null;

        if (arquivosMdDestino.hasNext()) {
            arquivoMdDestino = arquivosMdDestino.next();
            const dataDocFonte = arquivoDoc.getLastUpdated().getTime();
            const dataMdDestino = arquivoMdDestino.getLastUpdated().getTime();
            
            if (dataMdDestino < dataDocFonte) {
                Logger.log(`[ATUALIZANDO] Doc "${nomeDocOriginal}". Doc fonte é mais recente.`);
                deveConverter = true;
            } else if (deveConverter) {
                Logger.log(`[ATUALIZANDO] Doc "${nomeDocOriginal}". converterTodos=true.`);
            } else {
                // Logger.log(`[IGNORANDO] Doc "${nomeDocOriginal}". Nenhuma alteração detectada.`);
            }
        } else {
            Logger.log(`[NOVO] Doc "${nomeDocOriginal}". Arquivo MD de destino não encontrado.`);
            deveConverter = true;
        }

        // 1.3. Armazena os dados
        arquivosParaProcessar.push({
            original: nomeDocOriginal,
            slug: nomeSlug,
            markdownName: nomeMarkdown,
            content: markdownContent,
            score: semanticOrderScore,
            time: tempoLeitura,
            deveConverter: deveConverter,
            arquivoMdDestino: arquivoMdDestino,
            nomeSemData: nomeSemData,
            docFile: arquivoDoc 
        });

        // 1.4. Adiciona metadados para indexação (lista paralela)
        arquivosIndexados.push({
            original: nomeDocOriginal,
            slug: nomeSlug,
            link: `./${nomeSlug}.html`,
            time: tempoLeitura,
            semanticOrder: semanticOrderScore
        });
    }

    // 2. ORDENAÇÃO
    const aforismosSlug = 'aforismos';

    // Função de ordenação base
    const sortDocs = (a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.semanticOrder !== b.semanticOrder) return a.semanticOrder - b.semanticOrder;
      return a.original.localeCompare(b.original);
    };

    // Ordena listas
    arquivosParaProcessar.sort(sortDocs);
    arquivosIndexados.sort(sortDocs);
    
    // Lógica de 'aforismos' no topo (mantida)
    for (const lista of [arquivosParaProcessar, arquivosIndexados]) {
        const index = lista.findIndex(doc => doc.slug === aforismosSlug);
        if (index > 0) {
            const doc = lista[index];
            lista.splice(index, 1);
            lista.unshift(doc);
        }
    }


    // 3. SEGUNDA PASSAGEM (Inicial): SALVA E ADICIONA LINKS DE NAVEGAÇÃO
    function executarPassagemDeConversao(force = false) {
      let filesUpdated = 0;
      for (let i = 0; i < arquivosParaProcessar.length; i++) {
          const docInfo = arquivosParaProcessar[i];

          if (docInfo.deveConverter || force) {
              
              // Determina Anterior e Próximo com a lista JÁ ORDENADA
              const anterior = i > 0 ? arquivosParaProcessar[i - 1] : null;
              const proximo = i < arquivosParaProcessar.length - 1 ? arquivosParaProcessar[i + 1] : null;

              // Salva/Atualiza o arquivo com o novo conteúdo e navegação
              salvarArquivoMarkdownComNavegacao(docInfo, anterior, proximo, pastaDestino);
              filesUpdated++;
          }
      }
      return filesUpdated;
    }
    
    // Executa a conversão baseada em data/converterTodos (Passo 3)
    filesConverted += executarPassagemDeConversao(false);


    // 4. PROCESSA SUBPASTAS RECURSIVAMENTE E COLETA METADADOS
    const subpastasIndexadas = [];
    const subpastasFonte = pastaFonte.getFolders();
    
    while (subpastasFonte.hasNext()) {
        const subpastaFonte = subpastasFonte.next();
        let nomeSubpastaCompleto = subpastaFonte.getName();
        if (nomeSubpastaCompleto.startsWith("_")) continue;

        const nomeComentarioSubpasta = splitComentario(nomeSubpastaCompleto.replace(/_/g, ' '));
        const nomeSubpasta = nomeComentarioSubpasta[0];
        const comentario = nomeComentarioSubpasta.length > 1 ? nomeComentarioSubpasta[1] : "";

        // Tenta encontrar a pasta de destino
        let subpastasDestinoIterator = pastaDestino.getFoldersByName(nomeSubpasta);
        let subpastaDestino;

        if (subpastasDestinoIterator.hasNext()) {
            subpastaDestino = subpastasDestinoIterator.next();
        } else {
            subpastaDestino = pastaDestino.createFolder(nomeSubpasta);
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
        subpastasIndexadas.push({
          name: nomeSubpasta,
          comentario: comentario,
          link: `./${nomeSubpasta}/${NOME_INDEX}`,
          semanticOrder: semanticOrderScore
        });
    }

    subpastasIndexadas.sort((a, b) => a.semanticOrder - b.semanticOrder);

    // 5. CRIA/ATUALIZA O INDEX.MD
    const comentarioPastaTexto = comentarioPasta.length > 1 ? comentarioPasta[1] : "";
    const indexAlterado = criarIndexMarkdown(pastaDestino, arquivosIndexados, subpastasIndexadas, comentarioPastaTexto);
    
    // 6. VERIFICA O REQUISITO DE RECONVERSÃO
    if (indexAlterado && arquivosParaProcessar.length > 0) {
        Logger.log(`[FORÇANDO RECONVERSÃO] Index.md em ${pastaDestino.getName()} foi alterado. Reconvertendo arquivos desta pasta para atualizar a navegação.`);
        // Força a segunda passagem de conversão para todos os arquivos da pasta (Passo 3 repetido)
        filesConverted += executarPassagemDeConversao(true);
    }

    return filesConverted;
}

/**
 * Salva/Atualiza o arquivo .md com o rodapé de navegação Anterior/Próximo.
 */
function salvarArquivoMarkdownComNavegacao(docInfo, anterior, proximo, pastaDestino) {
    
    // Gera o rodapé de navegação
    const navegacaoRodape = gerarNavegacaoRodape(anterior, proximo);

    // Conteúdo final
    const finalContent = docInfo.content + navegacaoRodape;

    // Salva/Atualiza o arquivo com o novo conteúdo
    if (docInfo.arquivoMdDestino) {
        docInfo.arquivoMdDestino.setContent(finalContent);
    } else {
        pastaDestino.createFile(docInfo.markdownName, finalContent, MIME_MARKDOWN);
    }
}


/**
 * Gera o rodapé de navegação (Anterior/Próximo)
 */
function gerarNavegacaoRodape(anterior, proximo) {
    let rodape = '\n\n---\n\n'; // Separador visual
    let navLinks = [];
    let navLinksHtml = [];

    if (anterior) {
        // Usa o nome sem data/formatação do index
        const nomeAnterior = anterior.nomeSemData; 
        navLinks.push(`[${nomeAnterior}](./${anterior.slug}.html)`);
        navLinksHtml.push(`<a href="./${anterior.slug}.html">${nomeAnterior}</a>`);
    }

    if (proximo) {
        const nomeProximo = proximo.nomeSemData;
        navLinks.push(`[${nomeProximo}](./${proximo.slug}.html)`);
        navLinksHtml.push(`<a href="./${proximo.slug}.html">${nomeProximo}</a>`);
    }

    if (navLinks.length > 0) {
        // Coloca os links lado a lado se houver os dois, ou apenas um.
        if (anterior && proximo) {
            rodape += `<div style="display: flex; justify-content: space-between;">\n`;
            rodape += `  ${navLinksHtml[0]}\n`;
            rodape += `  ${navLinksHtml[1]}\n`;
            rodape += `</div>\n`;
        } else {
            rodape += navLinks.join('\n') + '\n';
        }
    }

    return rodape;
}


/**
 * Converte o conteúdo de um Google Doc para uma string Markdown simples,
 * **SEM adicionar o rodapé de navegação Anterior/Próximo/Voltar Index.**
 * @returns {{markdownContent: string, semanticOrderScore: number, tempoLeitura: number, nomeSemData: string}}
 */
function getMarkdownAndScoreFromDoc(docFile, originalFileName, fileSlug, pastaDestino) {
    let markdown = '';
    let tags = [];
    let semanticOrderScore = 0.0;
    let tempoLeitura = 1;
    let nomeSemData = originalFileName; // Inicializa com o nome original

    try {
        const doc = DocumentApp.openById(docFile.getId());
        const body = doc.getBody();
        
        // CÁLCULO DE TEMPO DE LEITURA (INTEGRADO)
        const fullText = body.getText().trim();
        const words = fullText.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const rawTime = wordCount / 200.0;
        //const roundedTime = Math.round(rawTime * 2) / 2;
        //tempoLeitura = Math.max(0.5, roundedTime);
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
                    continue;
                }
            }
            
            contentElementsInReverse.push(element);
            
            if ((tagsFound || scoreFound) && element.getType() !== DocumentApp.ElementType.PARAGRAPH) {
                 break; 
            }
        }
        
        // Remove a data do nome para o título (ex: "2023-10-27-Titulo" vira "Titulo")
        const regex = /^\d{4}-\d{2}-\d{2}-/;
        nomeSemData = originalFileName.replace(regex, '');
        let isPost = nomeSemData !== originalFileName;
        
        // --- 2. MONTAGEM DO YAML FRONT MATTER ---
        // (Sem mudanças, exceto pela extração do nomeSemData)
        markdown += `---\n`;
        markdown += `layout: default\n`;
        markdown += `title: "${nomeSemData}"\n`;

        if (tags.length > 0) {
            markdown += `tags:\n`;
            tags.forEach(tag => {
                markdown += `  - ${tag}\n`;
            });
        }
        markdown += `--- \n\n`;

        // --- 3. CONVERSÃO DO CORPO (LIMPO) PARA MARKDOWN ---

        if (fileSlug !== 'index') {
            const pastaNome = pastaDestino.getName().replace(/_/g, ' ');
            if (!isPost && pastaNome !== ROOT_DESTINATION_FOLDER) markdown += `\n\n[${pastaNome}](./)\n\n`;
            markdown += `## ${nomeSemData}\n\n`;
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
                            if (char===' ' && inBoldItalicRun) { 
                              rawText +="*** "; 
                              inBoldItalicRun = false,  inBoldRun = false; inItalicRun = false;
                              continue;
                            }

                            if (isBold && !inBoldRun & char!==' ') { rawText += '**'; inBoldRun = true; } 
                            else if (!isBold && inBoldRun) { rawText += '**'; inBoldRun = false; }
                            
                            if (isItalic && !inItalicRun & char!==' ') { rawText += '*'; inItalicRun = true; } 
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

                let text = rawText.replace(/(\r\n|\r|\n)/g, '  \n');
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
            }
        }
        // O link de retorno ao index da pasta será adicionado na função que gera o rodapé.

        return {
            markdownContent: markdown.trim(),
            semanticOrderScore: semanticOrderScore,
            tempoLeitura: tempoLeitura,
            nomeSemData: nomeSemData // Retorna o nome sem data para uso na navegação
        };

    } catch (e) {
        Logger.log(`[ERRO CRÍTICO] Falha ao processar o Google Doc ${docFile.getName()}: ${e.toString()}`);
        return {
            markdownContent: `\n\n[ERRO NA CONVERSÃO]: ${e.toString()}\n\n`,
            semanticOrderScore: 0.0,
            tempoLeitura: tempoLeitura,
            nomeSemData: originalFileName // Retorna o nome original em caso de erro
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
 * Gera e salva/atualiza o arquivo index.md na pasta de destino.
 * @returns {boolean} True se o index.md foi criado ou teve seu conteúdo alterado.
 */
function criarIndexMarkdown(pastaDestino, arquivos, subpastas, comentario) {

    // Não gera index na pasta se não houver conteúdo nela
    if (arquivos.length === 0 && subpastas.length === 0) { 
      return false;
    }
    const isRootFolder = pastaDestino.getId() === ROOT_DESTINATION_FOLDER_ID;

    let indexContent = "";
    if (isRootFolder) {
      indexContent = "---\nlayout: default\ntitle: Índice\n--- \n\n";
    } else {
      indexContent = '## ' + pastaDestino.getName().replace(/_/g, ' ')  + '\n\n';
      if (comentario!=="") indexContent += "#### " + comentario + "\n\n";
    }
    
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
    const arquivosIndex = pastaDestino.getFilesByName(NOME_INDEX);

    if (arquivosIndex.hasNext()) {
        const indexFile = arquivosIndex.next();

        const existingContent = indexFile.getBlob().getDataAsString();

        if (existingContent.trim() === finalContent.trim()) {
            return false; // Não foi alterado
        }

        indexFile.setContent(finalContent);
        Logger.log(`Index.md ATUALIZADO em: ${pastaDestino.getName()} (Conteúdo alterado).`);
        return true; // Foi atualizado
    } else {
        // ARQUIVO NÃO EXISTE: Cria
        pastaDestino.createFile(NOME_INDEX, finalContent, MIME_MARKDOWN);
        Logger.log(`Index.md CRIADO em: ${pastaDestino.getName()}.`);
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
    while (arquivosDocFonte.hasNext()) {
        const doc = arquivosDocFonte.next();
        slugsFonteValidos.add(slugifyFileName(doc.getName())+".md");
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
            }
        }
    }
    // 3. Processa as subpastas recursivamente
    const subpastasFonte = pastaFonte.getFolders();
    while (subpastasFonte.hasNext()) {
        const subpastaFonte = subpastasFonte.next();
        const nomeSubpasta = splitComentario(subpastaFonte.getName().replace(/_/g, ' '))[0];
        const subpastasDestinoIterator = pastaDestino.getFoldersByName(nomeSubpasta);

        if (subpastasDestinoIterator.hasNext()) {
            limparArquivosExcluidos(subpastasDestinoIterator.next(), subpastaFonte);
        }
    }
}