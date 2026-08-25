# As 5 imagens no filtro de IA

## Como fazer

1. Abra **[aistudio.google.com](https://aistudio.google.com)** e faça login com o Gmail. É grátis.
2. No seletor de modelo, escolha um modelo **de imagem** (o Gemini de geração/edição
   de imagem — o nome muda de tempos em tempos, é o que aparece com o rótulo
   *image* na lista).
3. Anexe a foto no clipe de papel, cole um dos prompts abaixo, envie.
4. Baixe o resultado, renomeie com o prefixo **`IA_`** e suba na mesma pasta do Drive.

O prefixo `IA_` é o que faz a página mostrar o selo *"processada com IA"* em cima da
imagem. É automático, você não precisa configurar nada além de nomear o arquivo:

```
IA_01-fachada.jpg
IA_02-turma.jpg
```

> **Escolha bem as 5 fotos.** Funcionam melhor: fotos com um assunto claro no centro,
> boa iluminação, sem muita gente pequena ao fundo. Rostos em close costumam sair
> distorcidos — evite.

---

## Os prompts

Cinco estilos diferentes rendem mais do que cinco variações do mesmo filtro — mostra
que você testou o recurso, não que apertou um botão cinco vezes.

**1 — Aquarela**
```
Transforme esta fotografia em uma pintura em aquarela sobre papel texturizado.
Pinceladas soltas, cores translúcidas que se misturam nas bordas, branco do papel
aparecendo nas áreas claras. Mantenha a composição e os elementos principais
exatamente onde estão. Sem texto na imagem.
```

**2 — Restauração / colorização**
```
Restaure e melhore esta fotografia: corrija a iluminação, recupere detalhes nas
sombras e nas áreas estouradas, aumente a nitidez e remova ruído. Mantenha as cores
naturais e realistas, sem estilização. O resultado deve parecer a mesma foto tirada
por uma câmera melhor.
```

**3 — Ilustração editorial**
```
Converta esta foto em uma ilustração vetorial de estilo editorial: formas
geométricas simplificadas, paleta reduzida a 5 cores, contornos limpos, sombras
chapadas sem gradiente. Preserve a silhueta e a composição originais.
```

**4 — Hora dourada**
```
Reilumine esta cena como se tivesse sido fotografada na hora dourada, pouco antes
do pôr do sol: luz lateral quente e rasante, sombras longas e suaves, brilho âmbar
nas bordas dos objetos. Não mude a composição, os objetos nem as pessoas.
```

**5 — Blueprint técnico**
```
Converta esta imagem em um desenho técnico estilo blueprint: fundo azul-escuro,
linhas brancas finas, apenas os contornos e as estruturas principais, com uma
malha quadriculada sutil ao fundo. Aparência de planta arquitetônica.
```

---

## Se quiser fazer um antes/depois

É o que mais funciona numa apresentação: em vez de só a versão filtrada, mostre as
duas metades lado a lado.

No Windows dá para fazer em 1 minuto por imagem no **Paint**: crie uma tela do dobro
da largura, cole a original à esquerda e a versão de IA à direita, salve como
`IA_01-antes-depois.jpg`.

Como as imagens ficam com o dobro da largura, elas entram no slideshow com bastante
faixa preta em cima e embaixo. Se quiser que só essas fiquem maiores, não vale a pena
mexer — o `object-fit: contain` já garante que nada é cortado.

---

## Uma coisa que vale dizer na apresentação

O modelo **não "melhora" a foto**: ele gera uma imagem nova condicionada na sua. Nos
prompts 1, 3 e 5 isso é o objetivo. No 2 e no 4 é uma armadilha — compare o resultado
com o original e confira se algum detalhe real (um rosto, um texto numa placa, um
número) foi inventado. Se foi, ou você troca a foto ou menciona isso: é exatamente o
tipo de observação que costuma valer nota.
