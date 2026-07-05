/* ==========================================================================
   WINGENE LANDING PAGE - INTERACTIVE JAVASCRIPT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Controle da Barra de Navegação no Scroll
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // 2. Interação Cruzada: Logotipo SVG e Cards do Método VIDA
    const logoContainer = document.getElementById("logoContainer");
    const vidaCards = document.querySelectorAll(".vida-card");
    
    // Elementos das estrelas no SVG
    const stars = {
        "star-valores": document.getElementById("path-valores"),
        "star-imperfeicoes": document.getElementById("path-imperfeicoes"),
        "star-decisoes": document.getElementById("path-decisoes"),
        "star-atencao": document.getElementById("path-atencao"),
        "star-atencao-bg": document.getElementById("path-atencao-bg")
    };

    // A) Passar o mouse no Card -> Destacar estrela correspondente no SVG
    vidaCards.forEach(card => {
        const starId = card.getAttribute("data-star");
        
        card.addEventListener("mouseenter", () => {
            // Adiciona classe de destaque à estrela
            if (stars[starId]) {
                stars[starId].classList.add(`highlight-${starId.replace("star-", "")}`);
                
                // Se for a estrela de Atenção, também destaca o fundo branco dela
                if (starId === "star-atencao" && stars["star-atencao-bg"]) {
                    stars["star-atencao-bg"].classList.add("highlight-atencao");
                }
            }
        });

        card.addEventListener("mouseleave", () => {
            // Remove o destaque da estrela
            if (stars[starId]) {
                stars[starId].classList.remove(`highlight-${starId.replace("star-", "")}`);
                
                if (starId === "star-atencao" && stars["star-atencao-bg"]) {
                    stars["star-atencao-bg"].classList.remove("highlight-atencao");
                }
            }
        });
    });

    // B) Passar o mouse nas estrelas do SVG -> Destacar Card correspondente
    Object.keys(stars).forEach(key => {
        const pathElement = stars[key];
        if (!pathElement) return;

        // Mapeamento inverso do ID do Path para o Card correspondente
        let cardId = "card-valores";
        if (key === "path-imperfeicoes" || key === "star-imperfeicoes") cardId = "card-imperfeicoes";
        else if (key === "path-decisoes" || key === "star-decisoes") cardId = "card-decisoes";
        else if (key === "path-atencao" || key === "path-atencao-bg" || key === "star-atencao") cardId = "card-atencao";

        const matchingCard = document.getElementById(cardId);

        pathElement.addEventListener("mouseenter", () => {
            if (matchingCard) {
                matchingCard.classList.add("active");
            }
        });

        pathElement.addEventListener("mouseleave", () => {
            if (matchingCard) {
                matchingCard.classList.remove("active");
            }
        });
    });

    // 3. Rotador de Citações (Quotes Rotator)
    const quotes = [
        "Eudaimonia: cadência do pulsar e pensar.",
        "Serena euforia: a mente transcende a mente.",
        "Solitude: árvore que sente floresta.",
        "Viver: ausência presente.",
        "Distração: atenção ao vazio.",
        "Tecer virtudes, semear atitudes.",
        "Vida breve, rotas eternas.",
        "A matéria é instrumento; a sinapse é música.",
        "Recordar: seiva que adoça a alegria.",
        "Os pilares da felicidade: Criar, Amar, Recordar e Evoluir (CARE).",
        "Viver tece tons indescritíveis."
    ];

    let currentQuoteIndex = 0;
    const quoteTextElement = document.getElementById("quote-text");
    const prevQuoteBtn = document.getElementById("prev-quote");
    const nextQuoteBtn = document.getElementById("next-quote");
    let quoteInterval;

    function showQuote(index) {
        // Efeito de fade-out
        quoteTextElement.style.opacity = "0";
        
        setTimeout(() => {
            quoteTextElement.textContent = quotes[index];
            // Efeito de fade-in
            quoteTextElement.style.opacity = "1";
        }, 400);
    }

    function nextQuote() {
        currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
        showQuote(currentQuoteIndex);
    }

    function prevQuote() {
        currentQuoteIndex = (currentQuoteIndex - 1 + quotes.length) % quotes.length;
        showQuote(currentQuoteIndex);
    }

    // Inicializar o rotador automático (a cada 7 segundos)
    function startQuoteRotation() {
        clearInterval(quoteInterval);
        quoteInterval = setInterval(nextQuote, 7000);
    }

    // Listeners dos Botões do Rotador
    nextQuoteBtn.addEventListener("click", () => {
        nextQuote();
        startQuoteRotation(); // Reinicia o cronômetro após interação manual
    });

    prevQuoteBtn.addEventListener("click", () => {
        prevQuote();
        startQuoteRotation(); // Reinicia o cronômetro após interação manual
    });

    // Início automático
    startQuoteRotation();
});
