# Slideshow automático da pasta do Drive

Uma página que lê a pasta pública do Google Drive e passa as fotos sozinha.
**Ela reconsulta a pasta a cada 3 minutos** — então foto que alguém subir durante
a apresentação entra na rotação sem ninguém tocar em nada.

A professora recebe um link, abre, aperta **F11**. Só isso.

```
slideshow-ufms/
├── apps-script/     ROTA A — sem chave de API, sem hospedagem       ← comece por aqui
├── web/             ROTA B — link limpo, arrastar no Netlify
├── offline/         PLANO C — roda sem internet, para emergência
├── src/             o código-fonte (edite aqui e rode build.sh)
├── build.sh         remonta as 3 versões a partir de src/
└── prompts-ia.md    os prompts para as 5 imagens do AI Studio
```

---

## O ID da pasta já está preenchido

```
1YO_R4YttUszffoXcyW4gjmNdKIbIERkb
```

Já está no `apps-script/Codigo.gs` (linha 7) e no `web/config.js`. Só troque se a
pasta mudar. O ID é o pedaço entre `/folders/` e o `?` no link do Drive.

**Confira o compartilhamento:** botão direito na pasta → Compartilhar → Acesso geral
deve estar em **"Qualquer pessoa com o link"** / Leitor. Na Rota A o Apps Script lê a
pasta com a sua conta, mas as *imagens* ainda são servidas direto pelo Google — então
se a pasta for restrita, aparece tela preta.

### Subpastas

As duas rotas **varrem as subpastas recursivamente**, e as subpastas delas, até 8
níveis. Uma foto que esteja em duas pastas ao mesmo tempo aparece uma vez só.
PDF, vídeo e atalho do Drive são ignorados — só entra o que for imagem de verdade.

Por padrão tudo vira uma fila única em ordem de upload. Se as subpastas forem temáticas
(`Dia 1`, `Dia 2`…) e você quiser as fotos agrupadas por pasta, troque para
`var ORDEM = 'pasta';` no `Codigo.gs`.

---

## ROTA A — Google Apps Script

Não precisa de chave de API, não precisa hospedar nada, não precisa instalar nada.
Quem lê a pasta é a sua própria conta Google.

