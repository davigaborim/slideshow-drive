/* =====================================================================
   Slideshow automatico de uma pasta do Google Drive (com subpastas).
   Le imagens, videos e musicas. Cole este arquivo em script.google.com
   como "Codigo.gs".
   ===================================================================== */

// ID da pasta raiz no Drive.
var ID_PASTA = '1YO_R4YttUszffoXcyW4gjmNdKIbIERkb';

// Varrer tambem as subpastas, e as subpastas das subpastas.
var VARRER_SUBPASTAS = true;

// Ate quantos niveis descer. Trava de seguranca contra arvore gigante.
var PROFUNDIDADE_MAX = 8;

// Ordem das fotos:
//   'data'  -> por data de upload, mais antigas primeiro (fotos novas caem no fim)
//   'pasta' -> agrupadas por subpasta, em ordem alfabetica
var ORDEM = 'data';

// Joga fora copias do mesmo arquivo. Duas entradas com o MESMO tamanho em bytes
// e o mesmo nome (ignorando "(1)", " - copia" e maiusculas) contam como uma so.
// E o que impede a mesma foto de aparecer duas vezes no slideshow.
var TIRAR_DUPLICADAS = true;

// Tambem considera duplicada quando o tamanho em bytes bate mas o nome mudou
// (ex.: a mesma foto salva como "IMG_2201.jpg" e "WhatsApp Image.jpg").
// Deixe false se a pasta tiver fotos diferentes de tamanho identico.
var DUPLICADA_SO_PELO_TAMANHO = false;

// Quantos segundos a lista fica em cache no servidor do Apps Script.
// Segura o custo quando varias pessoas abrem o link ao mesmo tempo.
// Se a pasta for enorme e a pagina demorar para abrir, aumente para 120.
var CACHE_SEG = 60;


function doGet(e) {
  // Com ?callback=xxx devolve so a lista, em JavaScript (JSONP).
  // E assim que a versao hospedada no GitHub Pages pega tudo sem chave de API.
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    if (!/^[A-Za-z0-9_$]{1,64}$/.test(cb)) throw new Error('callback invalido');
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(listarFotos()) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Sem parametro: serve a propria pagina do slideshow.
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Slideshow')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Devolve tudo que da para tocar na pasta raiz e nas subpastas:
 * imagens, videos e audios. O tipo vem no campo "tipo".
 */
function listarFotos() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('midias_v2');
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { /* cache ruim, refaz */ }
  }

  var achadas = [];
  var arquivosVistos = {};   // mesmo arquivo alcancado por dois caminhos
  var pastasVistas = {};     // evita loop se houver atalho circular
  var conteudoVisto = {};    // copias do mesmo arquivo com ids diferentes

  varrer(DriveApp.getFolderById(ID_PASTA), '', 0,
         achadas, arquivosVistos, pastasVistas, conteudoVisto);

  if (ORDEM === 'pasta') {
    achadas.sort(function (a, b) {
      if (a.pasta !== b.pasta) return a.pasta < b.pasta ? -1 : 1;
      if (a.nome === b.nome) return 0;
      return a.nome < b.nome ? -1 : 1;
    });
  } else {
    achadas.sort(function (a, b) { return a.criado - b.criado; });
  }

  // o cache do Apps Script aceita ate 100 KB por chave; se estourar, so nao cacheia
  try {
    var txt = JSON.stringify(achadas);
    if (txt.length < 95000) cache.put('midias_v2', txt, CACHE_SEG);
  } catch (e) {}

  return achadas;
}


/** 'imagem', 'video', 'audio' ou null se for um arquivo que nao interessa. */
function tipoDe(mime) {
  if (!mime) return null;
  if (mime.indexOf('image/') === 0) return 'imagem';
  if (mime.indexOf('video/') === 0) return 'video';
  if (mime.indexOf('audio/') === 0) return 'audio';
  return null;
}


/**
 * Nome sem extensao, sem acentos de caixa e sem os sufixos que o Drive e o
 * Windows grudam em copia: "foto (1).jpg", "foto - Copia.jpg", "foto copy.jpg".
 * Serve so para reconhecer duplicadas.
 */
function chaveNome(nome) {
  return String(nome)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[\s_-]*\(\d+\)\s*$/, '')
    .replace(/[\s_-]*(c[oó]pia( de)?|copy|copia)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Percorre uma pasta e, recursivamente, tudo que estiver dentro dela.
 * As URLs sao montadas no navegador a partir do id: a resposta trafega
 * menor e cabe no cache.
 */
function varrer(pasta, caminho, nivel, achadas, arquivosVistos, pastasVistas, conteudoVisto) {
  var idPasta = pasta.getId();
  if (pastasVistas[idPasta]) return;
  pastasVistas[idPasta] = true;

  var arqs = pasta.getFiles();
  while (arqs.hasNext()) {
    var f = arqs.next();
    var tipo = tipoDe(f.getMimeType());
    if (!tipo) continue;

    var id = f.getId();
    if (arquivosVistos[id]) continue;
    arquivosVistos[id] = true;

    var nome = f.getName();
    var tamanho = 0;
    try { tamanho = f.getSize(); } catch (e) {}

    if (TIRAR_DUPLICADAS && tamanho > 0) {
      var chave = DUPLICADA_SO_PELO_TAMANHO
        ? tipo + '|' + tamanho
        : tipo + '|' + tamanho + '|' + chaveNome(nome);
      if (conteudoVisto[chave]) continue;
      conteudoVisto[chave] = true;
    }

    achadas.push({
      id: id,
      nome: nome,
      tipo: tipo,
      tamanho: tamanho,
      pasta: caminho,
      criado: f.getDateCreated().getTime()
    });
  }

  if (!VARRER_SUBPASTAS || nivel >= PROFUNDIDADE_MAX) return;

  var subs = pasta.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    varrer(
      sub,
      caminho ? caminho + ' / ' + sub.getName() : sub.getName(),
      nivel + 1,
      achadas, arquivosVistos, pastasVistas, conteudoVisto
    );
  }
}


