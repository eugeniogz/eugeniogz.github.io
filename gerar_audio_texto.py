#!/usr/bin/env python3
"""
Script Independente de Text-to-Speech (TTS) com IA Neural (Edge-TTS).
Converte arquivos de texto (.txt, .md) ou texto direto em arquivos de áudio .mp3 de alta qualidade.
Suporta vozes neurais masculinas e femininas em português (pt-BR) com cadência ajustável.
"""

import os
import sys
import re
import argparse
import asyncio

# Impede a criação de pastas __pycache__ e arquivos .pyc
sys.dont_write_bytecode = True

try:
    import edge_tts
except ImportError:
    print("❌ Erro: O pacote 'edge-tts' não está instalado.")
    print("Para instalar, execute: pip install edge-tts")
    sys.exit(1)

# Vozes disponíveis para Português do Brasil (pt-BR)
VOICES = {
    "feminina": "pt-BR-FranciscaNeural",
    "francisca": "pt-BR-FranciscaNeural",
    "thalita": "pt-BR-ThalitaMultilingualNeural",
    "masculina": "pt-BR-AntonioNeural",
    "antonio": "pt-BR-AntonioNeural",
}

DEFAULT_FEMALE_VOICE = "pt-BR-FranciscaNeural"
DEFAULT_MALE_VOICE = "pt-BR-AntonioNeural"


def clean_text(text: str) -> str:
    """Remove marcações HTML, tags XML, links markdown e formatações indesejadas."""
    # Remove Front Matter YAML se for um arquivo Markdown do Jekyll
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            text = parts[2]

    # Remove qualquer tag HTML/XML como <img...>, <speak>, <div>, etc.
    text = re.sub(r"<[^>]+>", " ", text)

    # Remove links markdown [texto](url) -> texto
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)

    # Remove cabeçalhos markdown excessivos ou símbolos
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

    # Remove entidades comuns
    text = text.replace("&lt;&lt;", "").replace("&gt;&gt;", "")
    text = text.replace("&amp;", "&").replace("&quot;", '"')

    # Normaliza múltiplos espaços
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def format_speech_text(text: str) -> str:
    """
    Formata o texto puro com pontuação natural para criar pausas mais longas e respiração.
    Adiciona um respiro suave no final para evitar que qualquer palavra seja cortada pelo buffer.
    """
    t = clean_text(text)

    # 1. Ajusta travessões de início de fala para terem quebra de parágrafo
    t = re.sub(r"(^|[.?!:])\s*—\s*", r"\1\n\n— ", t)

    # 2. Assegura espaço e pontuação fluida
    t = re.sub(r",\s*", ", ", t)
    t = re.sub(r";\s*", "; ", t)
    t = re.sub(r":\s*", ":\n\n", t)

    # 3. Quebras de linha entre frases para respiração
    t = re.sub(r"([.?!])\s+", r"\1\n\n", t)

    # 4. Garante pontuação no final e adiciona respiro respiratório para não cortar o áudio
    t = t.strip()
    if not t.endswith((".", "!", "?", "…", "...")):
        t += "."
    t += "\n\n..."

    return t


def resolve_voice(voice_input: str) -> str:
    """Resolve a voz escolhida a partir do nome amigável ou identificador completo."""
    if not voice_input:
        return DEFAULT_FEMALE_VOICE

    key = voice_input.strip().lower()
    if key in ("f", "fem", "feminina", "mulher", "female"):
        return DEFAULT_FEMALE_VOICE
    if key in ("m", "masc", "masculina", "homem", "male"):
        return DEFAULT_MALE_VOICE
    if key in VOICES:
        return VOICES[key]
    if "neural" in key:
        return voice_input.strip()

    return DEFAULT_FEMALE_VOICE


async def convert_text_to_mp3(text: str, output_path: str, voice: str, rate: str = "-5%"):
    """Gera o arquivo de áudio MP3 utilizando a API Edge-TTS."""
    spoken_text = format_speech_text(text)
    
    if not spoken_text.replace(".", "").strip():
        raise ValueError("O texto para conversão está vazio após a limpeza.")

    output_dir = os.path.dirname(os.path.abspath(output_path))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    communicate = edge_tts.Communicate(spoken_text, voice, rate=rate)
    await communicate.save(output_path)


def print_banner():
    """Exibe o cabeçalho informativo com aviso sobre contos do Cascudo."""
    print("=" * 75)
    print("🎙️  GERADOR DE ÁUDIO MP3 (Texto para Fala - Vozes Neurais)")
    print("💡 Para gerar áudios das histórias da pasta 'O cascudo', use gerar_audios_cascudo.py")
    print("=" * 75)


