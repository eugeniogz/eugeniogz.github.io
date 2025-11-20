/**
 * Compila documentos em subpastas da pasta 'Pessoal/Meus.Textos/Finalizados',
 * criando DOIS livros individuais para cada subpasta, usando um arquivo 'Config'
 * para Epígrafe e Ordenação do Livro.
 */
function gerarLivroComDocumentos() {
    
    const NOME_PASTA_RAIZ = 'Finalizados';
    
    let idPastaRaiz = null;

    try { 
        Logger.log('Procurando a pasta raiz: Pessoal/Meus.Textos/Finalizados');
        
        // --- 1. Localizar a pasta raiz ---
        const folders = DriveApp.getFoldersByName('Pessoal');
        while (folders.hasNext()) {
            const pastaPessoal = folders.next();
            const pastasTextosIter = pastaPessoal.getFoldersByName('Meus.Textos');
            while (pastasTextosIter.hasNext()) {
                const pastaMeusTextos = pastasTextosIter.next();
                const pastasFinalizados = pastaMeusTextos.getFoldersByName(NOME_PASTA_RAIZ);
                if (pastasFinalizados.hasNext()) {
                    idPastaRaiz = pastasFinalizados.next().getId();
                    break;
                }
            }
            if (idPastaRaiz) break;
        }

        if (!idPastaRaiz) {
            Logger.log('Pasta raiz "Pessoal/Meus.Textos/Finalizados" não encontrada.');
            return;
        }

        const pastaFinalizados = DriveApp.getFolderById(idPastaRaiz);
        const subpastas = pastaFinalizados.getFolders();
        
        const compilados = pastaFinalizados.getFoldersByName("_compilados");
        let pastaCompilados = null;
        if (compilados.hasNext()) {
          pastaCompilados = compilados.next();
        } else {
          Logger.log('Pasta raiz "Pessoal/Meus.Textos/Finalizados/_compilados" não encontrada.');
          return;
        }
        while (subpastas.hasNext()) {
            const subpasta = subpastas.next();
            if (subpasta.getName().startsWith("_")) continue;
            compilarDoisLivrosDaPasta(pastaCompilados, subpasta);    
        }
        
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
    
    // Passa o NOME_PASTA como o nome da raiz do livro
    const tipoSaidaLivro = coletarConteudoDePasta(pastaDestino, NOME_PASTA, true, listaDocs); 
    
    if (!verificarNecessidadeCompilacao(pastaFinalizados, NOME_LIVRO_FORMATADO, listaDocs)) {
      return;
    }
    // 2. Ordenar os documentos internos (USANDO SOMENTE METADADOS)
    listaDocs.sort(compararDocs());
    
    
    // 3. Gerar Livro Puro
    // gerarLivro(NOME_LIVRO_PURO, pastaFinalizados, listaDocs, 'PURO', tipoSaidaLivro);

    // 4. Gerar Livro Formatado
    gerarLivro(NOME_LIVRO_FORMATADO, pastaFinalizados, listaDocs, 'FORMATADO', tipoSaidaLivro);

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
function gerarLivro(nomeLivroComSubtitulo, pastaDestino, listaDocs, tipo, tipoSaidaLivro) {
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
        
        // 3. Inserir conteúdo dos documentos
        let isFirstContentAfterCover = true;
        let lastChapterName = null; 
        
        let epigrafeInserted = false;

        listaDocs.forEach(docMeta => {
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
                    livro.saveAndClose();
                    livro = DocumentApp.openById(arquivoLivro.getId());
                    corpoLivro = livro.getBody();
                } catch (e) {
                     corpoLivro.appendParagraph('ERRO: Falha na cópia de conteúdo formatado do documento "' + docMeta.nomeArquivo + '".');
                }
            }
        });
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
            
            const paragrafoOrigem = elementoOrigem.asParagraph() || elementoOrigem.asListItem();
            if (!paragrafoOrigem) continue; 
            
            const heading = paragrafoOrigem.getHeading();
            const textoCompleto = paragrafoOrigem.getText();

            //if (textoCompleto.trim().length === 0) continue; 

            // 1. Remoção de Metadados (Condicional)
            if (heading === DocumentApp.ParagraphHeading.NORMAL || heading === DocumentApp.ParagraphHeading.UNSUPPORTED) {
                if (textoCompleto.trim().match(/^Ordenação:\s*(\d+)/i) || textoCompleto.trim().match(/^Tags:/i)) {
                    continue; 
                }
            }

            // 2. Criação do Novo Elemento
            let novoParagrafo;
            if (tipo === DocumentApp.ElementType.LIST_ITEM) {
                // Para List Item, precisamos usar o texto completo para criar
                novoParagrafo = corpoDestino.appendListItem(textoCompleto);
                try {
                    novoParagrafo.setNestingLevel(elementoOrigem.asListItem().getNestingLevel());
                } catch (e) { /* Ignora */ }
            } else {
                // Cria o parágrafo com o texto completo
                novoParagrafo = corpoDestino.appendParagraph(textoCompleto);
            }

            // 3. Padronização de Headers e Cópia de Estilos de Parágrafo
            if (heading !== DocumentApp.ParagraphHeading.NORMAL && heading !== DocumentApp.ParagraphHeading.UNSUPPORTED) {
                // Padroniza o Header
                novoParagrafo.setHeading(DocumentApp.ParagraphHeading.HEADING2);
            } else {
                // Copia atributos de parágrafo (alinhamento, espaçamento)
                try {
                    novoParagrafo.setAttributes(paragrafoOrigem.getAttributes());
                    for (let j = 0; j < paragrafoOrigem.getNumChildren(); j++) {
                      const child = paragrafoOrigem.getChild(j);
                      if (child.getType() === DocumentApp.ElementType.TEXT) {
                          const textElement = child.asText();
                          const textContent = textElement.getText();
                          const textNovo = novoParagrafo.editAsText();
                          for (let k = 0; k < textContent.length; k++) {
                              const isBold = textElement.isBold(k);
                              const isItalic = textElement.isItalic(k);
                              const attributesToSet = {};
                          
                              // Copia o valor booleano ou null (usando || false para segurança)
                              attributesToSet[DocumentApp.Attribute.BOLD] = isBold || false;
                              attributesToSet[DocumentApp.Attribute.ITALIC] = isItalic || false;

                              if (isBold || isItalic) {
                                // Aplicamos APENAS os atributos de BOLD e ITALIC que nos interessam
                                textNovo.setAttributes(k, k, attributesToSet);
                              }
                          }
                              
                          
                      }
                    }
                    // 4. Cópia da Formatação de Texto em Nível de Caractere/Palavra
                    // try {
                    //   // Obtém a interface Text do parágrafo original
                    //   const textOrigem = paragrafoOrigem.editAsText();
                    //   const textNovo = novoParagrafo.editAsText();
                    //   const len = textoCompleto.length;
                      
                    //   // Itera sobre o texto para copiar a formatação caractere por caractere
                    //   for (let j = 0; j < len; j++) {
                    //       // Obtém o mapa completo de atributos no índice j
                    //       // const attributes = textOrigem.getAttributes(j); 
                          
                    //       // // Verifica explicitamente BOLD e ITALIC no mapa de atributos
                    //       // const isBold = attributes[DocumentApp.Attribute.BOLD];
                    //       // const isItalic = attributes[DocumentApp.Attribute.ITALIC];
                    //       const isBold = textOrigem.isBold(j); 
                    //       const isItalic = textOrigem.isItalic(j); 

                    //       const attributesToSet = {};
                          
                    //       // Copia o valor booleano ou null (usando || false para segurança)
                    //       attributesToSet[DocumentApp.Attribute.BOLD] = isBold || false;
                    //       attributesToSet[DocumentApp.Attribute.ITALIC] = isItalic || false;

                    //       if (isBold || isItalic) {
                    //         // Aplicamos APENAS os atributos de BOLD e ITALIC que nos interessam
                    //         textNovo.setAttributes(j, j, attributesToSet);
                    //       }
                    //   }
                  } catch (e) {
                      // Este bloco agora só serve para o fallback, pois a lógica de cópia é mais direta
                      Logger.log('Aviso: Cópia caractere por caractere detalhada falhou (' + e.toString() + '). Tentando cópia de nível de parágrafo...');
                      
                      // Fallback para cópia total de atributos (perde fidelidade)
                      try {
                          const allTextAttributes = paragrafoOrigem.getAttributes(); 
                          novoParagrafo.setAttributes(allTextAttributes);
                      } catch (e2) {
                          Logger.log('Aviso: Cópia de nível de parágrafo falhou: ' + e2.toString());
                      }
                  }
                }
        }       
        // 5. Processar Tabelas (Cópia direta de elemento)
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
 * Função recursiva para coletar documentos, extrair metadados (Ordenação:, Tags:), 
 * e limpar o texto.
 * * @param {GoogleAppsScript.Drive.Folder} pasta A pasta atual a ser processada.
 * @param {string} nomePastaRaiz Nome da pasta raiz do livro atual.
 * @param {string} pastaPaiNomeAtual Nome da pasta atual (para rastrear o nome do capítulo Nível 2).
 * @param {boolean} isRootFolder Se esta pasta é a raiz do livro.
 * @param {Array<Object>} listaDocs A lista que armazena os metadados.
 * @param {object} livroMeta Metadados do livro, incluindo ordenacaoCapitulo.
 */
