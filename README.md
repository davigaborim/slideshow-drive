# Slideshow automático da pasta do Drive

Uma página que lê a pasta pública do Google Drive e passa **fotos e vídeos** sozinha,
com música de fundo opcional. **Ela reconsulta a pasta a cada 3 minutos** — então
arquivo que alguém subir durante a apresentação entra na rotação sem ninguém tocar
em nada.

A professora recebe um link, abre, aperta **F11**. Só isso.

No ar em **https://davigaborim.github.io/slideshow-drive/**

> ### ⚠️ Falta um passo, e é no Apps Script
>
> O `Codigo.gs` deste repositório passou a ler **vídeo e áudio** além de imagem, e a
> descartar arquivos duplicados. A implantação publicada ainda é a antiga — enquanto
> ela não for atualizada, **os vídeos não aparecem**.
>
> No editor do Apps Script: cole o novo `apps-script/Codigo.gs` e o novo
> `apps-script/index.html`, depois **Implantar → Gerenciar implantações → lápis →
> Versão: Nova versão → Implantar**. A URL `/exec` continua exatamente a mesma, então
> nada mais precisa mudar.

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
   da pasta, **quantas fotos, quantos vídeos e quantas músicas**, quantas em cada
   subpasta, quantas já estão com o prefixo `IA_` e quanto tempo a varredura levou.
   Ele também lista, no fim, os arquivos que são **cópia um do outro** — a função
   `conferirDuplicadas` faz só essa parte, se você quiser rodar de novo depois.

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

Ao abrir, ela cai numa **tela inicial** com duas opções e um painel de ajustes:

- **Iniciar slideshow** — passa sozinho, com crossfade
- **Navegar nas imagens** — grade de miniaturas tipo Drive; clicar numa abre em tela
  cheia, e aí as setas navegam **sem avançar sozinho**

`Esc` volta um nível (slideshow → de onde veio → menu). Se quiser pular a tela inicial
e cair direto no slideshow, ponha `pularMenu: true` na config.

### Ajustes na própria tela inicial

Não precisa mexer em arquivo nenhum para as coisas do dia a dia. A tela inicial tem:

| Ajuste | O quê |
|---|---|
| **Tempo por foto** | `−` / `+`, de 1 s a 30 s. Vídeo não usa isso: usa a duração dele |
| **Ordem** | Aleatória ou na ordem da pasta |
| **Vídeos** | Incluir ou pular os vídeos |
| **Música de fundo** | Ligada / desligada, com volume |

O que for mexido fica guardado **naquele navegador** (`localStorage`), então se você
ajustar antes da aula e der F5, continua como você deixou. Para desligar isso:
`lembrarAjustes: false`.

### Nada repete antes de todas passarem

A ordem aleatória **não é sorteio a cada troca** — isso repetiria foto o tempo todo.
Funciona como um baralho: embaralha a lista inteira uma vez e vai tirando de cima.
Só quando a última sai é que ele embaralha de novo e começa a rodada seguinte — e
ainda troca a primeira carta se ela for igual à que acabou de sair da tela, para não
emendar a mesma imagem duas vezes na virada.

O contador no canto (`12 / 87`) é a posição **dentro da rodada**, então dá para saber
quanto falta para dar a volta completa.

As setas ← → andam num histórico separado: voltar e avançar de novo não gasta a fila
nem fura a regra. Arquivo que chega no meio da rodada é encaixado no que ainda falta,
nunca no que já passou.

Se ainda assim uma foto parecer repetida, ela provavelmente está **duplicada no Drive**.
Duas coisas cuidam disso:

- o `Codigo.gs` já descarta cópias — mesmo tamanho em bytes e mesmo nome ignorando
  `(1)`, `- Cópia`, maiúsculas (constante `TIRAR_DUPLICADAS`);
- para ver quais são, rode a função **`conferirDuplicadas`** no editor do Apps Script:
  ela lista, no registro de execução, cada grupo de arquivos idênticos e onde estão.

### Vídeos

Vídeo entra no rodízio junto com as fotos, sem configuração. Ele:

- **toca com o áudio dele** — e a música de fundo abaixa até zero enquanto isso,
  voltando sozinha quando o vídeo acaba (se o vídeo for mudo, a música continua);