/**
 * Rode esta funcao UMA VEZ no editor (botao "Executar") para:
 *   - autorizar o acesso ao Drive;
 *   - conferir o que ele enxerga: quantas fotos, videos, musicas e duplicadas.
 * O resultado aparece no painel "Registro de execucao".
 */
function testar() {
  if (ID_PASTA.indexOf('COLE_O_ID') === 0) {
    throw new Error('Falta preencher a constante ID_PASTA no topo do arquivo.');
  }

  var t0 = new Date().getTime();
  var pasta = DriveApp.getFolderById(ID_PASTA);
  limparCache();
  var itens = listarFotos();
  var seg = ((new Date().getTime() - t0) / 1000).toFixed(1);

  Logger.log('Pasta raiz: %s', pasta.getName());
  Logger.log('Itens aproveitados: %s  (varredura em %s s)', itens.length, seg);

  if (!itens.length) {
    Logger.log('ATENCAO: nada encontrado. ID errado, pasta vazia, ou so tem');
    Logger.log('arquivos que nao sao imagem/video/audio (PDF, atalho, doc...).');
    return;
  }

  var porTipo = { imagem: 0, video: 0, audio: 0 };
  var porPasta = {};
  var ia = 0;
  for (var i = 0; i < itens.length; i++) {
    porTipo[itens[i].tipo]++;
    var p = itens[i].pasta || '(raiz)';
    porPasta[p] = (porPasta[p] || 0) + 1;
    if (itens[i].nome.toUpperCase().indexOf('IA_') === 0) ia++;
  }

  Logger.log('--- por tipo ---');
  Logger.log('fotos: %s   videos: %s   musicas: %s',
             porTipo.imagem, porTipo.video, porTipo.audio);

  Logger.log('--- por pasta ---');
  for (var nome in porPasta) Logger.log('%s  ->  %s item(ns)', nome, porPasta[nome]);

  Logger.log('--- selo de IA ---');
  Logger.log('%s de 5 arquivos com o prefixo IA_', ia);

  conferirDuplicadas();
}


/**
 * Diz QUAIS arquivos da pasta sao copias uns dos outros, sem filtrar nada.
 * Use quando uma foto parecer repetir no slideshow: se aparecer aqui, a copia
 * esta no Drive mesmo e vale apagar por la.
 */
function conferirDuplicadas() {
  var achadas = [];
  varrerCru(DriveApp.getFolderById(ID_PASTA), '', 0, achadas, {}, {});

  var porTamanho = {}, porNome = {};
  for (var i = 0; i < achadas.length; i++) {
    var a = achadas[i];
    if (a.tamanho > 0) {
      (porTamanho[a.tamanho] = porTamanho[a.tamanho] || []).push(a);
    }
    var cn = chaveNome(a.nome);
    (porNome[cn] = porNome[cn] || []).push(a);
  }

  Logger.log('--- duplicadas ---');
  var achou = 0;
  for (var t in porTamanho) {
    var g = porTamanho[t];
    if (g.length < 2) continue;
    achou++;
    var descr = [];
    for (var j = 0; j < g.length; j++) {
      descr.push((g[j].pasta || '(raiz)') + '/' + g[j].nome);
    }
    Logger.log('%s bytes, %s copias: %s', t, g.length, descr.join('  |  '));
  }
  if (!achou) {
    Logger.log('nenhum arquivo repetido no Drive.');
    Logger.log('Se ainda assim algo repetir na tela, o problema nao e a pasta.');
  } else {
    Logger.log('%s grupo(s) repetido(s). Com TIRAR_DUPLICADAS = true o', achou);
    Logger.log('slideshow ja mostra so uma copia de cada.');
  }
}


/** Igual ao varrer(), mas sem tirar duplicada nenhuma. So o conferirDuplicadas usa. */
function varrerCru(pasta, caminho, nivel, achadas, arquivosVistos, pastasVistas) {
  var idPasta = pasta.getId();
  if (pastasVistas[idPasta]) return;
  pastasVistas[idPasta] = true;

  var arqs = pasta.getFiles();
  while (arqs.hasNext()) {
    var f = arqs.next();
    if (!tipoDe(f.getMimeType())) continue;
    var id = f.getId();
    if (arquivosVistos[id]) continue;
    arquivosVistos[id] = true;
    var tam = 0;
    try { tam = f.getSize(); } catch (e) {}
    achadas.push({ nome: f.getName(), pasta: caminho, tamanho: tam });
  }

  if (!VARRER_SUBPASTAS || nivel >= PROFUNDIDADE_MAX) return;
  var subs = pasta.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    varrerCru(sub, caminho ? caminho + ' / ' + sub.getName() : sub.getName(),
              nivel + 1, achadas, arquivosVistos, pastasVistas);
  }
}


/** Limpa o cache, para forcar uma releitura imediata da pasta. */
function limparCache() {
  var c = CacheService.getScriptCache();
  c.remove('midias_v2');
  c.remove('fotos');   // chave da versao antiga
}