function coletarConteudoDePasta(pasta, pastaPaiNomeAtual, isRootFolder, listaDocs) {
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
            
            const matchOrdenacao = configText.match(/Ordenação:\s*(\d+)/i);
            const matchEpigrafe = configText.match(/Epígrafe:\s*(.*)/i);
            const matchTipoSaida = configText.match(/TipoSaida:\s*Artigo\s*/i);
            
            if (matchOrdenacao) {
                ordenacaoCapitulo = parseInt(matchOrdenacao[1], 10);
            }
            if (matchEpigrafe) {
                epigrafeCapitulo = matchEpigrafe[1].trim().split('\n')[0].trim();
            }
            if (matchTipoSaida) {
                tipoSaidaLivro = false;
            }
            
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
            
            try {
                const docConteudo = DocumentApp.openById(arquivo.getId());
                const textoCompleto = docConteudo.getBody().getText();
                
                let ordenacao = ORDENACAO_PADRAO_DOCUMENTO;
                
                const linhas = textoCompleto.split('\n');
                const regexOrdenacao = /^Ordenação:\s*(\d+)/i; 
                
                // Extrair Ordenação: NNN
                const limite = Math.max(0, linhas.length - 5); 
                for (let i = linhas.length - 1; i >= limite; i--) {
                    const linha = linhas[i].trim();
                    const matchOrdenacao = linha.match(regexOrdenacao);
                    if (matchOrdenacao) {
                        ordenacao = parseInt(matchOrdenacao[1], 10);
                        break; 
                    }
                }
                
                // Recriar o texto limpo (removendo tags de Ordenação/Tags)
                const textoLimpo = linhas.filter(l => !l.trim().match(/^(Ordenação|Tags):/i)).join('\n').trim();

                listaDocs.push({
                    id: arquivo.getId(),
                    nomeArquivo: nomeArquivo,
                    pastaPaiNomeAtual: pastaPaiNomeAtual, // O nome da pasta atual (para a capa Nível 2)
                    epigrafe : epigrafeCapitulo,
                    isRootFolder: isRootFolder,
                    ordenacaoCapitulo: ordenacaoCapitulo,
                    ordenacao: ordenacao, // Ordem NNN do GDoc
                    textoLimpo: textoLimpo
                });
                
            } catch (e) {
                Logger.log('ERRO ao ler ou processar o documento "' + nomeArquivo + '": ' + e.toString());
                listaDocs.push({
                    id: arquivo.getId(),
                    nomeArquivo: nomeArquivo,
                    pastaPaiNomeAtual: pastaPaiNomeAtual,
                    epigrafe : '',
                    isRootFolder: isRootFolder,
                    ordenacaoCapitulo: 999,
                    ordenacao: ORDENACAO_PADRAO_DOCUMENTO,
                    textoLimpo: 'ERRO: Falha na cópia de conteúdo do documento "' + nomeArquivo + '". Mensagem: ' + e.toString()
                });
            }
        }
    }

    // Chamada Recursiva: Processar Subpastas
    const subpastas = pasta.getFolders();
    while (subpastas.hasNext()) {
        const subpastaFilha = subpastas.next();
        // Passa o nome da raiz, o nome da subpasta filha e isRootFolder=false
        tipoSaidaLivro=coletarConteudoDePasta(subpastaFilha, subpastaFilha.getName(), false, listaDocs) && tipoSaidaLivro;
    }
    return tipoSaidaLivro;
}