- **fica na tela o tempo que durar**, não os 3 s das fotos. Para cortar vídeo longo,
  use `maxSegundosVideo: 45`;
- se o navegador não conseguir tocar o arquivo direto, cai no **player do próprio
  Drive** dentro de um iframe, e aí usa `segundosVideo` (30 s) como duração.

Vídeo **não** é baixado antes junto com as fotos, de propósito: um arquivo de 200 MB
no pré-download derrubaria a página. Ele é lido do Drive na hora, e o próximo já vai
sendo carregado enquanto o atual está na tela.

> Se a apresentação for num wi-fi ruim, **desligue os vídeos** no painel. As fotos
> continuam garantidas pelo pré-download; os vídeos não têm como ser.

### Música de fundo

Ligou na tela inicial (ou com a tecla **M**), toca. De onde ela sai, nesta ordem:

1. **qualquer arquivo de áudio que estiver na pasta do Drive** — mp3, m4a, wav.
   É só a professora jogar um lá, ou você mesmo subir. Se tiver mais de um, toca em
   sequência; se tiver um só, fica em loop;
2. `musicaUrl` na config, se você quiser apontar um mp3 específico;
3. **nada disso** — o navegador gera um fundo ambiente na hora, com Web Audio.
   Não baixa arquivo, não tem questão de direito autoral, e nunca desafina: é um pad
   sobre escala pentatônica, onde qualquer combinação soa consonante.

A música só começa **depois do clique em "Iniciar slideshow"** — não é escolha nossa,
é regra de todos os navegadores: som não toca sem um gesto do usuário.

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
| **espaço** | pausa / continua — para comentar uma foto (pausa o vídeo também) |
| **← →** | volta / avança na hora, **sem transição** |
| **M** | liga / desliga a música de fundo |
| **Esc** | volta para a galeria / tela inicial |
| **R** | força a busca por arquivos novos agora, sem esperar os 3 min |
| clique | avança — clicar **em cima de um vídeo** controla o vídeo, não avança |

O crossfade só acontece na passagem **automática**. Troca manual é seca, de propósito.
O cursor do mouse e o botão "Voltar" somem sozinhos depois de 2,5 s parado.

---

## Ajustes no arquivo

O painel da tela inicial cobre o dia a dia. O resto fica no `config.js` da versão que
você escolheu (na Rota A, no bloco `window.CFG` dentro de `apps-script/index.html`).

| Opção | Padrão | O quê |
|---|---|---|
| `segundos` | `3` | tempo de cada **foto** na tela (vídeo usa a duração dele) |
| `fade` | `1200` | duração do crossfade, em ms |
| `embaralhar` | `true` | `true` = ordem aleatória sem repetir; `false` = ordem da pasta |
| `incluirVideos` | `true` | `false` = pula os vídeos da pasta |
| `maxSegundosVideo` | `0` | `0` = vídeo inteiro; `45` = corta em 45 s |
| `segundosVideo` | `30` | só para vídeo que caiu no player do Drive (iframe) |
| `musica` | `false` | trilha já ligada ao abrir |
| `volume` | `0.35` | volume da trilha, de 0 a 1 |
| `musicaUrl` | `''` | mp3 avulso; vazio = áudio da pasta, ou som gerado |
| `atualizarACada` | `180` | de quantos em quantos segundos reconsulta a pasta |
| `novasNaFrente` | `true` | arquivo recém-enviado entra logo depois do atual, não no fim |
| `mostrarNome` | `false` | nome do arquivo no canto inferior esquerdo (com a subpasta) |
| `mostrarContador` | `true` | o `12 / 87` no canto inferior direito |
| `prefixoIA` | `'IA_'` | arquivos com esse começo ganham o selo |
| `titulo` | `'Fotos da turma'` | o que aparece na tela inicial |
| `pularMenu` | `false` | `true` = abre direto no slideshow, sem a tela inicial |
| `baixarTudo` | `true` | baixa todas as imagens de cara, para não depender da conexão |
| `baixarDeCadaVez` | `4` | quantos downloads simultâneos em segundo plano |
| `lembrarAjustes` | `true` | guarda o painel no navegador entre um F5 e outro |

