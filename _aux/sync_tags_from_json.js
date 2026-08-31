const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, '_data');

// Mapeamento do nome base do arquivo JSON para a pasta correspondente no site
const FOLDER_MAP = {
    'wingene': 'wingene',
    'cascudo': 'o-cascudo-e-outras-historias',
    'cronicas': 'cronicas',
    'ipes': 'ipes-e-tijolos',
    'poesias': 'poesias-e-aforismos',
    'reflexoes': 'reflexoes'
};

function normalizarTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    return tag.trim();
}

function updateTagsInFrontmatter(content, tags) {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return content;

    const originalFrontmatter = frontmatterMatch[0];
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

    const newTagsLines = [];
    if (tags.length === 0) {
        newTagsLines.push('tags: []');
    } else {
        newTagsLines.push('tags:');
        for (const t of tags) {
            newTagsLines.push(`  - ${t}`);
        }
    }

    if (tagsStartIdx !== -1) {
        yamlLines.splice(tagsStartIdx, (tagsEndIdx - tagsStartIdx + 1), ...newTagsLines);
    } else {
        yamlLines.push(...newTagsLines);
    }

    const newFrontmatter = `---\n${yamlLines.join('\n')}\n---`;
    return content.replace(originalFrontmatter, newFrontmatter);
}

function collectItemsFromData(dataObj) {
    let items = [];

    if (Array.isArray(dataObj)) {
        for (const item of dataObj) {
            if (!item) continue;
            if (Array.isArray(item.stories)) {
                // Estrutura por volumes (ex: cronicas.json)
                for (const story of item.stories) {
                    if (story && story.tags) {
                        items.push(story);
                    }
                }
            } else if (item.tags) {
                items.push(item);
            }
        }
    } else if (typeof dataObj === 'object' && dataObj !== null) {
        for (const key of Object.keys(dataObj)) {
            const item = dataObj[key];
            if (item && item.tags) {
                items.push(item);
            }
        }
    }

    return items;
}

function findMdFile(jsonBaseName, item) {
    const folder = FOLDER_MAP[jsonBaseName] || jsonBaseName;
    const candidates = [];

    if (item.filename) {
        const cleanFn = item.filename.replace(/\.html$/i, '.md');
        candidates.push(path.join(ROOT_DIR, folder, cleanFn));
        candidates.push(path.join(ROOT_DIR, cleanFn));
    }

    if (item.id) {
        candidates.push(path.join(ROOT_DIR, folder, `${item.id}.md`));
        candidates.push(path.join(ROOT_DIR, `${item.id}.md`));
    }

    for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
            return cand;
        }
    }

    // Busca recursiva se não encontrou nas rotas padrão
    const searchFolder = path.join(ROOT_DIR, folder);
    if (fs.existsSync(searchFolder)) {
        const targetName = item.id ? `${item.id}.md` : null;
        if (targetName) {
            const found = findFileRecursively(searchFolder, targetName);
            if (found) return found;
        }
    }

    return null;
}

function findFileRecursively(dir, fileName) {
    try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
            const fullPath = path.join(dir, f);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                const res = findFileRecursively(fullPath, fileName);
                if (res) return res;
            } else if (f.toLowerCase() === fileName.toLowerCase()) {
                return fullPath;
            }
        }
    } catch (e) {}
    return null;
}

function main() {
    console.log('🔄 Sincronizando tags dos arquivos Markdown a partir do _data/*.json...');

    if (!fs.existsSync(DATA_DIR)) {
        console.log('⚠️ Pasta _data não encontrada.');
        return;
    }

    const files = fs.readdirSync(DATA_DIR);
    let updatedCount = 0;
    let modifiedFiles = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const jsonBaseName = file.replace(/\.json$/i, '').toLowerCase();
        const filePath = path.join(DATA_DIR, file);

        let dataObj;
        try {
            dataObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`❌ Erro ao ler JSON em ${file}:`, e.message);
            continue;
        }

        const items = collectItemsFromData(dataObj);

        for (const item of items) {
            const tags = (item.tags || []).map(normalizarTag).filter(Boolean);
            const mdFile = findMdFile(jsonBaseName, item);

            if (!mdFile) {
                continue;
            }

            const content = fs.readFileSync(mdFile, 'utf8');
            const newContent = updateTagsInFrontmatter(content, tags);

            if (content !== newContent) {
                fs.writeFileSync(mdFile, newContent, 'utf8');
                const relPath = path.relative(ROOT_DIR, mdFile);
                console.log(`  ✅ Atualizado tags em: ${relPath}`);
                updatedCount++;
                modifiedFiles.push(relPath);
            }
        }
    }

    if (updatedCount > 0) {
        console.log(`\n🎉 Total de ${updatedCount} arquivo(s) Markdown atualizado(s) com sucesso.`);
        try {
            for (const relFile of modifiedFiles) {
                execSync(`git add "${relFile}"`, { cwd: ROOT_DIR });
            }
        } catch (e) {}
    } else {
        console.log('✨ Todos os arquivos Markdown já estão sincronizados com os JSONs.');
    }
}

main();
