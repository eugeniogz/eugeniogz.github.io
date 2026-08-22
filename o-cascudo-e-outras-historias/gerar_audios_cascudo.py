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
    """Processa todas as histórias, gera MP3s cena a cena e salva metadados de cenas."""
    os.makedirs(AUDIO_BASE_DIR, exist_ok=True)
    all_stories_scenes = {}

    for story_info in STORY_FILES:
        story_id = story_info["id"]
        file_path = os.path.join(STORIES_DIR, story_info["file"])
        
        if not os.path.exists(file_path):
            print(f"⚠️ Arquivo não encontrado: {file_path}")
            continue

        print(f"\n📖 Processando conto: {story_info['title']} ({story_id})")
        scenes = parse_story_scenes(file_path, story_info)
        print(f"   Encontradas {len(scenes)} cenas/ilustrações.")

        story_audio_dir = os.path.join(AUDIO_BASE_DIR, story_id)
        os.makedirs(story_audio_dir, exist_ok=True)

        for scene in scenes:
            scene_num = scene["scene_number"]
            mp3_filename = f"cena-{scene_num}.mp3"
            mp3_path = os.path.join(story_audio_dir, mp3_filename)
            scene["audio"] = f"audio/{story_id}/{mp3_filename}"

            print(f"   🔊 Gerando áudio limpo para Cena {scene_num}/{len(scenes)}...")
            print(f"      Texto: \"{scene['text'][:70]}...\"")
            await generate_scene_audio(scene["text"], mp3_path)

        story_scenes_file = os.path.join(story_audio_dir, "cenas.json")
        with open(story_scenes_file, 'w', encoding='utf-8') as sf:
            json.dump(scenes, sf, ensure_ascii=False, indent=2)

        all_stories_scenes[story_id] = scenes

    consolidated_path = os.path.join(DATA_DIR, "cascudo_cenas.json")
    with open(consolidated_path, 'w', encoding='utf-8') as f:
        json.dump(all_stories_scenes, f, ensure_ascii=False, indent=2)

    print(f"\n✨ Áudios limpos e pausados gerados com sucesso!\n   - {AUDIO_BASE_DIR}\n   - {consolidated_path}")

if __name__ == "__main__":
    asyncio.run(process_all_stories())
