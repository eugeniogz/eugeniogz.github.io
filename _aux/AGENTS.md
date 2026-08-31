# Diretrizes e Regras de Desenvolvimento do Projeto Wingene

## Gerenciamento de Tags e Metadados
1. **Lógica de Tags**: Sempre que criar ou refatorar tags em posts, crônicas, poesias ou reflexões, siga rigorosamente as diretivas editoriais de `_aux/sync_json_from_index.js` e `_aux/refatorar_todas_as_tags.js`.
2. **Limite Global**: O catálogo de tags do site deve ser mantido denso e coeso, com o limite máximo de **36 tags únicas** no total.
3. **Normalização**: Variações de palavras devem seguir a convenção de capitalização padrão (ex: "Vida", "Atenção", "Decisões", "Valores", "Imperfeições", "Sistema GENE", "Método VIDA").
4. **Sincronização Automática**: Sempre após alterar tags ou metadados em arquivos Markdown (`.md`), execute os scripts de sincronização via terminal:
   - `node _aux/sync_json_from_index.js`
   - `node _aux/sync_tags_from_json.js`
5. **Automação Pré-Commit**: Sempre que for realizar um commit ou push, rode `node _aux/sync_json_from_index.js` antes de comitar para garantir que qualquer post novo seja processado pela IA para receber tags e metadados.

