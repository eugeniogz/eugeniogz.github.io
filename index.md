---
layout: default
title: "index"
--- 

<script>

document.addEventListener('DOMContentLoaded', (event) => {

const linkElement = document.getElementById('filosofia');

const blockElement = document.getElementById('filosofia-block');

if (linkElement && blockElement) {

linkElement.addEventListener('click', (e) => {

e.preventDefault();

// Lógica de alternância (TOGGLE)

if (blockElement.style.display === 'none') {

blockElement.style.display = 'block';

} else {

blockElement.style.display = 'none';

}

});

}

});

</script>

### 📓 [A Arte do cotidiano](./Crônicas)

Crônicas que transformam os pequenos momentos em reflexões profundas

### ✒️ [Palavra Poética](./Poemas e Aforismos)

Poesias e aforismos que capturam a essência dos sentimentos

### 🌆 [Janela para o Mundo](./Reflexões)

Reflexões sociais e críticas sobre a vida moderna

### 📚 [Histórias para crescer](./Contos infantis)

Contos infantis que ensinam valores importantes

<h3>

💭<a href="#" id="filosofia">Fundamentos filosóficos</a>

</h3>

Ensaios sobre felicidade, consciência e nosso lugar no universo

<div id="filosofia-block" style="display: none;" markdown="1">

#### 🧠 [Consciência](./Filosofia/Consciência)

#### 🌞 [Felicidade](./Filosofia/Felicidade)

#### ❤️ [Amor](./Filosofia/Amor)

#### 🌿 [Natureza](./Filosofia/Natureza)

</div>

### 🔄 [Nexos Conceituais](./Conceitos)

Textos que conectam e unificam os conceitos principais