1. Abra **[script.google.com](https://script.google.com)** → **Novo projeto**.
   Use uma conta **@gmail pessoal**, não a institucional (contas de universidade
   costumam ter o deploy público bloqueado pelo admin).

2. Apague o conteúdo do `Código.gs` que veio e cole o de `apps-script/Codigo.gs`.
   O ID da pasta já está preenchido — não precisa mexer em nada.

3. No menu de arquivos (o `+` à esquerda) → **HTML** → dê o nome **`index`**
   (exatamente isso, sem `.html`). Apague o conteúdo padrão e cole o de
   `apps-script/index.html`.

4. **Teste antes de publicar:** no seletor de função lá em cima, escolha `testar`
   e clique em **Executar**. Vai pedir autorização — aceite (na tela de aviso,
   *Avançado → Acessar projeto sem título*). O "Registro de execução" mostra o nome
   da pasta, o total de imagens, **quantas em cada subpasta**, quantas já estão com
   o prefixo `IA_` e quanto tempo a varredura levou.

5. **Implantar** → **Nova implantação** → engrenagem → **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**

   Clique em Implantar e copie a **URL do app da Web** (`.../exec`). Esse é o link.

> **Se o passo 5 não deixar escolher "Qualquer pessoa"**, sua conta está bloqueada
> pelo Workspace. Vá para a Rota B.
>
> **Editou o código depois?** Precisa de *Implantar → Gerenciar implantações → lápis
> → Versão: Nova versão*. Senão a URL continua servindo o código antigo.

---

## ROTA B — Netlify Drop

Link mais bonito (`slideshow-turma.netlify.app`), carregamento instantâneo e **sem a
faixa branca** que o Apps Script põe no topo.

Tem dois modos. Escolha um em `web/config.js`.

### Modo 1 — usando o Apps Script como fonte (sem chave de API) ✅

Se você já publicou a Rota A, é só apontar para ela:

```js
endpointAppsScript: 'https://script.google.com/macros/s/AKfy.../exec',
```

A página passa a pegar a lista do seu Apps Script em vez da API do Drive. Não precisa
de chave nenhuma, não precisa do Google Cloud, e o `Codigo.gs` já está preparado —
quando ele recebe `?callback=`, devolve só a lista em vez da página.

Pule direto para o passo "Configurar e publicar" abaixo.

### Modo 2 — direto na API do Drive

Só se você não quiser depender do Apps Script. Aí precisa da chave.

#### 1. Chave de API do Google

1. **[console.cloud.google.com](https://console.cloud.google.com)** → crie um projeto qualquer.
2. **APIs e Serviços → Biblioteca** → procure **Google Drive API** → **Ativar**.
3. **APIs e Serviços → Credenciais** → **Criar credenciais → Chave de API**. Copie.
4. Clique na chave para editar e deixe:
   - **Restrições de aplicativo:** Sites → adicione `https://SEU-SITE.netlify.app/*`
     (volte e preencha depois de saber a URL);
   - **Restrições de API:** Restringir chave → marque só **Google Drive API**.

   Assim, mesmo com a chave visível no código, ela só serve para ler o Drive a
   partir do seu site. É leitura de uma pasta que já é pública.

### Configurar e publicar

1. Abra `web/config.js` e preencha **um** dos dois modos acima.
2. Vá em **[app.netlify.com/drop](https://app.netlify.com/drop)** e **arraste a pasta
   `web` inteira** para a página. Em segundos ele devolve uma URL.
3. Crie uma conta grátis (o botão aparece na hora) para o site não expirar em 24h,
   e em *Site configuration → Change site name* troque para algo legível.
4. Volte no Google Cloud e cole a URL final na restrição da chave.

Para atualizar depois: *Deploys → arraste a pasta de novo*.

### Já publicado no GitHub Pages

O site está no ar em **https://davigaborim.github.io/slideshow-drive/**

O repositório é `davigaborim/slideshow-drive`. A branch `main` guarda o projeto
inteiro; a branch `gh-pages` guarda só o conteúdo de `web/`, que é o que o Pages serve.

Para publicar uma alteração:

```bash
bash build.sh                                  # se mexeu em src/
git add -A && git commit -m "o que mudou"
git push
git subtree push --prefix web origin gh-pages  # manda web/ para o site
```

O Pages leva ~1 minuto para reconstruir. Se o navegador insistir em servir a versão
velha, force com Ctrl+Shift+R.

> O repositório é **público** — GitHub Pages em conta gratuita exige isso. As fotos
> nunca vão para lá: o `.gitignore` bloqueia `offline/fotos/`. O que fica público é
> só o código e o ID da pasta do Drive, que já é um link compartilhável.

---

## PLANO C — versão offline

**Faça isso na véspera.** É o seguro contra o wi-fi da sala.

1. No Drive, botão direito na pasta → **Fazer download**. Ele monta um ZIP.
2. Extraia o conteúdo dentro de `offline/fotos/`. Pode manter as subpastas como
   vierem — o gerador varre tudo, igual às outras duas rotas.
3. Botão direito em `offline/gerar-lista.ps1` → **Executar com o PowerShell**.
   Ele varre `fotos/` recursivamente, escreve `lista.js` e imprime quantas achou
   em cada subpasta.
4. Dê dois cliques em `offline/index.html`. Funciona sem internet nenhuma.

Se o Windows reclamar da política de execução, abra o PowerShell na pasta e rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\gerar-lista.ps1
```

---

## Como a página funciona

Ao abrir, ela cai numa **tela inicial** com duas opções:

- **Iniciar slideshow** — passa sozinho, em ordem aleatória, com crossfade
- **Navegar nas imagens** — grade de miniaturas tipo Drive; clicar numa abre em tela
  cheia, e aí as setas navegam **sem avançar sozinho**

`Esc` volta um nível (slideshow → de onde veio → menu). Se quiser pular a tela inicial
e cair direto no slideshow, ponha `pularMenu: true` na config.

### Ela baixa tudo antes

Assim que a página abre, ela começa a **baixar todas as imagens em segundo plano**,
4 por vez, sem esperar chegar a vez de cada uma. O rodapé da tela inicial mostra o
progresso (`baixando tudo… 34 / 87`) e depois `87 imagens já baixadas`.

Isso é o seguro contra o wi-fi da sala: depois que o download termina, **se a internet
cair no meio da apresentação as fotos continuam passando normalmente**, porque saem do
cache do navegador e nem chegam a ir na rede. Só deixe a página aberta um pouco antes
de começar. Para desligar: `baixarTudo: false`.

## Controles durante a apresentação

| Tecla | O quê |
|---|---|
| **F11** | tela cheia (funciona em qualquer navegador) |
| **espaço** | pausa / continua — para comentar uma foto |
| **← →** | volta / avança na hora, **sem transição** |
| **Esc** | volta para a galeria / tela inicial |
| **R** | força a busca por fotos novas agora, sem esperar os 3 min |
| clique | avança (útil com apresentador remoto) |

O crossfade só acontece na passagem **automática**. Troca manual é seca, de propósito.
O cursor do mouse e o botão "Voltar" somem sozinhos depois de 2,5 s parado.

---

## Ajustes

Tudo fica no `config.js` da versão que você escolheu (na Rota A, no bloco `window.CFG`
dentro de `apps-script/index.html`).

| Opção | Padrão | O quê |
|---|---|---|
| `segundos` | `7` | tempo de cada foto na tela |
| `fade` | `1500` | duração do crossfade, em ms |
| `atualizarACada` | `180` | de quantos em quantos segundos reconsulta a pasta |
| `novasNaFrente` | `true` | foto recém-enviada entra logo depois da atual, não no fim da fila |
| `mostrarNome` | `false` | nome do arquivo no canto inferior esquerdo (com a subpasta) |
| `mostrarContador` | `true` | o `12 / 87` no canto inferior direito |
| `prefixoIA` | `'IA_'` | arquivos com esse começo ganham o selo |
| `titulo` | `'Fotos da turma'` | o que aparece na tela inicial |
| `embaralhar` | `true` | `true` = ordem aleatória; `false` = ordem de upload |
| `pularMenu` | `false` | `true` = abre direto no slideshow, sem a tela inicial |
| `baixarTudo` | `true` | baixa todas as imagens de cara, para não depender da conexão |
| `baixarDeCadaVez` | `4` | quantos downloads simultâneos em segundo plano |

Na Rota A há mais quatro constantes, no topo do `Codigo.gs`:

| Constante | Padrão | O quê |
|---|---|---|
| `VARRER_SUBPASTAS` | `true` | `false` = só a pasta raiz |
| `PROFUNDIDADE_MAX` | `8` | até quantos níveis descer |
| `ORDEM` | `'data'` | `'data'` = ordem de upload; `'pasta'` = agrupado por subpasta |
| `CACHE_SEG` | `60` | quanto tempo a lista fica em cache no servidor |

Se mexer em `src/`, rode `bash build.sh` (Git Bash) para remontar as três versões.
Os `config.js` de `web/` e `offline/` nunca são sobrescritos.

---

## Checklist do dia

- [ ] Véspera: montar a pasta `offline/` e testar (Plano C)
- [ ] Véspera: subir as 5 imagens `IA_*.jpg` no Drive
- [ ] Abrir o link **10 minutos antes** e deixar rodando numa aba
- [ ] F11
- [ ] Se o wi-fi estiver ruim: fechar e abrir a versão offline

---

## Quando dá errado

| Sintoma | Causa quase sempre |
|---|---|
| "Não consegui ler a pasta" + erro 403 | Drive API não ativada, ou restrição da chave não bate com a URL do site |
| "Não consegui ler a pasta" + erro 404 | ID da pasta errado (copiou o link inteiro em vez do ID) |
| "A pasta está vazia" | pasta certa mas sem nenhum arquivo de imagem (só PDF/vídeo/atalho) |
| Faltou o conteúdo de uma subpasta | ela está mais de 8 níveis abaixo, ou é um **atalho** de pasta em vez da pasta (o Drive não deixa seguir atalho) |
| A página demora a abrir | árvore grande demais para varrer a cada acesso — aumente `CACHE_SEG` para `120` |
| Tela preta, nenhuma imagem | compartilhamento está "Restrito" em vez de "Qualquer pessoa com o link" |
| Apps Script mostra código velho | faltou publicar **nova versão** em Gerenciar implantações |
| Algumas fotos não aparecem | arquivo não é imagem (HEIC de iPhone às vezes não abre) — converta para JPG |
| **Faixa branca no topo (Rota A)** | é a moldura que o Google põe em volta de todo app do Apps Script — vem do `script.google.com`, fora da nossa página, e não dá para estilizar de dentro. F11 deixa ela mínima; para sumir de vez, use a Rota B no Modo 1 |
