---
layout: default
title: "Sobre o autor"
reading_time: 1
semantic_order: 0
no_index: true
--- 

## Sobre o autor

<style>
  .author-card {
    display: flex;
    flex-direction: row;
    gap: 2.5rem;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 20px;
    padding: 2.5rem;
    margin: 2rem 0;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.03);
    position: relative;
    overflow: hidden;
    flex-wrap: wrap;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .author-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08) !important;
    border-color: var(--border-focus);
  }
  .author-avatar-container {
    flex: 0 0 180px;
    text-align: center;
  }
  .author-avatar {
    width: 180px;
    height: 180px;
    border-radius: 50%;
    border: 4px solid var(--color-values-primary);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  .author-avatar:hover {
    transform: scale(1.05);
  }
  .author-info {
    flex: 1;
    min-width: 280px;
  }
  .author-name {
    margin-top: 0 !important;
    margin-bottom: 0.6rem !important;
    font-family: 'Outfit', sans-serif !important;
    font-size: 2rem !important;
    color: var(--color-values-primary) !important;
    font-weight: 700;
  }
  .author-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 1.2rem;
  }
  .author-badge {
    font-family: 'Outfit', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .badge-red {
    background: rgba(176, 16, 16, 0.08);
    color: var(--color-values-primary);
    border: 1px solid rgba(176, 16, 16, 0.15);
  }
  .badge-blue {
    background: rgba(18, 62, 156, 0.08);
    color: var(--color-attention-primary);
    border: 1px solid rgba(18, 62, 156, 0.15);
  }
  .badge-green {
    background: rgba(14, 125, 15, 0.08);
    color: var(--color-decisions-primary);
    border: 1px solid rgba(14, 125, 15, 0.15);
  }
  .author-bio {
    font-family: 'Lora', Georgia, serif;
    font-size: 1.1rem;
    line-height: 1.8;
    color: var(--text-main);
    margin-bottom: 1.5rem;
  }
  .author-contact-area {
    display: flex;
    gap: 1.2rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .author-email {
    font-family: 'Outfit', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-muted);
  }
</style>

<div class="author-card">
  <div class="author-avatar-container">
    <img src="/avatar.png" alt="José Eugênio, 2024-07-15" class="author-avatar"/>
  </div>
  <div class="author-info">
    <h3 class="author-name">José Eugênio</h3>
    
    <div class="author-badges">
      <span class="author-badge badge-red">Engenheiro Eletricista</span>
      <span class="author-badge badge-blue">Mestre em C. da Computação</span>
      <span class="author-badge badge-green">Doutor em Gestão do Conhecimento</span>
    </div>
    
    <div class="author-bio">
      José Eugênio é engenheiro eletricista, mestre em Ciência da Computação e doutor em Gestão e Organização do Conhecimento. Analista de sistemas desde 1990, leciona computação e robótica básica em uma escola infantil. No tempo livre, além de curtir momentos com a família e amigos, estuda e escreve. Mantém esse site desde 2025 com foco na <a href="/manifesto-wingene.html">Wingene</a>, uma filosofia naturalista que descreve o caminho para a eudaimonia — que não deve ser somente pessoal, mas <a href="/ipes-e-tijolos/eudaimonia-social.html">social</a>.
    </div>
    
    <div class="author-contact-area">
      <a href="mailto:eugenio@wingene.com.br" class="cta-button" style="text-decoration: none;">
        ✉ Enviar E-mail
      </a>
      <span class="author-email">eugenio@wingene.com.br</span>
    </div>
  </div>
</div>

<div style="clear: both;"></div>

---

<div style="display: flex; justify-content: space-between;">
  <span></span>
  <a href="./manifesto-wingene.html">Manifesto Wingene &gt;&gt;</a>
</div>
