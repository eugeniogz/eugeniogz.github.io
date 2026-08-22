#!/usr/bin/env python3
"""
Script de Geração de Áudio com IA Neural para O Cascudo e Outras Histórias.
Gera arquivos .mp3 cena a cena utilizando as vozes neurais da Microsoft (Edge-TTS).
Com cadência mais lenta e pausas naturais em cada pontuação.
"""

import os
import sys
import re
import json
import asyncio
import subprocess

# Impede a criação de pastas __pycache__ e arquivos .pyc
sys.dont_write_bytecode = True

import edge_tts

STORIES_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.abspath(os.path.join(STORIES_DIR, ".."))
AUDIO_BASE_DIR = os.path.join(STORIES_DIR, "audio")
DATA_DIR = os.path.join(SITE_ROOT, "_data")

# Voz recomendada: Francisca (calma, afetuosa, narrativa)
VOICE = "pt-BR-FranciscaNeural" 
RATE = "-13%"  # Cadência mais lenta, ideal para contação de histórias infantis

STORY_FILES = [
    {"id": "rio-japao", "file": "rio-japao.md", "title": "Rio Japão"},
    {"id": "o-cascudo", "file": "o-cascudo.md", "title": "O Cascudo"},
    {"id": "o-relogio-de-bolso", "file": "o-relogio-de-bolso.md", "title": "O relógio de bolso"},
    {"id": "o-barquinho-amarelo", "file": "o-barquinho-amarelo.md", "title": "O Barquinho Amarelo"},
    {"id": "um-sanduiche-especial", "file": "um-sanduiche-especial.md", "title": "Um sanduíche especial"},
    {"id": "aventura-de-bicicleta", "file": "aventura-de-bicicleta.md", "title": "Aventura de bicicleta"},
    {"id": "o-clube-dos-pinguins", "file": "o-clube-dos-pinguins.md", "title": "O clube dos pinguins"}
]

def clean_text(text: str) -> str:
    """Remove marcações HTML, tags XML, links markdown e formatações extras."""
    # Remove qualquer tag HTML/XML como <img...>, <speak>, <break>, <div>, etc.
    text = re.sub(r'<[^>]+>', ' ', text)
    # Remove links markdown [texto](url) -> texto
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = text.replace('&lt;&lt;', '').replace('&gt;&gt;', '')
    # Normaliza múltiplos espaços
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def format_speech_text(text: str) -> str:
    """
    Formata o texto puro com pontuação natural para criar pausas mais longas e respiração.
    Adiciona um respiro suave no final para evitar que qualquer palavra seja cortada pelo buffer.
    """
    t = clean_text(text)
    
    # 1. Ajusta travessões de início de fala para terem quebra de parágrafo
    t = re.sub(r'(^|[.?!:])\s*—\s*', r'\1\n\n— ', t)
    
    # 2. Assegura espaço e pontuação fluida
    t = re.sub(r',\s*', ', ', t)
    t = re.sub(r';\s*', '; ', t)
    t = re.sub(r':\s*', ':\n\n', t)
    
    # 3. Quebras de linha entre frases para respiração
    t = re.sub(r'([.?!])\s+', r'\1\n\n', t)
    
    # 4. Garante pontuação no final e adiciona respiro respiratório para não cortar o final do áudio
    t = t.strip()
    if not t.endswith(('.', '!', '?', '…', '...')):
        t += '.'
    t += '\n\n...'
    
    return t

def has_uncommitted_git_changes(file_path: str) -> bool:
    """Verifica se o arquivo possui alterações não commitadas no repositório git."""
    if not os.path.exists(file_path):
        return True
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain", file_path],
            capture_output=True,
            text=True,
            cwd=SITE_ROOT
        )
        return bool(res.stdout.strip())
    except Exception:
        return False

