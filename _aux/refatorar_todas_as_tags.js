const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// 📌 Catálogo Master Unificado de EXATAMENTE 36 Tags
const MASTER_TAGS = [
    "Atenção", "Decisões", "Valores", "Imperfeições", "Método VIDA",
    "Wingene", "Sistema GENE", "Eudaimonia", "Metaconsciência", "Propriocepção",
    "Presença", "Consciência", "Autoconhecimento", "Silêncio", "Pausa",
    "Ação", "Hábitos", "Cotidiano", "Natureza", "Contemplação",
    "Sensações", "Euforia", "Harmonia", "Resiliência", "Amor",
    "Afeto", "Família", "Café", "Música", "Arte",
    "Tempo", "Memória", "Existência", "Filosofia", "Sociedade",
    "Futuro Ancestral"
];

// Mapeamento de sinonímias e consolidação para a taxonomia master de 36 tags
const TAG_MAP = {
    'vida': 'Vida',
    'VIDA': 'Vida',
    'metodo vida': 'Método VIDA',
    'método vida': 'Método VIDA',
    'sistema gene': 'Sistema GENE',
    'futuro ancestral': 'Futuro Ancestral',
    'justiça social': 'Sociedade',
    'cidadania': 'Sociedade',
    'humanidade': 'Sociedade',
    'acolhimento': 'Afeto',
    'escuta': 'Atenção',
    'empatia': 'Afeto',
    'rituais': 'Cotidiano',
    'crescimento': 'Autoconhecimento',
    'evolução': 'Autoconhecimento',
    'autocontrole': 'Autoconhecimento',
    'ciência': 'Filosofia',
    'etimologia': 'Filosofia',
    'serena euforia': 'Euforia',
    'conduta': 'Valores',
    'conhecimento': 'Autoconhecimento',
    'superação': 'Resiliência',
    'respeito': 'Valores',
    'trabalho': 'Ação',
    'mitologia': 'Filosofia',
    'infância': 'Memória',
    'cosmos': 'Existência',
    'viagem': 'Contemplação'
};

function parseYamlFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { meta: {}, body: content };

    const yamlText = match[1];
    const body = content.slice(match[0].length);
    const lines = yamlText.split(/\r?\n/);
    const meta = {};

    let inTags = false;
    let tagsList = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (inTags) {
            const listMatch = line.match(/^\s*-\s*(.+)$/);
            if (listMatch) {
                let tagVal = listMatch[1].trim().replace(/^['"]|['"]$/g, '');
                if (tagVal) tagsList.push(tagVal);
                continue;
            } else if (/^\s*$/.test(line)) {
                continue;
            } else {
                inTags = false;
                meta['tags'] = tagsList;
            }
        }

        const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim();
            let val = kvMatch[2].trim();

            if (key === 'tags') {
                if (val.startsWith('[') && val.endsWith(']')) {
                    const rawTags = val.slice(1, -1).split(',');
                    meta['tags'] = rawTags.map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                } else if (!val) {
                    inTags = true;
                    tagsList = [];
                }
                continue;
            }

            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            meta[key] = val;
        }
    }

    if (inTags) {
        meta['tags'] = tagsList;
    }

    return { meta, body };
}

function updateMdTags(mdPath, newTags) {
    if (!fs.existsSync(mdPath)) return;
    const content = fs.readFileSync(mdPath, 'utf8');
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return;

    let yamlLines = frontmatterMatch[1].split(/\r?\n/);

    let tagsStartIdx = -1;
    let tagsEndIdx = -1;

    for (let i = 0; i < yamlLines.length; i++) {
        if (/^tags\s*:/i.test(yamlLines[i])) {
            tagsStartIdx = i;
            tagsEndIdx = i;
            for (let j = i + 1; j < yamlLines.length; j++) {
                if (/^\s+/.test(yamlLines[j]) || /^\s*-\s*/.test(yamlLines[j])) {
                    tagsEndIdx = j;
                } else {
                    break;
                }
            }
            break;
        }
    }

    const tagLines = ['tags:'];
    for (const t of newTags) {
        tagLines.push(`  - ${t}`);
    }

    if (tagsStartIdx !== -1) {
        yamlLines.splice(tagsStartIdx, (tagsEndIdx - tagsStartIdx + 1), ...tagLines);
    } else {
        yamlLines.push(...tagLines);
    }

    const newContent = `---\n${yamlLines.join('\n')}\n---${content.slice(frontmatterMatch[0].length)}`;
    if (content !== newContent) {
        fs.writeFileSync(mdPath, newContent, 'utf8');
    }
}