Na Rota A há mais constantes, no topo do `Codigo.gs`:

| Constante | Padrão | O quê |
|---|---|---|
| `VARRER_SUBPASTAS` | `true` | `false` = só a pasta raiz |
| `PROFUNDIDADE_MAX` | `8` | até quantos níveis descer |
| `ORDEM` | `'data'` | `'data'` = ordem de upload; `'pasta'` = agrupado por subpasta |
| `TIRAR_DUPLICADAS` | `true` | descarta cópias do mesmo arquivo (tamanho + nome) |
| `DUPLICADA_SO_PELO_TAMANHO` | `false` | `true` = considera cópia só pelo tamanho, mesmo com nome diferente |
| `CACHE_SEG` | `60` | quanto tempo a lista fica em cache no servidor |

E duas funções para rodar no editor, pelo botão **Executar**:

- **`testar`** — quantas fotos, vídeos e músicas ele enxerga, e em quais subpastas
- **`conferirDuplicadas`** — quais arquivos da pasta são cópia um do outro

Se mexer em `src/`, rode `bash build.sh` (Git Bash) para remontar as três versões.
Os `config.js` de `web/` e `offline/` nunca são sobrescritos.

---

## Checklist do dia

- [ ] **Redeploy do Apps Script** com o `Codigo.gs` novo (senão não tem vídeo)
- [ ] Véspera: montar a pasta `offline/` e testar (Plano C)
- [ ] Véspera: subir as 5 imagens `IA_*.jpg` no Drive
- [ ] Véspera: se quiser trilha, jogar **um mp3 na pasta do Drive**
- [ ] Abrir o link **10 minutos antes** e deixar rodando numa aba
- [ ] Conferir o painel: tempo por foto, vídeos, música — e esperar o rodapé dizer
      `N imagens já baixadas`
- [ ] F11
- [ ] Se o wi-fi estiver ruim: desligar **Vídeos** no painel, ou abrir a versão offline

---

## Quando dá errado

| Sintoma | Causa quase sempre |
|---|---|
| "Não consegui ler a pasta" + erro 403 | Drive API não ativada, ou restrição da chave não bate com a URL do site |
| "Não consegui ler a pasta" + erro 404 | ID da pasta errado (copiou o link inteiro em vez do ID) |
| "A pasta está vazia" | pasta certa mas sem nenhuma imagem, vídeo ou áudio (só PDF/doc/atalho) |
| Faltou o conteúdo de uma subpasta | ela está mais de 8 níveis abaixo, ou é um **atalho** de pasta em vez da pasta (o Drive não deixa seguir atalho) |
| A página demora a abrir | árvore grande demais para varrer a cada acesso — aumente `CACHE_SEG` para `120` |
| Tela preta, nenhuma imagem | compartilhamento está "Restrito" em vez de "Qualquer pessoa com o link" |
| Apps Script mostra código velho | faltou publicar **nova versão** em Gerenciar implantações |
| Algumas fotos não aparecem | arquivo não é imagem (HEIC de iPhone às vezes não abre) — converta para JPG |
| **"o Apps Script respondeu, mas não com a lista"** | implantação velha. Abra o script → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**. A URL `/exec` não muda |
| **Os vídeos não aparecem** | o `Codigo.gs` publicado é o antigo, que só lia imagem. Cole o novo e faça o redeploy como acima |
| Um vídeo abre com a moldura do Drive | o navegador não conseguiu tocar o arquivo direto (formato ou tamanho) e caiu no player do Drive — funciona, só fica menos limpo |
| Vídeo trava ou engasga | ele não é pré-baixado (seria grande demais). Se o wi-fi estiver ruim, desligue **Vídeos** no painel |
| A música não começa | o navegador exige um gesto: ela só entra depois do clique em "Iniciar slideshow", nunca sozinha ao abrir |
| Uma foto repete | duplicada no Drive. Rode `conferirDuplicadas` no editor do Apps Script para ver quais são |
| **Faixa branca no topo (Rota A)** | é a moldura que o Google põe em volta de todo app do Apps Script — vem do `script.google.com`, fora da nossa página, e não dá para estilizar de dentro. F11 deixa ela mínima; para sumir de vez, use a Rota B no Modo 1 |