def parse_story_scenes(file_path: str, story_info: dict):
    """
    Analisa o markdown e extrai cenas divididas por ilustrações com seus respectivos textos.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Ignora Front Matter YAML
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            body = parts[2]
        else:
            body = content
    else:
        body = content

    lines = body.split('\n')
    filtered_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('### [') or stripped.startswith('## '):
            continue
        if stripped.startswith('---') or stripped.startswith('<div style="display: flex;'):
            break
        if '&lt;&lt;' in stripped or '&gt;&gt;' in stripped:
            break
        filtered_lines.append(line)

    body_text = '\n'.join(filtered_lines)

    img_pattern = re.compile(r'<img\s+[^>]*src=["\']([^"\']+)["\'][^>]*alt=["\']([^"\']*)["\'][^>]*>', re.IGNORECASE)
    splits = img_pattern.split(body_text)
    
    scenes = []
    
    if len(splits) > 1:
        pre_text = clean_text(splits[0])
        
        idx = 1
        scene_num = 1
        while idx < len(splits):
            src = splits[idx].strip()
            alt = splits[idx+1].strip()
            raw_chunk = splits[idx+2] if (idx+2) < len(splits) else ""
            
            chunk_text = clean_text(raw_chunk)
            
            if scene_num == 1 and pre_text:
                full_chunk = f"{pre_text} {chunk_text}".strip()
            else:
                full_chunk = chunk_text
                
            if src.startswith('./'):
                src = src[2:]

            if full_chunk:
                scenes.append({
                    "scene_number": scene_num,
                    "image": src,
                    "alt": alt,
                    "text": full_chunk
                })
                scene_num += 1
            idx += 3
    else:
        clean_all = clean_text(body_text)
        if clean_all:
            scenes.append({
                "scene_number": 1,
                "image": f"figuras/{story_info['id']}/capa.png",
                "alt": story_info['title'],
                "text": clean_all
            })

    return scenes

async def generate_scene_audio(text: str, output_mp3: str, voice: str = VOICE, rate: str = RATE):
    """Gera um arquivo de áudio MP3 com texto 100% puro e cadência suave."""
    os.makedirs(os.path.dirname(output_mp3), exist_ok=True)
    spoken_text = format_speech_text(text)
    communicate = edge_tts.Communicate(spoken_text, voice, rate=rate)
    await communicate.save(output_mp3)

async def process_all_stories():
    """
    Processa todas as histórias:
    - Carrega de cenas.json se existir (respeitando customizações manuais) ou gera a partir do markdown.
    - Só gera áudio MP3 se o arquivo não existir / estiver vazio OU se cenas.json tiver alterações não commitadas.
    - Atualiza os arquivos cenas.json locais e o consolidado em _data/cascudo_cenas.json.
    """
    os.makedirs(AUDIO_BASE_DIR, exist_ok=True)
    all_stories_scenes = {}
    total_generated = 0
    total_skipped = 0

    for story_info in STORY_FILES:
        story_id = story_info["id"]
        file_path = os.path.join(STORIES_DIR, story_info["file"])
        story_audio_dir = os.path.join(AUDIO_BASE_DIR, story_id)
        os.makedirs(story_audio_dir, exist_ok=True)
        story_scenes_file = os.path.join(story_audio_dir, "cenas.json")

        # 1. Carrega cenas existentes ou analisa markdown
        if os.path.exists(story_scenes_file):
            try:
                with open(story_scenes_file, 'r', encoding='utf-8') as sf:
                    scenes = json.load(sf)
            except Exception:
                scenes = []
            if not scenes and os.path.exists(file_path):
                scenes = parse_story_scenes(file_path, story_info)
        elif os.path.exists(file_path):
            scenes = parse_story_scenes(file_path, story_info)
        else:
            print(f"⚠️ Arquivo não encontrado: {file_path}")
            continue

        # 2. Verifica se cenas.json possui alterações não commitadas no git
        is_scenes_uncommitted = has_uncommitted_git_changes(story_scenes_file)
        
        status_tag = " [Alterações não commitadas em cenas.json]" if is_scenes_uncommitted else ""
        print(f"\n📖 Conto: {story_info['title']} ({story_id}) - {len(scenes)} cenas{status_tag}")

        for scene in scenes:
            scene_num = scene["scene_number"]
            mp3_filename = f"cena-{scene_num}.mp3"
            mp3_path = os.path.join(story_audio_dir, mp3_filename)
            scene["audio"] = f"audio/{story_id}/{mp3_filename}"

            mp3_exists = os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0

            # Gera áudio se o arquivo MP3 não existir/estiver vazio OU se cenas.json foi alterado
            if not mp3_exists or is_scenes_uncommitted:
                reason = "novo/ausente" if not mp3_exists else "cenas.json modificado"
                print(f"   🔊 Gerando áudio ({reason}) para Cena {scene_num}/{len(scenes)}...")
                print(f"      Texto: \"{scene['text'][:70]}...\"")
                await generate_scene_audio(scene["text"], mp3_path)
                total_generated += 1
            else:
                print(f"   ⚡ Cena {scene_num}/{len(scenes)}: Áudio já existe (pulado).")
                total_skipped += 1

        # Salva o arquivo de cenas local atualizado
        with open(story_scenes_file, 'w', encoding='utf-8') as sf:
            json.dump(scenes, sf, ensure_ascii=False, indent=2)

        all_stories_scenes[story_id] = scenes

    consolidated_path = os.path.join(DATA_DIR, "cascudo_cenas.json")
    with open(consolidated_path, 'w', encoding='utf-8') as f:
        json.dump(all_stories_scenes, f, ensure_ascii=False, indent=2)

    print(f"\n✨ Processamento concluído!")
    print(f"   - Áudios gerados/atualizados: {total_generated}")
    print(f"   - Áudios mantidos (reaproveitados): {total_skipped}")
    print(f"   - Metadados consolidados salvos em: {consolidated_path}")

if __name__ == "__main__":
    asyncio.run(process_all_stories())
