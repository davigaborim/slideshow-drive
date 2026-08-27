/* Fonte dos arquivos para a versao hospedada (GitHub Pages / Netlify).

   Dois modos, escolhidos pelo config.js:

   A) CFG.endpointAppsScript preenchido  -> pega a lista do seu Apps Script.
      Nao precisa de chave de API. Usa <script> (JSONP), entao nao esbarra em CORS.

   B) so CFG.apiKey preenchido           -> fala direto com a API do Drive.

   Devolve imagens, videos e audios. Quem separa por tipo e o motor.
*/

var MIME_PASTA = 'application/vnd.google-apps.folder';
var contadorJsonp = 0;

function tipoDoMime(mime) {
  if (!mime) return null;
  if (mime.indexOf('image/') === 0) return 'imagem';
  if (mime.indexOf('video/') === 0) return 'video';
  if (mime.indexOf('audio/') === 0) return 'audio';
  return null;
}

function carregarFotos() {
  if (CFG.endpointAppsScript) return viaAppsScript();

  if (!CFG.apiKey || CFG.apiKey.indexOf('COLE_') === 0) {
    return Promise.reject(new Error(
      'Falta configurar a fonte das fotos. Abra config.js e preencha ' +
      'endpointAppsScript com a URL /exec do seu Apps Script (jeito recomendado, ' +
      'sem chave), ou apiKey com uma chave da API do Drive.'
    ));
  }

  return viaApiDrive();
}

/* ------------------------------------------------- A) via Apps Script (JSONP) */

/* As duas maneiras de dar errado aqui levam ao mesmo lugar quase sempre:
   a implantacao publicada e mais velha que o Codigo.gs. Vale gastar tres
   linhas dizendo o caminho exato, em vez de deixar so "deu erro". */
function RECADO(oQueAconteceu) {
  return [
    'O Apps Script ' + oQueAconteceu + '. As causas, em ordem de chance:',
    '',
    '1. A implantacao esta velha. No editor do script: Implantar > Gerenciar ' +
    'implantacoes > lapis > Versao: Nova versao > Implantar. A URL /exec nao muda.',
    '2. Em "Quem pode acessar" nao esta como Qualquer pessoa.',
    '3. A URL /exec no config.js esta errada.'
  ].join('\n');
}

function viaAppsScript() {
  return new Promise(function (res, rej) {
    var nome = '__slide_cb_' + (++contadorJsonp);
    var s = document.createElement('script');
    var t = setTimeout(function () { limpa(); rej(new Error(RECADO('demorou mais de 25 s para responder'))); }, 25000);

    function limpa() {
      clearTimeout(t);
      try { delete window[nome]; } catch (e) { window[nome] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }

    window[nome] = function (dados) {
      limpa();
      res((dados || []).map(montarMidia));
    };
    s.onerror = function () {
      limpa();
      rej(new Error(RECADO('respondeu, mas nao com a lista de arquivos')));
    };

    var u = CFG.endpointAppsScript;
    // o _ no fim evita que o navegador sirva uma lista velha do cache
    s.src = u + (u.indexOf('?') < 0 ? '?' : '&') + 'callback=' + nome + '&_=' + Date.now();
    document.head.appendChild(s);
  });
}

/* --------------------------------------------- B) via API do Drive (com chave) */

function viaApiDrive() {
  var fila = [{ id: CFG.pastaId, caminho: '', nivel: 0 }];
  var pastasVistas = {}, arquivosVistos = {}, conteudoVisto = {}, achadas = [];
  var maxNivel = (CFG.profundidadeMax === undefined) ? 8 : CFG.profundidadeMax;
  var varrerSub = (CFG.varrerSubpastas === undefined) ? true : CFG.varrerSubpastas;
  var tirarDup = (CFG.tirarDuplicadas === undefined) ? true : CFG.tirarDuplicadas;

  function chaveNome(nome) {
    return String(nome).toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[\s_-]*\(\d+\)\s*$/, '')
      .replace(/[\s_-]*(c[oó]pia( de)?|copy|copia)\s*$/, '')
      .replace(/\s+/g, ' ').trim();
  }

  function proxima() {
    if (!fila.length) return Promise.resolve();
    var atual = fila.shift();
    if (pastasVistas[atual.id]) return proxima();
    pastasVistas[atual.id] = true;

    return listarPasta(atual.id).then(function (itens) {
      for (var i = 0; i < itens.length; i++) {
        var f = itens[i];

        if (f.mimeType === MIME_PASTA) {
          if (varrerSub && atual.nivel < maxNivel) {
            fila.push({
              id: f.id,
              caminho: atual.caminho ? atual.caminho + ' / ' + f.name : f.name,
              nivel: atual.nivel + 1
            });
          }
          continue;
        }

        var tipo = tipoDoMime(f.mimeType);
        if (!tipo) continue;
        if (arquivosVistos[f.id]) continue;
        arquivosVistos[f.id] = true;

        var tam = parseInt(f.size, 10) || 0;
        if (tirarDup && tam > 0) {
          // md5Checksum e o jeito certo quando a API entrega; senao, tamanho + nome
          var chave = f.md5Checksum
            ? 'md5|' + f.md5Checksum
            : tipo + '|' + tam + '|' + chaveNome(f.name);
          if (conteudoVisto[chave]) continue;
          conteudoVisto[chave] = true;
        }

        achadas.push(montarMidia({
          id: f.id,
          nome: f.name,
          tipo: tipo,
          tamanho: tam,
          pasta: atual.caminho,
          criado: Date.parse(f.createdTime) || 0
        }));
      }
      return proxima();
    });
  }

  return proxima().then(function () {
    if (CFG.ordem === 'pasta') {
      achadas.sort(function (a, b) {
        if (a.pasta !== b.pasta) return a.pasta < b.pasta ? -1 : 1;
        if (a.nome === b.nome) return 0;
        return a.nome < b.nome ? -1 : 1;
      });
    } else {
      achadas.sort(function (a, b) { return a.criado - b.criado; });
    }
    return achadas;
  });
}

/* Lista tudo que esta dentro de uma pasta, paginando. */
function listarPasta(idPasta) {
  var q = "'" + idPasta + "' in parents and trashed = false";
  var out = [];

  function pagina(token) {
    var u = 'https://www.googleapis.com/drive/v3/files'
      + '?q=' + encodeURIComponent(q)
      + '&key=' + encodeURIComponent(CFG.apiKey)
      + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,createdTime,size,md5Checksum)')
      + '&orderBy=createdTime'
      + '&pageSize=1000'
      + '&supportsAllDrives=true&includeItemsFromAllDrives=true'
      + (token ? '&pageToken=' + encodeURIComponent(token) : '');

    return fetch(u).then(function (r) {
      return r.text().then(function (txt) {
        if (!r.ok) {
          var msg = txt;
          try { msg = JSON.parse(txt).error.message; } catch (e) {}
          throw new Error('Drive API ' + r.status + ' - ' + msg);
        }
        return JSON.parse(txt);
      });
    }).then(function (j) {
      out = out.concat(j.files || []);
      if (j.nextPageToken) return pagina(j.nextPageToken);
    });
  }

  return pagina(null).then(function () { return out; });
}
