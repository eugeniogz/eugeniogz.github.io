const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, '_data');

const FOLDER_MAP = {
    'wingene': 'wingene',
    'cascudo': 'o-cascudo-e-outras-historias',
    'cronicas': 'cronicas',
    'ipes': 'ipes-e-tijolos',
    'poesias': 'poesias-e-aforismos',
    'reflexoes': 'reflexoes',
    'posts': '_posts'
};

function loadEnv() {
    const envPath = path.join(ROOT_DIR, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
                const key = trimmed.slice(0, eqIdx).trim();
                const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    }
}

loadEnv();


function extractTagsFromData(dataObj, tagsSet) {
    if (Array.isArray(dataObj)) {
        for (const item of dataObj) {
            if (!item) continue;
            if (Array.isArray(item.stories)) {
                for (const story of item.stories) {
                    if (story && Array.isArray(story.tags)) {
                        story.tags.forEach(t => t && typeof t === 'string' && t.trim() && tagsSet.add(t.trim()));
                    }
                }
            } else if (Array.isArray(item.tags)) {
                item.tags.forEach(t => t && typeof t === 'string' && t.trim() && tagsSet.add(t.trim()));
            }
        }
    }
}

function getAllExistingTags() {
    const tagsSet = new Set();

    if (fs.existsSync(DATA_DIR)) {
        const files = fs.readdirSync(DATA_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
                extractTagsFromData(data, tagsSet);
            } catch (e) {}
        }
    }

    for (const folderName of Object.values(FOLDER_MAP)) {
        const sectionFolder = path.join(ROOT_DIR, folderName);
        if (!fs.existsSync(sectionFolder)) continue;

        function scanDir(dir) {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        scanDir(fullPath);
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const { meta } = parseYamlFrontmatter(content);
                        if (Array.isArray(meta.tags)) {
                            for (const t of meta.tags) {
                                if (t && typeof t === 'string' && t.trim()) {
                                    tagsSet.add(t.trim());
                                }
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        scanDir(sectionFolder);
    }

    return Array.from(tagsSet).sort();
}

async function generateMetadataWithAI(title, bodyContent, existingTags = []) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return null;
    }

    const models = ['gemini-3.1-flash', 'gemini-2.5-flash'];
    const existingTagsStr = existingTags.length > 0 ? existingTags.join(', ') : '';
    const prompt = `Você é um editor assistente de publicação para um site autoral de literatura e filosofia.
Analise o título e texto do artigo fornecidos e retorne APENAS um JSON estrito no seguinte formato:
{
  "desc": "Uma síntese/descrição elegante em 1 frase (máximo 160 caracteres) sobre o artigo em português.",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

Diretrizes para a descrição ("desc"):
- Escreva em tom elegante, poético, denso e filosófico, mantendo o estilo autoral do site.
- Evite linguagem comercial/marketing (como "neste artigo você aprenderá...", "descubra como...").
- Formule 1 frase concisa e expressiva que capture a essência temática ou reflexiva do texto.

Exemplos de descrições reais já publicadas no site (use como referência de tom e extensão):
• "O espírito não metafísico: a fauna consciente que habita o ecossistema mental e ampara os momentos difíceis."
• "A coexistência poética entre os muros rígidos do concreto urbano e a delicada explosão dos ipês floridos."
• "Superar a ilusão das telas e do imediatismo virtual para vivenciar o concreto da existência."
• "O guia completo do Método VIDA: quatro pilares práticos (Valores, Imperfeições, Decisões, Atenção) para calibrar a bússola ética e construir a eudaimonia diária."
• "Sentenças breves e lapidadas sobre ciência, consciência, amor, virtudes, eudaimonia e existência."
• "O estado de plenitude silenciosa que floresce na mente desperta."
• "Vovô Aurélio mostra a Marcos um precioso relógio de família e revela que o que realmente dá corda e faz a vida funcionar é a nossa atenção."

Observações para as tags:
- Devem ter entre 3 e 4 palavras-chave curtas, em português, sem numeração ou símbolos.
- O catálogo de tags do site busca manter-se coeso e relevante, com um limite alvo de NO MÁXIMO 36 TAGS fundamentais no total.
- Dê preferência para utilizar as tags já existentes no site (listadas abaixo) sempre que forem adequadas e precisas.
- É PERMITIDO propor novas tags mais significativas, densas e representativas do tema caso expressem o conteúdo com maior relevância do que as tags genéricas existentes, permitindo a evolução e substituição progressiva por um acervo mais expressivo.
${existingTagsStr ? `\nLista de tags existentes no site (máximo de 36 no catálogo global):\n${existingTagsStr}\n` : ''}

Título: "${title}"
Conteúdo do artigo:
${bodyContent.slice(0, 3500)}`;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) continue;

            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) continue;

            const parsed = JSON.parse(rawText);
            const desc = (parsed.desc || parsed.description || '').trim();
            const tags = Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).trim()).filter(Boolean) : [];

            if (desc || tags.length > 0) {
                return { desc, tags };
            }
        } catch (e) {
            // Tenta o próximo modelo
        }
    }

    return null;
}


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