def interactive_prompt():
    """Modo interativo caso o script seja executado sem argumentos."""
    print_banner()

    # 1. Obter arquivo ou texto
    file_path = input("\n📄 Digite o caminho do arquivo de texto (.txt ou .md): ").strip()
    file_path = file_path.strip("'\"")

    if not file_path or not os.path.exists(file_path):
        print(f"❌ Arquivo não encontrado: '{file_path}'")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        text_content = f.read()

    # 2. Escolha de voz
    print("\n🗣️  Escolha o tipo de voz:")
    print("   [1] Feminina (Francisca - pt-BR) [Padrão]")
    print("   [2] Masculina (Antônio - pt-BR)")
    print("   [3] Feminina Alternativa (Thalita - pt-BR)")
    choice = input("Opção (1/2/3) [1]: ").strip()

    if choice == "2":
        voice = DEFAULT_MALE_VOICE
        voice_label = "Masculina (Antônio)"
    elif choice == "3":
        voice = "pt-BR-ThalitaMultilingualNeural"
        voice_label = "Feminina (Thalita)"
    else:
        voice = DEFAULT_FEMALE_VOICE
        voice_label = "Feminina (Francisca)"

    # 3. Velocidade/Cadência
    print("\n⚡ Velocidade da fala (Cadência):")
    print("   [1] Normal (0%)")
    print("   [2] Narrativa Suave (-5%) [Padrão]")
    print("   [3] Lenta / Contação de Histórias (-12%)")
    rate_choice = input("Opção (1/2/3) [2]: ").strip()

    if rate_choice == "1":
        rate = "0%"
    elif rate_choice == "3":
        rate = "-12%"
    else:
        rate = "-5%"

    # 4. Arquivo de saída
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    default_output = os.path.join(os.path.dirname(file_path) or ".", f"{base_name}.mp3")
    output_input = input(f"\n💾 Arquivo de saída [.mp3] (Padrão: {default_output}): ").strip()
    output_path = output_input if output_input else default_output

    return text_content, output_path, voice, voice_label, rate


def main():
    parser = argparse.ArgumentParser(
        description="Converte arquivos de texto (.txt, .md) ou texto direto em áudio MP3 com vozes neurais pt-BR.\n💡 Para gerar textos das histórias da pasta 'O cascudo', use gerar_audios_cascudo.py",
        formatter_class=argparse.RawTextHelpFormatter
    )

    parser.add_argument(
        "arquivo",
        nargs="?",
        default=None,
        help="Caminho para o arquivo de texto de entrada (.txt, .md)."
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Caminho do arquivo MP3 de saída (Ex: audio.mp3). Por padrão salva com o mesmo nome do texto."
    )
    parser.add_argument(
        "-v", "--voice",
        choices=["feminina", "f", "masculina", "m", "francisca", "antonio", "thalita"],
        default="feminina",
        help="Tipo de voz: 'feminina'/'f' (Francisca) ou 'masculina'/'m' (Antônio). Padrão: feminina."
    )
    parser.add_argument(
        "-r", "--rate",
        default="-5%",
        help="Velocidade da fala (Ex: '-10%%', '0%%', '+10%%'). Padrão: '-5%%'."
    )
    parser.add_argument(
        "-t", "--text",
        default=None,
        help="Texto direto para conversão em vez de ler de um arquivo."
    )

    args = parser.parse_args()

    # Se nenhum argumento foi passado, entra no modo interativo
    if len(sys.argv) == 1 and sys.stdin.isatty():
        text_content, output_path, voice, voice_label, rate = interactive_prompt()
    else:
        print_banner()
        if args.text:
            text_content = args.text
            output_path = args.output or "audio.mp3"
        elif args.arquivo:
            if not os.path.exists(args.arquivo):
                print(f"❌ Erro: Arquivo '{args.arquivo}' não encontrado.")
                sys.exit(1)
            with open(args.arquivo, "r", encoding="utf-8") as f:
                text_content = f.read()
            if not args.output:
                base_name = os.path.splitext(args.arquivo)[0]
                output_path = f"{base_name}.mp3"
            else:
                output_path = args.output
        else:
            parser.print_help()
            sys.exit(1)

        voice = resolve_voice(args.voice)
        voice_label = "Masculina (Antônio)" if "Antonio" in voice else "Feminina (Francisca)"
        rate = args.rate

    print(f"\n🔊 Processando áudio:")
    print(f"   • Voz selecionada: {voice_label} [{voice}]")
    print(f"   • Velocidade: {rate}")
    print(f"   • Arquivo de saída: {output_path}")

    try:
        asyncio.run(convert_text_to_mp3(text_content, output_path, voice, rate))
        file_size_kb = os.path.getsize(output_path) / 1024
        print(f"\n✅ Áudio gerado com sucesso!")
        print(f"   📁 Local: {os.path.abspath(output_path)}")
        print(f"   📊 Tamanho: {file_size_kb:.1f} KB\n")
    except Exception as e:
        print(f"\n❌ Falha ao gerar áudio: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
