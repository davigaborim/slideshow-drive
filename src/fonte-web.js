/* Fonte das fotos para a versao hospedada (Netlify / GitHub Pages).

   Dois modos, escolhidos pelo config.js:

   A) CFG.endpointAppsScript preenchido  -> pega a lista do seu Apps Script.
      Nao precisa de chave de API. Usa <script> (JSONP), entao nao esbarra em CORS.

   B) so CFG.apiKey preenchido           -> fala direto com a API do Drive.
*/

var MIME_PASTA = 'application/vnd.google-apps.folder';
var contadorJsonp = 0;

function montarUrls(f) {
  return {
    id: f.id,
    nome: f.nome || f.name,
    pasta: f.pasta || '',
    criado: f.criado || 0,
    url: 'https://lh3.googleusercontent.com/d/' + f.id + '=w2048',
    urlThumb: 'https://lh3.googleusercontent.com/d/' + f.id + '=w400',
    urlAlt: 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w2048'
  };
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

function viaAppsScript() {
  return new Promise(function (res, rej) {
    var nome = '__slide_cb_' + (++contadorJsonp);
    var s = document.createElement('script');
    var t = setTimeout(function () { limpa(); rej(new Error('o Apps Script nao respondeu em 25s')); }, 25000);

    function limpa() {
      clearTimeout(t);
      try { delete window[nome]; } catch (e) { window[nome] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }

    window[nome] = function (dados) {
      limpa();
      res((dados || []).map(montarUrls));
    };
    s.onerror = function () {
      limpa();
      rej(new Error('nao consegui chamar o Apps Script — confira a URL /exec e se o acesso esta como "Qualquer pessoa"'));
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
  var pastasVistas = {}, arquivosVistos = {}, achadas = [];
  var maxNivel = (CFG.profundidadeMax === undefined) ? 8 : CFG.profundidadeMax;
  var varrerSub = (CFG.varrerSubpastas === undefined) ? true : CFG.varrerSubpastas;

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

        if (f.mimeType.indexOf('image/') !== 0) continue;
        if (arquivosVistos[f.id]) continue;
        arquivosVistos[f.id] = true;

        var item = montarUrls(f);
        item.pasta = atual.caminho;
        item.criado = Date.parse(f.createdTime) || 0;
        achadas.push(item);
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

/* Lista tudo que esta dentro de uma pasta (imagens e subpastas), paginando. */
function listarPasta(idPasta) {
  var q = "'" + idPasta + "' in parents and trashed = false";
  var out = [];

  function pagina(token) {
    var u = 'https://www.googleapis.com/drive/v3/files'
      + '?q=' + encodeURIComponent(q)
      + '&key=' + encodeURIComponent(CFG.apiKey)
      + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,createdTime)')
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