function updateMdFrontmatter(mdPath, newDesc, newTags) {
    if (!fs.existsSync(mdPath)) return;
    const content = fs.readFileSync(mdPath, 'utf8');
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return;

    let yamlLines = frontmatterMatch[1].split(/\r?\n/);

    if (newDesc) {
        const descIdx = yamlLines.findIndex(l => /^desc(ription)?\s*:/i.test(l));
        if (descIdx !== -1) {
            yamlLines[descIdx] = `description: "${newDesc.replace(/"/g, '\\"')}"`;
        } else {
            yamlLines.push(`description: "${newDesc.replace(/"/g, '\\"')}"`);
        }
    }

    if (newTags && newTags.length > 0) {
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
    }

    const newContent = `---\n${yamlLines.join('\n')}\n---${content.slice(frontmatterMatch[0].length)}`;
    if (content !== newContent) {
        fs.writeFileSync(mdPath, newContent, 'utf8');
        try {
            execSync(`git add "${path.relative(ROOT_DIR, mdPath)}"`, { cwd: ROOT_DIR });
        } catch (e) {}
    }
}

function parseIndexMd(indexMdPath) {
    if (!fs.existsSync(indexMdPath)) return [];

    const content = fs.readFileSync(indexMdPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const items = [];

    const linkRegex = /(?:###?\s*📄?\s*)?\[([^\]]+)\]\(\s*(?:\.\/)?([^)\s]+)\s*\)(?:\s*<span[^>]*>\[?(\d+\s*min)\]?<\/span>)?/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(linkRegex);

        if (match) {
            const title = match[1].trim();
            const rawPath = match[2].trim();
            const time = match[3] ? match[3].trim() : null;

            const filenameOnly = rawPath.split('/').pop();
            const slug = filenameOnly.replace(/\.(html|md)$/i, '');

            if (!slug || slug === 'index' || rawPath.startsWith('http') || rawPath.startsWith('#')) {
                continue;
            }

            let desc = '';
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('<') && !nextLine.startsWith('[') && !nextLine.startsWith('-') && !nextLine.startsWith('*') && !nextLine.startsWith('---')) {
                    desc = nextLine;
                }
            }

            items.push({
                slug,
                title,
                time,
                filename: `${slug}.html`,
                desc
            });
        }
    }

    return items;
}

function findMdFileForSlug(folderPath, slug) {
    const candidates = [
        path.join(folderPath, `${slug}.md`),
        path.join(folderPath, slug, 'index.md'),
        path.join(folderPath, slug, `${slug}.md`)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
            return cand;
        }
    }

    try {
        const files = fs.readdirSync(folderPath);
        for (const f of files) {
            if (f.toLowerCase() === `${slug}.md`.toLowerCase()) {
                return path.join(folderPath, f);
            }
        }
    } catch (e) {}

    return null;
}

