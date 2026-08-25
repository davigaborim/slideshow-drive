/* =====================================================================
   Slideshow automatico de uma pasta do Google Drive (com subpastas).
   Cole este arquivo em script.google.com como "Codigo.gs".
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

// Quantos segundos a lista fica em cache no servidor do Apps Script.
// Segura o custo quando varias pessoas abrem o link ao mesmo tempo.
// Se a pasta for enorme e a pagina demorar para abrir, aumente para 120.
var CACHE_SEG = 60;


function doGet(e) {
  // Com ?callback=xxx devolve so a lista, em JavaScript (JSONP).
  // E assim que a versao hospedada no Netlify pega as fotos sem chave de API.
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
 * Devolve todas as imagens da pasta raiz e das subpastas.
 * Chamada pelo navegador via google.script.run.
 */
function listarFotos() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('fotos');
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { /* cache ruim, refaz */ }
  }

  var achadas = [];
  var arquivosVistos = {};   // evita a mesma foto duas vezes (arquivo em 2 pastas)
  var pastasVistas = {};     // evita loop se houver atalho circular

  varrer(DriveApp.getFolderById(ID_PASTA), '', 0, achadas, arquivosVistos, pastasVistas);

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
    if (txt.length < 95000) cache.put('fotos', txt, CACHE_SEG);
  } catch (e) {}

  return achadas;
}


/**
 * Percorre uma pasta e, recursivamente, tudo que estiver dentro dela.
 * As URLs das imagens sao montadas no navegador, a partir do id — assim
 * a resposta trafega menor e cabe no cache.
 */
function varrer(pasta, caminho, nivel, achadas, arquivosVistos, pastasVistas) {
  var idPasta = pasta.getId();
  if (pastasVistas[idPasta]) return;
  pastasVistas[idPasta] = true;

  var arqs = pasta.getFiles();
  while (arqs.hasNext()) {
    var f = arqs.next();
    if (f.getMimeType().indexOf('image/') !== 0) continue;

    var id = f.getId();
    if (arquivosVistos[id]) continue;
    arquivosVistos[id] = true;

    achadas.push({
      id: id,
      nome: f.getName(),
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
      achadas, arquivosVistos, pastasVistas
    );
  }
}


/**
 * Rode esta funcao UMA VEZ no editor (botao "Executar") para:
 *   - autorizar o acesso ao Drive;
 *   - conferir se o ID_PASTA esta certo e o que ele enxerga em cada subpasta.
 * O resultado aparece no painel "Registro de execucao".
 */
function testar() {
  if (ID_PASTA.indexOf('COLE_O_ID') === 0) {
    throw new Error('Falta preencher a constante ID_PASTA no topo do arquivo.');
  }

  var t0 = new Date().getTime();
  var pasta = DriveApp.getFolderById(ID_PASTA);
  limparCache();
  var fotos = listarFotos();
  var seg = ((new Date().getTime() - t0) / 1000).toFixed(1);

  Logger.log('Pasta raiz: %s', pasta.getName());
  Logger.log('Imagens encontradas: %s  (varredura em %s s)', fotos.length, seg);

  if (!fotos.length) {
    Logger.log('ATENCAO: nenhuma imagem. ID errado, pasta vazia, ou so tem');
    Logger.log('arquivos que nao sao imagem (PDF, video, atalho...).');
    return;
  }

  // quantas em cada subpasta
  var porPasta = {};
  for (var i = 0; i < fotos.length; i++) {
    var p = fotos[i].pasta || '(raiz)';
    porPasta[p] = (porPasta[p] || 0) + 1;
  }
  Logger.log('--- por pasta ---');
  for (var nome in porPasta) Logger.log('%s  ->  %s foto(s)', nome, porPasta[nome]);

  // quantas ja estao com o prefixo do selo de IA
  var ia = 0;
  for (var j = 0; j < fotos.length; j++) {
    if (fotos[j].nome.toUpperCase().indexOf('IA_') === 0) ia++;
  }
  Logger.log('--- selo de IA ---');
  Logger.log('%s de 5 imagens com o prefixo IA_', ia);

  Logger.log('--- amostra ---');
  Logger.log('primeira: %s', fotos[0].nome);
  Logger.log('ultima:   %s', fotos[fotos.length - 1].nome);
}


/** Limpa o cache, para forcar uma releitura imediata da pasta. */
function limparCache() {
  CacheService.getScriptCache().remove('fotos');
}
