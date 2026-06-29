/**
 * Compila documentos em subpastas da pasta 'Pessoal/Meus.Textos/[nomePastaRaiz]',
 * criando DOIS livros individuais para cada subpasta, usando um arquivo 'Config'
 * para Epígrafe e Ordenação do Livro.
 */
function gerarLivroComDocumentos(nomePastaRaiz = 'Wingene') {
    
    let idPastaRaiz = null;

    try { 
        Logger.log('Procurando a pasta raiz: Pessoal/Meus.Textos/'+ nomePastaRaiz);
        
        // --- 1. Localizar a pasta raiz ---
        const folders = DriveApp.getFoldersByName('Pessoal');
        while (folders.hasNext()) {
            const pastaPessoal = folders.next();
            const pastasTextosIter = pastaPessoal.getFoldersByName('Meus.Textos');
            while (pastasTextosIter.hasNext()) {
                const pastaMeusTextos = pastasTextosIter.next();
                const pastasFinalizados = pastaMeusTextos.getFoldersByName(nomePastaRaiz);
                if (pastasFinalizados.hasNext()) {
                    idPastaRaiz = pastasFinalizados.next().getId();
                    break;
                }
            }
            if (idPastaRaiz) break;
        }

        if (!idPastaRaiz) {
            Logger.log('Pasta raiz "Pessoal/Meus.Textos/' + nomePastaRaiz + '" não encontrada.');
            return;
        }

        const pastaFinalizados = DriveApp.getFolderById(idPastaRaiz);
        const subpastas = pastaFinalizados.getFolders();
        
        const compilados = pastaFinalizados.getFoldersByName("_compilados");
        let pastaCompilados = null;
        if (compilados.hasNext()) {
          pastaCompilados = compilados.next();
        } else {
          Logger.log('Pasta raiz "Pessoal/Meus.Textos/' + nomePastaRaiz + '/_compilados" não encontrada.');
          return;
        }
        while (subpastas.hasNext()) {
            const subpasta = subpastas.next();
            if (subpasta.getName().startsWith("_")) continue;
            compilarDoisLivrosDaPasta(pastaCompilados, subpasta);
            
            const subSubPastas = subpasta.getFolders();
            while (subSubPastas.hasNext()) {
                const subSubPasta = subSubPastas.next();
                if (subSubPasta.getName().startsWith("_")) continue;
                compilarDoisLivrosDaPasta(pastaCompilados, subSubPasta);
            }
        }
        
        compilarMicroblog(pastaFinalizados, pastaCompilados);
        
        Logger.log('Compilação de todos os livros concluída com sucesso.');

    } catch (e) { 
        Logger.log('Erro fatal no script: ' + e.toString());
    }
}

/**
 * Define a lógica de comparação para ordenação interna: Raiz antes de Subpastas, depois NNN.
 * @param {string} nomePastaRaiz Nome da pasta raiz do livro atual (Capítulo Principal).
 * @returns {function} Função de comparação para Array.sort.
 */
function compararDocs() {
    return (a, b) => {
        if (a.ordenacaoCapitulo !== b.ordenacaoCapitulo) {
            return a.ordenacaoCapitulo - b.ordenacaoCapitulo;
        }
        // 2. Prioridade Secundária: Ordenação NNN do GDoc.
        if (a.ordenacao !== b.ordenacao) {
            return a.ordenacao - b.ordenacao;
        }
        return 0;
    };
}


/**
 * Compila todos os documentos de uma subpasta, gerando duas versões do livro (Puro e Formatado).
 * * @param {object} livroMeta Metadados do livro, incluindo pasta, nome e epígrafe/ordenação.
 * @param {GoogleAppsScript.Drive.Folder} pastaDestino A pasta onde o livro deve ser salvo (Finalizados).
 */
function compilarDoisLivrosDaPasta(pastaFinalizados, pastaDestino) {
    const livroDestino = pastaDestino.getName();
    const NOME_PASTA = livroDestino;
    const SUFIXO_PURO = ' (Puro)';
    const SUFIXO_FORMATADO = '';

    const NOME_LIVRO_PURO = NOME_PASTA + SUFIXO_PURO;
    const NOME_LIVRO_FORMATADO = NOME_PASTA + SUFIXO_FORMATADO;

    Logger.log('--- Iniciando coleta e compilação para o livro: ' + NOME_PASTA + ' ---');

    // 1. Coletar documentos EXCLUSIVAMENTE para este livro/pasta.
    const listaDocs = [];
    const extraContent = { prefacio: null, posfacio: null };
    
    // Passa o NOME_PASTA como o nome da raiz do livro
    const tipoSaidaLivro = coletarConteudoDePasta(pastaDestino, NOME_PASTA, true, listaDocs, extraContent); 
    
    if (!verificarNecessidadeCompilacao(pastaFinalizados, NOME_LIVRO_FORMATADO, listaDocs)) {
      return;
    }
    
    Logger.log('Carregando conteúdo e metadados dos documentos...');
    carregarConteudoDocs(listaDocs);

    // 2. Ordenar os documentos internos (USANDO SOMENTE METADADOS)
    listaDocs.sort(compararDocs());
    
    
    // 3. Gerar Livro Puro
    // gerarLivro(NOME_LIVRO_PURO, pastaFinalizados, listaDocs, 'PURO', tipoSaidaLivro, extraContent);

    // 4. Gerar Livro Formatado
    gerarLivro(NOME_LIVRO_FORMATADO, pastaFinalizados, listaDocs, 'FORMATADO', tipoSaidaLivro, extraContent);

    Logger.log('Compilação para "' + NOME_PASTA + '" concluída.');
}