async function processFlatSection(jsonBaseName, folderName, existingTags = []) {
    const jsonPath = path.join(DATA_DIR, `${jsonBaseName}.json`);
    const sectionFolder = path.join(ROOT_DIR, folderName);
    const indexMdPath = path.join(sectionFolder, 'index.md');

    if (!fs.existsSync(jsonPath) || !fs.existsSync(indexMdPath)) {
        return false;
    }

    let rawJson;
    try {
        rawJson = fs.readFileSync(jsonPath, 'utf8');
    } catch (e) {
        return false;
    }

    let dataArray;
    try {
        dataArray = JSON.parse(rawJson);
        if (!Array.isArray(dataArray)) return false;
    } catch (e) {
        return false;
    }

    const indexItems = parseIndexMd(indexMdPath);
    if (indexItems.length === 0) return false;

    const existingMap = new Map();
    for (const item of dataArray) {
        const slug = item.id || (item.filename ? item.filename.replace(/\.html$/i, '') : '');
        if (slug) existingMap.set(slug, item);
    }

    const updatedArray = [];

    for (let idx = 0; idx < indexItems.length; idx++) {
        const indexItem = indexItems[idx];
        const slug = indexItem.slug;
        const number = idx + 1;

        let itemObj = existingMap.get(slug) || {
            id: slug,
            number: number,
            title: indexItem.title,
            time: indexItem.time || '1 min',
            filename: indexItem.filename,
            desc: indexItem.desc
        };

        itemObj.number = number;
        if (indexItem.title) itemObj.title = indexItem.title;
        if (indexItem.filename) itemObj.filename = indexItem.filename;

        const mdPath = findMdFileForSlug(sectionFolder, slug);
        let mdBody = '';

        if (mdPath) {
            const mdContent = fs.readFileSync(mdPath, 'utf8');
            const { meta, body } = parseYamlFrontmatter(mdContent);
            mdBody = body;

            if (!itemObj.tags || !Array.isArray(itemObj.tags) || itemObj.tags.length === 0) {
                if (meta.tags && Array.isArray(meta.tags) && meta.tags.length > 0) {
                    itemObj.tags = meta.tags;
                }
            }
            if (meta.description || meta.desc) {
                itemObj.desc = meta.description || meta.desc;
            } else if (indexItem.desc && !itemObj.desc) {
                itemObj.desc = indexItem.desc;
            }
            if (meta.reading_time) {
                itemObj.time = `${meta.reading_time} min`;
            } else if (indexItem.time) {
                itemObj.time = indexItem.time;
            }
        } else {
            if (indexItem.desc && !itemObj.desc) {
                itemObj.desc = indexItem.desc;
            }
            if (indexItem.time && !itemObj.time) {
                itemObj.time = indexItem.time;
            }
        }

        // Geração por IA para desc e tags faltantes
        const needsDesc = !itemObj.desc || !itemObj.desc.trim();
        const needsTags = !itemObj.tags || !Array.isArray(itemObj.tags) || itemObj.tags.length === 0;

        if ((needsDesc || needsTags) && mdBody) {
            if (process.env.GEMINI_API_KEY) {
                console.log(`  🤖 [IA] Gerando metadados faltantes para "${slug}"...`);
                const aiResult = await generateMetadataWithAI(itemObj.title, mdBody, existingTags);
                if (aiResult) {
                    let aiDesc = '';
                    let aiTags = [];

                    if (needsDesc && aiResult.desc) {
                        itemObj.desc = aiResult.desc;
                        aiDesc = aiResult.desc;
                    }
                    if (needsTags && aiResult.tags.length > 0) {
                        itemObj.tags = aiResult.tags;
                        aiTags = aiResult.tags;
                        for (const t of aiResult.tags) {
                            if (t && !existingTags.includes(t)) existingTags.push(t);
                        }
                    }

                    if (mdPath && (aiDesc || aiTags.length > 0)) {
                        updateMdFrontmatter(mdPath, aiDesc, aiTags);
                    }
                    console.log(`     ✨ IA gerou: desc="${itemObj.desc}", tags=[${(itemObj.tags || []).join(', ')}]`);
                }
            } else {
                console.log(`  ⚠️ Metadados faltantes em "${slug}" (desc/tags), mas GEMINI_API_KEY não está configurada.`);
            }
        }

        updatedArray.push(itemObj);
    }

    const newJson = JSON.stringify(updatedArray, null, 2) + '\n';
    if (rawJson.trim() !== newJson.trim()) {
        fs.writeFileSync(jsonPath, newJson, 'utf8');
        console.log(`  ✅ Atualizado JSON: _data/${jsonBaseName}.json (${updatedArray.length} itens)`);
        try {
            execSync(`git add "${path.relative(ROOT_DIR, jsonPath)}"`, { cwd: ROOT_DIR });
        } catch (e) {}
        return true;
    }

    return false;
}