function selectBestTags(title, pillar, existingTags, body) {
    const textLower = (title + ' ' + (pillar || '') + ' ' + (existingTags.join(' ')) + ' ' + body).toLowerCase();
    const selected = new Set();

    // Pilar sempre entra como tag principal se presente no master
    if (pillar) {
        const pillarNorm = pillar.trim();
        if (MASTER_TAGS.includes(pillarNorm)) {
            selected.add(pillarNorm);
        }
    }

    // Mapear tags existentes para o catálogo master
    for (const rawTag of existingTags) {
        const t = rawTag.trim();
        const tLower = t.toLowerCase();
        if (TAG_MAP[tLower]) {
            selected.add(TAG_MAP[tLower]);
        } else if (MASTER_TAGS.includes(t)) {
            selected.add(t);
        } else {
            // Tentar aproximação
            const cap = tLower.charAt(0).toUpperCase() + tLower.slice(1);
            if (MASTER_TAGS.includes(cap)) {
                selected.add(cap);
            }
        }
    }

    // Palavras-chave no corpo/título
    const keywords = [
        ['café', 'Café'],
        ['natureza', 'Natureza'],
        ['sabiá', 'Natureza'],
        ['bem-te-vi', 'Natureza'],
        ['lagoa', 'Natureza'],
        ['palafita', 'Natureza'],
        ['música', 'Música'],
        ['canto', 'Música'],
        ['arte', 'Arte'],
        ['pintura', 'Arte'],
        ['silêncio', 'Silêncio'],
        ['pausa', 'Pausa'],
        ['hábitos', 'Hábitos'],
        ['hábito', 'Hábitos'],
        ['presença', 'Presença'],
        ['propriocepção', 'Propriocepção'],
        ['metaconsciência', 'Metaconsciência'],
        ['eudaimonia', 'Eudaimonia'],
        ['cotidiano', 'Cotidiano'],
        ['família', 'Família'],
        ['vovô', 'Família'],
        ['amor', 'Amor'],
        ['afeto', 'Afeto'],
        ['tempo', 'Tempo'],
        ['relógio', 'Tempo'],
        ['memória', 'Memória'],
        ['ancestral', 'Futuro Ancestral'],
        ['cidadania', 'Cidadania'],
        ['sociedade', 'Sociedade'],
        ['tecnologia', 'Ciência'],
        ['ciência', 'Ciência'],
        ['filosofia', 'Filosofia'],
        ['etimologia', 'Etimologia'],
        [' wingene', 'Wingene'],
        ['método vida', 'Método VIDA'],
        ['sistema gene', 'Sistema GENE']
    ];

    for (const [kw, tag] of keywords) {
        if (selected.size >= 4) break;
        if (textLower.includes(kw) && MASTER_TAGS.includes(tag)) {
            selected.add(tag);
        }
    }

    // Garantir pelo menos 3 tags de fallback relevantes
    const fallbacks = ['Atenção', 'Cotidiano', 'Contemplação', 'Consciência', 'Reflexão', 'Existência'];
    for (const fb of fallbacks) {
        if (selected.size >= 3) break;
        if (MASTER_TAGS.includes(fb)) {
            selected.add(fb);
        }
    }

    return Array.from(selected).slice(0, 4);
}

function updateDataJsonFiles() {
    const dataDir = path.join(ROOT_DIR, '_data');
    if (!fs.existsSync(dataDir)) return;

    const files = fs.readdirSync(dataDir);
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(dataDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            let modified = false;

            function mapItemTags(item) {
                if (!item || !Array.isArray(item.tags)) return;
                const newTags = new Set();
                item.tags.forEach(t => {
                    if (!t) return;
                    const tClean = t.trim();
                    const tLower = tClean.toLowerCase();
                    if (TAG_MAP[tLower]) {
                        newTags.add(TAG_MAP[tLower]);
                    } else if (MASTER_TAGS.includes(tClean)) {
                        newTags.add(tClean);
                    } else {
                        const cap = tLower.charAt(0).toUpperCase() + tLower.slice(1);
                        if (MASTER_TAGS.includes(cap)) {
                            newTags.add(cap);
                        }
                    }
                });

                const arr = Array.from(newTags).slice(0, 4);
                if (JSON.stringify(item.tags) !== JSON.stringify(arr)) {
                    item.tags = arr;
                    modified = true;
                }
            }

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (Array.isArray(item.stories)) {
                        item.stories.forEach(mapItemTags);
                    } else {
                        mapItemTags(item);
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
                console.log(`  ✅ Sincronizado _data/${file} com o catálogo de 36 tags`);
            }
        } catch (e) {}
    }
}

function processAllFiles() {
    const dirs = ['_posts', 'cronicas', 'poesias-e-aforismos', 'reflexoes', 'ipes-e-tijolos', 'o-cascudo-e-outras-historias', 'wingene'];
    let count = 0;
    const usedMasterTags = new Set();

    for (const d of dirs) {
        const dp = path.join(ROOT_DIR, d);
        if (!fs.existsSync(dp)) continue;

        function scan(dir) {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                const fp = path.join(dir, f.name);
                if (f.isDirectory()) {
                    scan(fp);
                } else if (f.name.endsWith('.md') && f.name !== 'index.md') {
                    const content = fs.readFileSync(fp, 'utf8');
                    const { meta, body } = parseYamlFrontmatter(content);
                    const newTags = selectBestTags(
                        meta.title || f.name,
                        meta.pillar || '',
                        meta.tags || [],
                        body
                    );

                    newTags.forEach(t => usedMasterTags.add(t));
                    updateMdTags(fp, newTags);
                    count++;
                }
            }
        }
        scan(dp);
    }

    updateDataJsonFiles();

    console.log(`✅ Processadas ${count} publicações em todo o site.`);
    console.log(`📌 Total de tags únicas utilizadas em todo o site: ${usedMasterTags.size} (Limite máximo: 36)`);
    console.log('Catálogo final de tags ativas no site:', Array.from(usedMasterTags).sort().join(', '));
}

function main() {
    console.log('🚀 Refatorando todas as tags do site para o Catálogo Master de no máximo 48 tags...');
    processAllFiles();

    console.log('\n🔄 Executando _aux/sync_json_from_index.js e _aux/sync_tags_from_json.js...');
    try {
        execSync(`node "${path.join(__dirname, 'sync_json_from_index.js')}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
        execSync(`node "${path.join(__dirname, 'sync_tags_from_json.js')}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {
        console.error('⚠️ Erro ao sincronizar:', e.message);
    }
}

main();