function verificarNecessidadeCompilacao(pastaDestino, nomeLivroComSubtitulo, listaDocs) {
    let titulos = splitComentario(nomeLivroComSubtitulo);
    let nomeLivro = titulos[0];
    const arquivosExistentes = pastaDestino.getFilesByName(nomeLivro);

    if (!arquivosExistentes.hasNext()) {
        Logger.log(`[${nomeLivro}] Livro não existe. É NECESSÁRIO compilar.`);
        return true; // Livro não existe, precisa ser compilado.
    }

    const arquivoLivro = arquivosExistentes.next();
    const dataModificacaoLivro = arquivoLivro.getLastUpdated();
    
    // Convertendo para timestamp para comparação mais fácil
    const timestampLivro = dataModificacaoLivro.getTime();

    for (const docMeta of listaDocs) {
        try {
            const arquivoDoc = DriveApp.getFileById(docMeta.id);
            const dataModificacaoDoc = arquivoDoc.getLastUpdated();
            
            // Se o documento fonte for mais recente, recompilação é necessária.
            if (dataModificacaoDoc.getTime() > timestampLivro) {
                Logger.log(`[${nomeLivro}] O documento "${docMeta.nomeArquivo}" é mais novo (${dataModificacaoDoc}) que o livro (${dataModificacaoLivro}). É NECESSÁRIO compilar.`);
                return true;
            }
        } catch (e) {
            // Se não conseguir acessar um arquivo, assume que precisa compilar por segurança
            Logger.log(`AVISO: Não foi possível verificar o arquivo ${docMeta.nomeArquivo}. Assumindo NECESSIDADE de compilação.`);
            return true;
        }
    }

    Logger.log(`[${nomeLivro}] Nenhuma alteração nos documentos de origem. Compilação NÃO é necessária.`);
    return false; // Nenhum documento é mais recente que o livro.
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
 * Cria ou atualiza um único livro (Puro ou Formatado).
 */
function gerarLivro(nomeLivroComSubtitulo, pastaDestino, listaDocs, tipo, tipoSaidaLivro, extraContent) {
    let arquivoLivro = null;
    let livro = null;
    let titulos = splitComentario(nomeLivroComSubtitulo);
    let nomeLivro = titulos[0];
    try {
        const arquivosExistentes = pastaDestino.getFilesByName(nomeLivro);
        
        if (arquivosExistentes.hasNext()) {
            arquivoLivro = arquivosExistentes.next();
            livro = DocumentApp.openById(arquivoLivro.getId());
        } else {
            livro = DocumentApp.create(nomeLivro);
            arquivoLivro = DriveApp.getFileById(livro.getId());
            
            DriveApp.getRootFolder().removeFile(arquivoLivro); 
            pastaDestino.addFile(arquivoLivro);    
        }

        let corpoLivro = livro.getBody();
        corpoLivro.clear();
        livro.saveAndClose();
        livro = DocumentApp.openById(arquivoLivro.getId());
        corpoLivro = livro.getBody();
        // 2. Inserir Capa Padrão
        corpoLivro.appendParagraph(titulos[0]).setHeading(DocumentApp.ParagraphHeading.TITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        if (titulos.length>1) corpoLivro.appendParagraph(titulos[1]).setHeading(DocumentApp.ParagraphHeading.SUBTITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        corpoLivro.appendParagraph("© José Eugênio").setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        if (tipoSaidaLivro) corpoLivro.appendPageBreak();

        if (extraContent && extraContent.prefacio) {
             corpoLivro.appendParagraph('Prefácio')
                .setHeading(DocumentApp.ParagraphHeading.HEADING1)
                .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
             corpoLivro.appendParagraph(extraContent.prefacio)
                .setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
             if (tipoSaidaLivro) corpoLivro.appendPageBreak();
        }
        
        // 3. Inserir conteúdo dos documentos
        let isFirstContentAfterCover = true;
        let lastChapterName = null; 
        
        let epigrafeInserted = false;
        let docsProcessedCount = 0;

        listaDocs.forEach(docMeta => {
            if (docMeta.ignoreContent) return;

            let newChapterCoverInserted = false; 
            let isRootLevel = docMeta.isRootFolder;

            // --- A. Lógica do Novo Capítulo (Capas de Subpastas) ---
            if (!isRootLevel && docMeta.pastaPaiNomeAtual !== lastChapterName) {
                
                if (!isFirstContentAfterCover && tipoSaidaLivro) {
                    corpoLivro.appendPageBreak();
                }

                // Insere Capa do Capítulo Centralizada
                // corpoLivro.appendParagraph(tipoSaidaLivro?'CAPÍTULO:':)
                //     .setHeading(DocumentApp.ParagraphHeading.HEADING3) 
                //     .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                    
                corpoLivro.appendParagraph(docMeta.pastaPaiNomeAtual)
                    .setHeading(tipoSaidaLivro?DocumentApp.ParagraphHeading.TITLE:DocumentApp.ParagraphHeading.HEADING2) 
                    .setAlignment(DocumentApp.HorizontalAlignment.CENTER) 
                    .setBold(true)
                    .setSpacingAfter(40);
                
                if (tipoSaidaLivro) corpoLivro.appendPageBreak();
                
                lastChapterName = docMeta.pastaPaiNomeAtual;
                newChapterCoverInserted = true;
                epigrafeInserted = false;
                
            } else if (isRootLevel) {

                lastChapterName = null; // Reseta o rastreador
            }

            // 4. Inserir Epígrafe (se houver) - em página separada
            if (!epigrafeInserted && docMeta.epigrafe && docMeta.epigrafe.length > 0) {
                epigrafeInserted = true;

                corpoLivro.appendParagraph(''); 
                
                const epigrafeParagrafo = corpoLivro.appendParagraph(docMeta.epigrafe)
                    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
                    .setBold(false)
                    .setItalic(true);
                    
                try {
                    const textElement = epigrafeParagrafo.editAsText();
                    textElement.setFontFamily('Arial');
                    textElement.setFontSize(10);
                } catch (e) { /* Ignora falha de formatação */ }
                
                if (tipoSaidaLivro) corpoLivro.appendPageBreak(); 
            }

            // --- B. Quebra de Página entre Documentos ---
            if (!isFirstContentAfterCover && !newChapterCoverInserted) {
                if (tipoSaidaLivro) corpoLivro.appendPageBreak();
            }
            isFirstContentAfterCover = false;
            
            // --- C. Inserir Conteúdo ---
            
            if (tipo === 'PURO') {
                corpoLivro.appendParagraph('--- ' + docMeta.nomeArquivo + ' ---')
                    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
                    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
                    .setBold(true);
                
                corpoLivro.setBold(false);
                corpoLivro.appendParagraph(docMeta.textoLimpo); 

            } else if (tipo === 'FORMATADO') {
                 corpoLivro.appendParagraph(docMeta.nomeArquivo)
                    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
                    .setAlignment(DocumentApp.HorizontalAlignment.LEFT);
                
                try {
                    processarDocumentoFormatado(docMeta.id, corpoLivro);
                    
                    docsProcessedCount++;
                    if (docsProcessedCount % 20 === 0) {
                        livro.saveAndClose();
                        livro = DocumentApp.openById(arquivoLivro.getId());
                        corpoLivro = livro.getBody();
                    }
                } catch (e) {
                     const erroMsg = 'ERRO: Falha na cópia de conteúdo formatado do documento "' + docMeta.nomeArquivo + '". Detalhes: ' + e.toString();
                     Logger.log(erroMsg);
                     if (e.stack) Logger.log('Stack: ' + e.stack);
                }
            }
        });

        if (extraContent && extraContent.posfacio) {
             if (tipoSaidaLivro) corpoLivro.appendPageBreak();
             corpoLivro.appendParagraph('Posfácio')
                .setHeading(DocumentApp.ParagraphHeading.HEADING1)
                .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
             corpoLivro.appendParagraph(extraContent.posfacio)
                .setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
        }

        livro.saveAndClose();
                    
    } catch (e) {
        Logger.log('Erro ao processar o livro "' + nomeLivro + '": ' + e.toString());
    }
}

/**
 * @param {string} docId ID do documento a ser copiado.
 * @param {GoogleAppsScript.Document.Body} corpoDestino O corpo do documento do livro.
 */
function processarDocumentoFormatado(docId, corpoDestino) {
    const docOrigem = DocumentApp.openById(docId);
    const bodyOrigem = docOrigem.getBody();
    const elementos = bodyOrigem.getNumChildren();

    for (let i = 0; i < elementos; i++) {
        const elementoOrigem = bodyOrigem.getChild(i);
        const tipo = elementoOrigem.getType();

        if (tipo === DocumentApp.ElementType.PARAGRAPH || tipo === DocumentApp.ElementType.LIST_ITEM) {
            
            const paragrafoOrigem = (tipo === DocumentApp.ElementType.PARAGRAPH) ? elementoOrigem.asParagraph() : elementoOrigem.asListItem();
            const textoCompleto = paragrafoOrigem.getText();
            
            const heading = paragrafoOrigem.getHeading();

            // 1. Remoção de Metadados (Condicional)
            if (heading === DocumentApp.ParagraphHeading.NORMAL || heading === DocumentApp.ParagraphHeading.UNSUPPORTED) {
                if (textoCompleto.trim().match(/^Ordenação:\s*(\d+)/i) || textoCompleto.trim().match(/^Tags:/i)) {
                    continue; 
                }
            }

            if (textoCompleto.trim() === '***') {
                corpoDestino.appendHorizontalRule();
                continue;
            }

            // 2. Cópia Otimizada (Element Copy)
            // Usa copy() para evitar iterar caractere por caractere, o que é muito lento.
            const copia = elementoOrigem.copy();
            let novoElemento;
            
            if (tipo === DocumentApp.ElementType.PARAGRAPH) {
                novoElemento = corpoDestino.appendParagraph(copia);
            } else {
                novoElemento = corpoDestino.appendListItem(copia);
            }

            // 3. Padronização de Headers e Cópia de Estilos de Parágrafo
            // Nota: copy() já traz os estilos, só precisamos ajustar o Heading se necessário.
            if (heading !== DocumentApp.ParagraphHeading.NORMAL && heading !== DocumentApp.ParagraphHeading.UNSUPPORTED) {
                // Padroniza o Header
                novoElemento.setHeading(DocumentApp.ParagraphHeading.HEADING2);
            }

            // 4. Processar Links (Markdown) DEPOIS da formatação
            const regexLink = /\[([^\]]+)\]\(([^)]+)\)/g;
            const matches = [];
            let match;
            while ((match = regexLink.exec(textoCompleto)) !== null) {
                let url = match[2];
                if (!url.startsWith('http')) {
                    url = 'https://blog.wingene.com.br' + url;
                }
                matches.push({
                    index: match.index,
                    fullMatch: match[0],
                    text: match[1],
                    url: url
                });
            }
            
            if (matches.length > 0) {
                const textObj = novoElemento.editAsText();
                // Iterate backwards to preserve indices
                for (let i = matches.length - 1; i >= 0; i--) {
                    const m = matches[i];
                    const start = m.index;
                    const end = m.index + m.fullMatch.length - 1;
                    const textLen = m.text.length;
                    
                    try {
                        // Delete `)[url]` part first
                        textObj.deleteText(start + 1 + textLen, end);
                        // Delete `(`
                        textObj.deleteText(start, start);
                        // Apply link to TEXT
                        textObj.setLinkUrl(start, start + textLen - 1, m.url);
                    } catch (e) { /* Ignora */ }
                }
            }

            // 5. Remover Comentários HTML (<!-- -->)
            const textObj = novoElemento.editAsText();
            const textStr = textObj.getText();
            const regexComment = /<!--[\s\S]*?-->/g;
            const commentMatches = [];
            let cMatch;
            while ((cMatch = regexComment.exec(textStr)) !== null) {
                commentMatches.push({
                    start: cMatch.index,
                    end: cMatch.index + cMatch[0].length - 1
                });
            }
            
            for (let i = commentMatches.length - 1; i >= 0; i--) {
                const m = commentMatches[i];
                try {
                    textObj.deleteText(m.start, m.end);
                } catch (e) { /* Ignora */ }
            }
        }       
        // 6. Processar Tabelas (Cópia direta de elemento)
        else if (tipo === DocumentApp.ElementType.TABLE) {
            try {
                const tabelaCopiada = elementoOrigem.copy();
                corpoDestino.appendTable(tabelaCopiada.asTable());
            } catch (e) { /* Ignora */ }
        }
    }
}
/**
 * Função auxiliar para manter a formatação durante a cópia. (Sem alteração)
 */
function processarDocumentoFormatadoOld(docId, corpoDestino) {
    const docOrigem = DocumentApp.openById(docId);
    const bodyOrigem = docOrigem.getBody();
    const elementos = bodyOrigem.getNumChildren();

    for (let i = 0; i < elementos; i++) {
        const elementoOrigem = bodyOrigem.getChild(i);
        const tipo = elementoOrigem.getType();

        if (tipo === DocumentApp.ElementType.PARAGRAPH || tipo === DocumentApp.ElementType.LIST_ITEM) {
            
            const paragrafoOrigem = elementoOrigem.asParagraph() || elementoOrigem.asListItem();
            if (!paragrafoOrigem) continue; 
            
            const heading = paragrafoOrigem.getHeading();
            const textoCompleto = paragrafoOrigem.getText();

            if (textoCompleto.trim().length === 0) continue; 

            if (heading === DocumentApp.ParagraphHeading.NORMAL || heading === DocumentApp.ParagraphHeading.UNSUPPORTED) {
                if (textoCompleto.trim().match(/^Ordenação:\s*(\d+)/i) || textoCompleto.trim().match(/^Tags:/i)) {
                    continue; 
                }
            }

            let novoParagrafo;
            if (tipo === DocumentApp.ElementType.LIST_ITEM) {
                novoParagrafo = corpoDestino.appendListItem(textoCompleto);
                try {
                    novoParagrafo.setNestingLevel(elementoOrigem.asListItem().getNestingLevel());
                } catch (e) { /* Ignora */ }
            } else {
                novoParagrafo = corpoDestino.appendParagraph(textoCompleto);
            }

            if (heading !== DocumentApp.ParagraphHeading.NORMAL && heading !== DocumentApp.ParagraphHeading.UNSUPPORTED) {
                novoParagrafo.setHeading(DocumentApp.ParagraphHeading.HEADING2);
            } else {
                try {
                    novoParagrafo.setAttributes(paragrafoOrigem.getAttributes());
                } catch (e) { /* Ignora */ }
            }

            try {
                const allTextAttributes = paragrafoOrigem.getAttributes(); 
                novoParagrafo.setAttributes(allTextAttributes);
            } catch (e) {
                Logger.log('Aviso: Falha ao copiar formatação de texto para o parágrafo: ' + e.toString());
            }
        }
        
        else if (tipo === DocumentApp.ElementType.TABLE) {
            try {
                const tabelaCopiada = elementoOrigem.copy();
                corpoDestino.appendTable(tabelaCopiada.asTable());
            } catch (e) { /* Ignora */ }
        }
    }
}

/**
 * Carrega o conteúdo e metadados (Ordenação) dos documentos apenas se necessário.
 */
function carregarConteudoDocs(listaDocs) {
    const ORDENACAO_PADRAO_DOCUMENTO = 99999;
    const props = PropertiesService.getScriptProperties();
    
    listaDocs.forEach(doc => {
        if (doc.ignoreContent) return;
        if (doc.textoLimpo !== null) return; // Já carregado

        // Tenta usar Cache para Ordenação para evitar abrir o documento
        const cacheKey = 'doc_ord_' + doc.id;
        const cachedData = props.getProperty(cacheKey);
        if (cachedData) {
            try {
                const cachedObj = JSON.parse(cachedData);
                if (cachedObj.ts === doc.timestamp) {
                    doc.ordenacao = cachedObj.ord;
                    return; // Pula a abertura do documento (textoLimpo fica null, ok para FORMATADO)
                }
            } catch(e) {}
        }

        try {
            const docConteudo = DocumentApp.openById(doc.id);
            const textoCompleto = docConteudo.getBody().getText();
            
            let ordenacao = ORDENACAO_PADRAO_DOCUMENTO;
            
            const linhas = textoCompleto.split('\n');
            const regexOrdenacao = /^Ordenação:\s*(\d+(?:[.,]\d+)?)/i; 
            
            const limite = Math.max(0, linhas.length - 5); 
            for (let i = linhas.length - 1; i >= limite; i--) {
                const linha = linhas[i].trim();
                const matchOrdenacao = linha.match(regexOrdenacao);
                if (matchOrdenacao) {
                    ordenacao = parseFloat(matchOrdenacao[1]);
                    break; 
                }
            }
            
            let textoLimpo = linhas.filter(l => !l.trim().match(/^(Ordenação|Tags):/i)).join('\n').trim();
            textoLimpo = textoLimpo.replace(/<!--[\s\S]*?-->/g, '');

            doc.ordenacao = ordenacao;
            doc.textoLimpo = textoLimpo;
            
            // Salva no Cache
            props.setProperty(cacheKey, JSON.stringify({
                ts: doc.timestamp,
                ord: ordenacao
            }));

        } catch (e) {
            Logger.log('ERRO ao ler documento "' + doc.nomeArquivo + '": ' + e.toString());
            doc.textoLimpo = 'ERRO: ' + e.toString();
        }
    });
}

/**
 * Função recursiva para coletar documentos, extrair metadados (Ordenação:, Tags:), 
 * e limpar o texto.
 * * @param {GoogleAppsScript.Drive.Folder} pasta A pasta atual a ser processada.
 * @param {string} nomePastaRaiz Nome da pasta raiz do livro atual.
 * @param {string} pastaPaiNomeAtual Nome da pasta atual (para rastrear o nome do capítulo Nível 2).
 * @param {boolean} isRootFolder Se esta pasta é a raiz do livro.
 * @param {Array<Object>} listaDocs A lista que armazena os metadados.
 * @param {object} livroMeta Metadados do livro, incluindo ordenacaoCapitulo.
 */
function coletarConteudoDePasta(pasta, pastaPaiNomeAtual, isRootFolder, listaDocs, extraContent) {
    const arquivos = pasta.getFiles();
    const NOME_ARQUIVO_CONFIG = 'Config';
    const ORDENACAO_PADRAO_DOCUMENTO = 99999; 
    let ordenacaoCapitulo = 9999;
    let epigrafeCapitulo ='';
    let tipoSaidaLivro = true;
    const configFiles = pasta.getFilesByName(NOME_ARQUIVO_CONFIG);
    if (configFiles.hasNext()) {
        try {
            const arquivoConfig = configFiles.next();
            const configDoc = DocumentApp.openById(arquivoConfig.getId());
            const configText = configDoc.getBody().getText();
            
            const matchOrdenacao = configText.match(/Ordenação:\s*(\d+(?:[.,]\d+)?)/i);
            const matchEpigrafe = configText.match(/Epígrafe:\s*(.*)/i);
            const matchTipoSaida = configText.match(/TipoSaida:\s*Artigo\s*/i);
            
            if (matchOrdenacao) {
                ordenacaoCapitulo = parseFloat(matchOrdenacao[1]);
            }
            if (matchEpigrafe) {
                epigrafeCapitulo = matchEpigrafe[1].trim().split('\n')[0].trim();
            }
            if (matchTipoSaida) {
                tipoSaidaLivro = false;
            }

            if (isRootFolder && extraContent) {
                 const matchPrefacio = configText.match(/Prefácio:\s*([\s\S]*?)(?=\s*(?:Ordenação|Epígrafe|TipoSaida|Posfácio|Tags):|$)/i);
                 if (matchPrefacio) extraContent.prefacio = matchPrefacio[1].trim();
                 
                 const matchPosfacio = configText.match(/Posfácio:\s*([\s\S]*?)(?=\s*(?:Ordenação|Epígrafe|TipoSaida|Prefácio|Tags):|$)/i);
                 if (matchPosfacio) extraContent.posfacio = matchPosfacio[1].trim();
            }

            listaDocs.push({
                id: arquivoConfig.getId(),
                nomeArquivo: NOME_ARQUIVO_CONFIG,
                pastaPaiNomeAtual: pastaPaiNomeAtual,
                epigrafe : '',
                isRootFolder: isRootFolder,
                ordenacaoCapitulo: -1,
                ordenacao: -1,
                textoLimpo: '',
                ignoreContent: true
            });
            
        } catch (e) {
            Logger.log(`AVISO: Falha ao ler Config para "${nomePasta}": ${e.toString()}`);
        }
    }
    while (arquivos.hasNext()) {
        const arquivo = arquivos.next();
        const nomeArquivo = arquivo.getName();
        const tipoMime = arquivo.getMimeType();
        
        if (nomeArquivo === NOME_ARQUIVO_CONFIG) {
            continue;      
        }

        if (tipoMime === MimeType.GOOGLE_DOCS) { 
            listaDocs.push({
                id: arquivo.getId(),
                timestamp: arquivo.getLastUpdated().getTime(),
                nomeArquivo: nomeArquivo,
                pastaPaiNomeAtual: pastaPaiNomeAtual, // O nome da pasta atual (para a capa Nível 2)
                epigrafe : epigrafeCapitulo,
                isRootFolder: isRootFolder,
                ordenacaoCapitulo: ordenacaoCapitulo,
                ordenacao: ORDENACAO_PADRAO_DOCUMENTO, // Será carregado depois se necessário
                textoLimpo: null // Será carregado depois se necessário
            });
        }
    }

    // Chamada Recursiva: Processar Subpastas
    const subpastas = pasta.getFolders();
    while (subpastas.hasNext()) {
        const subpastaFilha = subpastas.next();
        // Passa o nome da raiz, o nome da subpasta filha e isRootFolder=false
        tipoSaidaLivro=coletarConteudoDePasta(subpastaFilha, subpastaFilha.getName(), false, listaDocs, extraContent) && tipoSaidaLivro;
    }
    return tipoSaidaLivro;
}

/**
 * Compila os posts do microblog (arquivos .md da pasta _posts) em um único livro formatado no Google Docs.
 * @param {GoogleAppsScript.Drive.Folder} pastaFinalizados A pasta raiz do projeto.
 * @param {GoogleAppsScript.Drive.Folder} pastaCompilados A pasta onde o livro compilado deve ser salvo.
 */
function compilarMicroblog(pastaFinalizados, pastaCompilados) {
    const NOME_LIVRO_COMPLETO = 'Microblog: A Wingene na Prática';
    const titulos = splitComentario(NOME_LIVRO_COMPLETO);
    const nomeLivro = titulos[0];

    Logger.log('--- Iniciando coleta e compilação para o microblog: ' + NOME_LIVRO_COMPLETO + ' ---');

    // 1. Localizar a pasta _posts
    const pastasPosts = pastaFinalizados.getFoldersByName('_posts');
    if (!pastasPosts.hasNext()) {
        Logger.log('Pasta "_posts" não encontrada. Pulando compilação do microblog.');
        return;
    }
    const pastaPosts = pastasPosts.next();
    Logger.log('Pasta "_posts" localizada com ID: ' + pastaPosts.getId());

    // 2. Coletar arquivos .md da pasta _posts
    const arquivos = pastaPosts.getFiles();
    const listaPosts = [];
    let totalArquivosNaPasta = 0;
    
    while (arquivos.hasNext()) {
        totalArquivosNaPasta++;
        const arquivo = arquivos.next();
        const nomeArquivo = arquivo.getName();
        Logger.log('Arquivo encontrado na pasta _posts: "' + nomeArquivo + '" (MimeType: ' + arquivo.getMimeType() + ')');
        if (nomeArquivo.endsWith('.md')) {
            listaPosts.push({
                file: arquivo,
                nomeArquivo: nomeArquivo,
                timestamp: arquivo.getLastUpdated().getTime()
            });
        }
    }

    Logger.log('Total de arquivos na pasta _posts: ' + totalArquivosNaPasta);
    Logger.log('Total de arquivos .md identificados: ' + listaPosts.length);

    if (listaPosts.length === 0) {
        Logger.log('Nenhum arquivo markdown (.md) encontrado na pasta "_posts".');
        return;
    }

    // Ordenar os arquivos alfabeticamente pelo nome (que começa com YYYY-MM-DD)
    listaPosts.sort((a, b) => a.nomeArquivo.localeCompare(b.nomeArquivo));
    Logger.log('Arquivos ordenados para compilação: ' + listaPosts.map(p => p.nomeArquivo).join(', '));

    // 3. Verificar necessidade de compilação
    const arquivosExistentes = pastaCompilados.getFilesByName(nomeLivro);
    let precisaCompilar = true;

    if (arquivosExistentes.hasNext()) {
        const arquivoLivro = arquivosExistentes.next();
        const timestampLivro = arquivoLivro.getLastUpdated().getTime();
        
        precisaCompilar = false;
        for (const post of listaPosts) {
            if (post.timestamp > timestampLivro) {
                Logger.log(`[${nomeLivro}] O post "${post.nomeArquivo}" é mais recente que o livro. Recompilando.`);
                precisaCompilar = true;
                break;
            }
        }
    } else {
        Logger.log(`[${nomeLivro}] Livro não existe. Compilando pela primeira vez.`);
    }

    if (!precisaCompilar) {
        Logger.log(`[${nomeLivro}] Nenhuma alteração nos posts. Compilação não é necessária.`);
        return;
    }

    // 4. Criar ou abrir o documento do livro
    let livro = null;
    let arquivoLivro = null;
    const arquivosExistentes2 = pastaCompilados.getFilesByName(nomeLivro);
    
    if (arquivosExistentes2.hasNext()) {
        arquivoLivro = arquivosExistentes2.next();
        livro = DocumentApp.openById(arquivoLivro.getId());
        Logger.log('Abrindo livro existente: ' + nomeLivro + ' (ID: ' + livro.getId() + ')');
    } else {
        livro = DocumentApp.create(nomeLivro);
        arquivoLivro = DriveApp.getFileById(livro.getId());
        DriveApp.getRootFolder().removeFile(arquivoLivro);
        pastaCompilados.addFile(arquivoLivro);
        Logger.log('Criando novo livro: ' + nomeLivro + ' (ID: ' + livro.getId() + ')');
    }

    let corpoLivro = livro.getBody();
    corpoLivro.clear();
    livro.saveAndClose();
    
    // Reabrir para obter o corpo atualizado e limpo
    livro = DocumentApp.openById(arquivoLivro.getId());
    corpoLivro = livro.getBody();

    // 5. Inserir Capa Padrão
    corpoLivro.appendParagraph(titulos[0])
        .setHeading(DocumentApp.ParagraphHeading.TITLE)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    if (titulos.length > 1) {
        corpoLivro.appendParagraph(titulos[1])
            .setHeading(DocumentApp.ParagraphHeading.SUBTITLE)
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
    corpoLivro.appendParagraph("© José Eugênio")
        .setHeading(DocumentApp.ParagraphHeading.HEADING1)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    corpoLivro.appendPageBreak();

    // 6. Inserir conteúdo de cada post
    let isFirst = true;
    listaPosts.forEach(postMeta => {
        if (!isFirst) {
            corpoLivro.appendPageBreak();
        }
        isFirst = false;

        const content = postMeta.file.getBlob().getDataAsString('UTF-8');
        const post = parseMarkdownPost(content, postMeta.nomeArquivo);
        Logger.log('Processando post: "' + postMeta.nomeArquivo + '" -> Título: "' + post.title + '", Data: "' + post.dateStr + '", Pilar: "' + post.pillar + '", Tamanho do corpo: ' + post.body.length);

        // Título do post como HEADING1
        corpoLivro.appendParagraph(post.title)
            .setHeading(DocumentApp.ParagraphHeading.HEADING1)
            .setAlignment(DocumentApp.HorizontalAlignment.LEFT);

        // Metadados do post (data e pilar)
        let metaText = '';
        if (post.dateStr) {
            metaText += post.dateStr;
        }
        if (post.pillar) {
            if (metaText) metaText += ' | ';
            metaText += 'Pilar: ' + post.pillar;
        }
        if (metaText) {
            const metaPara = corpoLivro.appendParagraph(metaText);
            metaPara.setItalic(true);
            try {
                const textObj = metaPara.editAsText();
                textObj.setFontSize(10);
                textObj.setFontFamily('Arial');
            } catch (e) {}
        }

        // Espaço após metadados
        corpoLivro.appendParagraph('');

        // Conteúdo do post (corpo)
        const paragraphs = post.body.split(/\n\n+/);
        paragraphs.forEach(pText => {
            if (pText.trim()) {
                const p = corpoLivro.appendParagraph(pText.trim());
                processMarkdownLinksInText(p);
            }
        });
    });

    livro.saveAndClose();
    Logger.log('Compilação para "' + NOME_LIVRO_COMPLETO + '" concluída com sucesso.');
}

/**
 * Auxiliar para analisar a estrutura do arquivo Markdown (.md) com suporte a BOM.
 */
function parseMarkdownPost(content, fileName) {
    // Remover BOM se presente
    const cleanContent = content.replace(/^\uFEFF/, '').trim();
    
    // Expressão regular para isolar o bloco de Front Matter
    const fmRegex = /^---\s*(?:\r?\n)([\s\S]*?)(?:\r?\n)---\s*(?:\r?\n)([\s\S]*)$/;
    const match = cleanContent.match(fmRegex);
    
    let title = '';
    let dateStr = '';
    let pillar = '';
    let body = '';
    
    if (match) {
        const fmText = match[1];
        body = match[2].trim();
        
        // Analisar linhas do Front Matter
        const lines = fmText.split(/\r?\n/);
        lines.forEach(line => {
            const matchTitle = line.match(/^title:\s*["']?(.*?)["']?$/i);
            const matchDate = line.match(/^date:\s*["']?([^"'\s]+)/i); // Extrai o YYYY-MM-DD diretamente
            const matchPillar = line.match(/^pillar:\s*["']?(.*?)["']?$/i);
            if (matchTitle) {
                title = matchTitle[1].trim();
            } else if (matchDate) {
                dateStr = matchDate[1].trim();
            } else if (matchPillar) {
                pillar = matchPillar[1].trim();
            }
        });
    } else {
        body = cleanContent;
    }
    
    if (!title) {
        title = fileName.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    }
    
    return {
        title: title,
        dateStr: dateStr,
        pillar: pillar,
        body: body
    };
}

/**
 * Auxiliar para converter links Markdown [texto](url) em links formatados no Google Docs.
 */
function processMarkdownLinksInText(elementoParagrafo) {
    const textoCompleto = elementoParagrafo.getText();
    const regexLink = /\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = [];
    let match;
    while ((match = regexLink.exec(textoCompleto)) !== null) {
        let url = match[2];
        if (!url.startsWith('http')) {
            url = 'https://blog.wingene.com.br' + url;
        }
        matches.push({
            index: match.index,
            fullMatch: match[0],
            text: match[1],
            url: url
        });
    }
    
    if (matches.length > 0) {
        const textObj = elementoParagrafo.editAsText();
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            const start = m.index;
            const end = m.index + m.fullMatch.length - 1;
            const textLen = m.text.length;
            
            try {
                textObj.deleteText(start + 1 + textLen, end);
                textObj.deleteText(start, start);
                textObj.setLinkUrl(start, start + textLen - 1, m.url);
            } catch (e) {}
        }
    }
}
