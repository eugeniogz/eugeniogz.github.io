---
layout: app
title: Wingene VIDA APP
no_index: false
---

# Aplicativo Wingene VIDA

**Guia de uso, documentação prática e fundamentação do Método Ético-Existencial VIDA.**

O **Wingene VIDA** é um aplicativo de diário reflexivo projetado para o autoconhecimento, a prática ética e o aprimoramento pessoal contínuo. Construído sobre os quatro eixos do Método VIDA (**Valores, Imperfeições, Decisões e Atenção**), o app transforma as experiências cotidianas em um caminho estruturado de consciência e evolução humana.

> Para a apresentação visual resumida, vitrine do aplicativo e links diretos para instalação, acesse a [Landing Page oficial do Wingene VIDA](https://blog.wingene.com.br/wingene-vida-app/).

---

## Ecossistema Multiplataforma: App Móvel e Web PWA

O Wingene VIDA opera em duas frentes complementares que compartilham a mesma base de dados criptografada no seu Google Drive pessoal:

| Recurso / Plataforma | Aplicativo Móvel (Android / iOS) | Web App PWA (`wingene.com.br/wingene.vida`) |
| :--- | :---: | :---: |
| **Objetivo Principal** | Registros diários dinâmicos, rotina e notificações | Redação expandida no computador e revisão ampla |
| **Visualização e Edição de Registros** | Sim | Sim |
| **Classificação nos Pilares VIDA** | Sim | Sim |
| **Gestão de Propósitos e Metas** | Sim | Sim |
| **Geração de Análise por IA (Gemini)** | **Sim (Exclusivo)** | *Não (somente leitura dos insights existentes)* |
| **Armazenamento e Criptografia Local** | Chave derivada localmente (E2EE) | Chave derivada localmente (E2EE) |
| **Sincronização Nuvem** | Google Drive pessoal (pasta oculta) | Google Drive pessoal (pasta oculta) |
| **Bloqueio de Segurança** | Biometria / PIN do dispositivo | Senha mestra da sessão |

* **[Acessar o Web App (PWA)](https://wingene.com.br/wingene.vida)**: Não requer instalação em lojas; funciona direto no navegador do computador, tablet ou celular.
* **Aplicativos Móveis**: Disponíveis no [Google Play](https://play.google.com/store/apps/details?id=br.com.wingene.diario) e na [App Store](https://apps.apple.com/app/wingene-vida/id6761666105).

---

## A Jornada Prática em Cinco Etapas

Diferente de um caderno de notas convencional, o Wingene VIDA atua como um espelho reflexivo e um orientador de conduta através de um ciclo contínuo de cinco etapas:

```
[ 1. Registro Diário ] ──> [ 2. Vínculo a Propósitos ] ──> [ 3. Insights da IA ]
                                                                   │
[ 5. Resumo Mensal & Ciclos ] <── [ 4. Orientações Periódicas ] <──┘
```

### 1. Registro e Classificação das Observações
* **Anotações Cotidianas:** Registre fatos, reações, diálogos, estados anímicos e desafios sem filtro moralizador prévio ou autopunição.
* **Classificação nos Pilares:** Cada registro é categorizado em um dos eixos do método (ou classificado com assistência da IA no aplicativo móvel):
  * **V (Valores):** Princípios éticos, coerência, limites pessoais e conduta moral.
  * **I (Imperfeições):** Reconhecimento lúcido de impulsos, falhas, vícios ou reatividades a corrigir.
  * **D (Decisões):** Escolhas conscientes deliberadas diante de dilemas diários.
  * **A (Atenção):** Exercício de presença, foco no aqui-agora e percepção do entorno.
* **Análise Ético-Existencial com IA (App Móvel):** No smartphone, o Mentor da Vida (Gemini) analisa anonimamente o relato e oferece um retorno estruturado: um comentário reflexivo, uma síntese filosófica e conceitos-chave para aprendizado.

### 2. Gestão de Propósitos e Metas
* **Definição de Propósitos:** Cadastre seus propósitos essenciais e metas de curto, médio e longo prazo (ex.: cultivar paciência nas relações familiares, aprimorar disciplina intelectual, manter sobriedade emocional).
* **Vínculo de Registros:** Associe registros cotidianos a um propósito específico. Isso transforma intenções abstratas em métricas reais de consistência comportamental ao longo do tempo.

### 3. Insights Práticos e Mapeamento de Tendências
* **Ações Concretas:** Recomendações práticas e acionáveis para o dia seguinte, derivadas dos padrões identificados nas suas próprias notas.
* **Reconhecimento de Avanços:** A ferramenta evidencia progressos comportamentais sutis que a rotina costuma ofuscar.
* **Identificação de Gatilhos:** Revela recorrências de estados mentais, horários ou situações que provocam reações indesejadas.

### 4. Orientações Periódicas
* **Consolidação de Destaques:** Síntese periódica apontando congruência ética e decisões construtivas.
* **Alertas Construtivos:** Chamados de atenção compassivos sobre áreas de imperfeição que continuam exigindo cuidado e vigilância atencional.

### 5. Resumo Mensal Consolidador
* **Fechamento de Ciclo:** Ao término de cada mês, o sistema consolida o balanço de registros, tendências e evolução dos propósitos.
* **Renovação de Compromissos:** Uma base sólida para calibrar prioridades e iniciar o mês seguinte com clareza de direção.

---

## Ferramentas Visuais e Operacionais

* **Radar VIDA:** Gráfico radial demonstrando o equilíbrio da sua prática entre Valores, Imperfeições, Decisões e Atenção.
* **Mapa de Calor (Heat Map):** Visualização intuitiva da constância e intensidade de registros ao longo do ano.
* **Modo Offline First:** O aplicativo é 100% autônomo. Você pode registrar suas reflexões em modo avião ou sem sinal de rede; a sincronização ocorre silenciosamente ao restabelecer a conexão.
* **Camada de Autenticação Segura:** Suporte a bloqueio rápido por biometria (impressão digital/Face ID) ou PIN nos dispositivos móveis.

---

## Arquitetura de Privacidade e Criptografia (Zero-Knowledge)

A privacidade no Wingene VIDA não é uma promessa contratual, mas uma garantia criptográfica:

1. **Criptografia Simétrica Forte (AES-256):** Todos os registros são criptografados e compactados localmente antes de qualquer envio. A chave de cifragem é gerada a partir da sua senha mestre — ela jamais é transmitida ou gravada em servidores externos.
2. **Armazenamento no seu Google Drive Pessoal:** Os arquivos criptografados residem em uma pasta oculta reservada (`appDataFolder`) da sua própria conta Google. Nem a equipe Wingene nem terceiros conseguem ler, baixar ou descriptografar seus registros.
3. **Uso Anônimo de IA nos Dispositivos Móveis:** As requisições de análise de texto ao Gemini são pontuais, efêmeras e estritamente anônimas, operando sob contratos de API que proíbem o uso de dados de usuários para treinamento de modelos de inteligência artificial.
4. **Política de Segurança no PWA:** Para proteger suas credenciais e manter total segurança de custos e dados, o Web App funciona em modo somente-leitura para a geração de novos insights de IA, assegurando que chamadas sensíveis de API permaneçam protegidas nos aplicativos móveis.

---

## O Método Ético-Existencial VIDA

O método foi formulado no projeto Wingene como uma disciplina diária de construção do caráter e realização da vida autêntica (*eudaimonia*):

* **V — Valores:** A bússola. Quais princípios inegociáveis sustentam suas escolhas?
* **I — Imperfeições:** O espelho da verdade. Reconhecer fraquezas sem culpa paralisante para permitir a correção de rota.
* **D — Decisões:** O movimento. A transição da intenção teórica para o ato real no mundo.
* **A — Atenção:** O solo onde tudo germina. Presença atenta consigo, com os outros e com a teia universal da vida.

Para aprofundar os fundamentos filosóficos, leia o ensaio [O Método VIDA: A Wingene em Prática](https://blog.wingene.com.br/wingene/o-metodo-vida-a-wingene-em-pratica.html).

---

## Como Acessar e Começar

* **Web App (PWA):** [wingene.com.br/wingene.vida](https://wingene.com.br/wingene.vida)
* **Android:** [Google Play Store](https://play.google.com/store/apps/details?id=br.com.wingene.diario)
* **iOS:** [Apple App Store](https://apps.apple.com/app/wingene-vida/id6761666105)
* **Página de Apresentação:** [Vitrine Wingene VIDA](https://blog.wingene.com.br/wingene-vida-app/)

---

## Suporte e Contato

Dúvidas, sugestões ou relatos de experiência com o aplicativo:  
* **E-mail:** [suporte@wingene.com.br](mailto:suporte@wingene.com.br)  
* **Portais:** [wingene.com.br](https://wingene.com.br) · [blog.wingene.com.br](https://blog.wingene.com.br)

---

## Documentos Relacionados

* [Política de Privacidade do Wingene VIDA](https://blog.wingene.com.br/wingene-vida-app/politica-de-privacidade-wingene-vida.html)
* [O Método VIDA: A Wingene em Prática](https://blog.wingene.com.br/wingene/o-metodo-vida-a-wingene-em-pratica.html)
* [Manifesto Wingene](https://blog.wingene.com.br/wingene/manifesto-wingene.html)