async function processVolumeSection(jsonBaseName, folderName, existingTags = []) {
    const jsonPath = path.join(DATA_DIR, `${jsonBaseName}.json`);
    const cronicasFolder = path.join(ROOT_DIR, folderName);

    if (!fs.existsSync(jsonPath) || !fs.existsSync(cronicasFolder)) return false;

    let rawJson;
    try {
        rawJson = fs.readFileSync(jsonPath, 'utf8');
    } catch (e) {
        return false;
    }

    let volumesArray;
    try {
        volumesArray = JSON.parse(rawJson);
        if (!Array.isArray(volumesArray)) return false;
    } catch (e) {
        return false;
    }

    let updatedCount = 0;

    for (const volume of volumesArray) {
        if (!volume || !Array.isArray(volume.stories)) continue;

        const volFolderRel = volume.folder ? volume.folder.replace(/\/$/, '') : volume.id;
        const volFolderPath = path.join(cronicasFolder, volFolderRel);
        const indexMdPath = path.join(volFolderPath, 'index.md');

        if (!fs.existsSync(indexMdPath)) continue;

        const indexItems = parseIndexMd(indexMdPath);
        if (indexItems.length === 0) continue;

        const existingStoriesMap = new Map();
        for (const story of volume.stories) {
            const slug = story.id || (story.filename ? story.filename.split('/').pop().replace(/\.html$/i, '') : '');
            if (slug) existingStoriesMap.set(slug, story);
        }

        const newStories = [];

        for (let idx = 0; idx < indexItems.length; idx++) {
            const indexItem = indexItems[idx];
            const slug = indexItem.slug;

            let storyObj = existingStoriesMap.get(slug) || {
                id: slug,
                title: indexItem.title,
                time: indexItem.time || '1 min',
                filename: `${volFolderRel}/${slug}.html`,
                desc: indexItem.desc
            };

            if (indexItem.title) storyObj.title = indexItem.title;
            storyObj.filename = `${volFolderRel}/${slug}.html`;

            const mdPath = findMdFileForSlug(volFolderPath, slug);
            let mdBody = '';

            if (mdPath) {
                const mdContent = fs.readFileSync(mdPath, 'utf8');
                const { meta, body } = parseYamlFrontmatter(mdContent);
                mdBody = body;

                if (!storyObj.tags || !Array.isArray(storyObj.tags) || storyObj.tags.length === 0) {
                    if (meta.tags && Array.isArray(meta.tags) && meta.tags.length > 0) {
                        storyObj.tags = meta.tags;
                    }
                }
                if (meta.description || meta.desc) {
                    storyObj.desc = meta.description || meta.desc;
                } else if (indexItem.desc && !storyObj.desc) {
                    storyObj.desc = indexItem.desc;
                }
                if (meta.reading_time) {
                    storyObj.time = `${meta.reading_time} min`;
                } else if (indexItem.time) {
                    storyObj.time = indexItem.time;
                }
            } else {
                if (indexItem.desc && !storyObj.desc) {
                    storyObj.desc = indexItem.desc;
                }
                if (indexItem.time && !storyObj.time) {
                    storyObj.time = indexItem.time;
                }
            }

            // Geração por IA para desc e tags faltantes em cronicas
            const needsDesc = !storyObj.desc || !storyObj.desc.trim();
            const needsTags = !storyObj.tags || !Array.isArray(storyObj.tags) || storyObj.tags.length === 0;

            if ((needsDesc || needsTags) && mdBody) {
                if (process.env.GEMINI_API_KEY) {
                    console.log(`  🤖 [IA] Gerando metadados faltantes para "${slug}"...`);
                    const aiResult = await generateMetadataWithAI(storyObj.title, mdBody, existingTags);
                    if (aiResult) {
                        let aiDesc = '';
                        let aiTags = [];

                        if (needsDesc && aiResult.desc) {
                            storyObj.desc = aiResult.desc;
                            aiDesc = aiResult.desc;
                        }
                        if (needsTags && aiResult.tags.length > 0) {
                            storyObj.tags = aiResult.tags;
                            aiTags = aiResult.tags;
                            for (const t of aiResult.tags) {
                                if (t && !existingTags.includes(t)) existingTags.push(t);
                            }
                        }

                        if (mdPath && (aiDesc || aiTags.length > 0)) {
                            updateMdFrontmatter(mdPath, aiDesc, aiTags);
                        }
                        console.log(`     ✨ IA gerou: desc="${storyObj.desc}", tags=[${(storyObj.tags || []).join(', ')}]`);
                    }
                } else {
                    console.log(`  ⚠️ Metadados faltantes em "${slug}" (desc/tags), mas GEMINI_API_KEY não está configurada.`);
                }
            }

            newStories.push(storyObj);
        }

        volume.stories = newStories;
        volume.count = newStories.length;
        updatedCount++;
    }

    const newJson = JSON.stringify(volumesArray, null, 2) + '\n';
    if (rawJson.trim() !== newJson.trim()) {
        fs.writeFileSync(jsonPath, newJson, 'utf8');
        console.log(`  ✅ Atualizado JSON de volumes: _data/${jsonBaseName}.json`);
        try {
            execSync(`git add "${path.relative(ROOT_DIR, jsonPath)}"`, { cwd: ROOT_DIR });
        } catch (e) {}
        return true;
    }

    return false;
}

async function processPostsFolder(existingTags = [], force = false) {
    const postsFolder = path.join(ROOT_DIR, '_posts');
    if (!fs.existsSync(postsFolder)) return false;

    const forceTags = force || process.argv.includes('--force') || process.argv.includes('--force-posts-tags');
    let updatedTotal = 0;
    const files = fs.readdirSync(postsFolder).sort();

    for (const file of files) {
        if (!file.endsWith('.md') || file === 'index.md') continue;

        const mdPath = path.join(postsFolder, file);
        const mdContent = fs.readFileSync(mdPath, 'utf8');
        const { meta, body } = parseYamlFrontmatter(mdContent);

        const title = meta.title || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
        const needsDesc = !meta.description && !meta.desc;
        const needsTags = forceTags || !meta.tags || !Array.isArray(meta.tags) || meta.tags.length === 0;

        if ((needsDesc || needsTags) && body) {
            if (process.env.GEMINI_API_KEY) {
                console.log(`  🤖 [IA] Gerando metadados${forceTags ? ' (FORÇADO)' : ''} para post "_posts/${file}"...`);
                const aiResult = await generateMetadataWithAI(title, body, existingTags);
                if (aiResult) {
                    let aiDesc = needsDesc ? aiResult.desc : null;
                    let aiTags = needsTags ? aiResult.tags : null;

                    if (aiTags && aiTags.length > 0) {
                        for (const t of aiTags) {
                            if (t && !existingTags.includes(t)) existingTags.push(t);
                        }
                    }

                    if (aiDesc || (aiTags && aiTags.length > 0)) {
                        updateMdFrontmatter(mdPath, aiDesc, aiTags);
                        console.log(`     ✨ IA gerou para post: desc="${aiDesc || ''}", tags=[${(aiTags || []).join(', ')}]`);
                        updatedTotal++;
                    }
                }
            } else {
                console.log(`  ⚠️ Metadados faltantes no post "_posts/${file}" (desc/tags), mas GEMINI_API_KEY não está configurada.`);
            }
        }
    }

    return updatedTotal > 0;
}

async function main() {
    console.log('🔄 Atualizando arquivos _data/*.json e _posts/ a partir dos index.md e frontmatter .md...');

    const existingTags = getAllExistingTags();
    console.log(`📌 Encontradas ${existingTags.length} tag(s) existente(s) no site para referência.`);

    let updatedTotal = 0;

    for (const [jsonBase, folderName] of Object.entries(FOLDER_MAP)) {
        if (jsonBase === 'posts') {
            if (await processPostsFolder(existingTags)) updatedTotal++;
        } else if (jsonBase === 'cronicas') {
            if (await processVolumeSection(jsonBase, folderName, existingTags)) updatedTotal++;
        } else {
            if (await processFlatSection(jsonBase, folderName, existingTags)) updatedTotal++;
        }
    }

    if (updatedTotal > 0) {
        console.log(`\n🎉 Total de ${updatedTotal} arquivo(s) JSON atualizado(s) com sucesso.`);
    } else {
        console.log('✨ Todos os arquivos JSON já estão sincronizados com os index.md e .md.');
    }

    console.log('\n🔄 Sincronizando tags nos arquivos Markdown a partir do _data/*.json...');
    try {
        const syncTagsScript = path.join(__dirname, 'sync_tags_from_json.js');
        execSync(`node "${syncTagsScript}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {
        console.error('⚠️ Erro ao sincronizar tags para os arquivos Markdown:', e.message);
    }
}

main();
