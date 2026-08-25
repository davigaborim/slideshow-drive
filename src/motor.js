/* =========================================================================
   Motor do slideshow - compartilhado pelas 3 versoes (web / apps-script / offline).
   Depende de uma funcao global carregarFotos() que devolve uma Promise com:
     [{ id, nome, pasta?, url, urlThumb?, urlAlt? }, ...]

   Telas: menu -> (slideshow | galeria -> slideshow em modo navegacao)
   ========================================================================= */
(function () {
  'use strict';

  var PADRAO = {
    titulo: 'Fotos',
    segundos: 7,          // tempo de cada foto na tela
    fade: 1500,           // crossfade em ms (so no avanco automatico)
    atualizarACada: 180,  // de quantos em quantos segundos reconsulta a pasta (0 = nunca)
    novasNaFrente: true,  // foto nova entra logo depois da atual em vez de no fim da fila
    embaralhar: true,     // ordem aleatoria no slideshow
    pularMenu: false,     // true = abre direto no slideshow, sem a tela inicial
    baixarTudo: true,     // baixa TODAS as imagens em segundo plano, assim que a pagina abre
    baixarDeCadaVez: 4,   // quantos downloads simultaneos no segundo plano
    mostrarNome: false,   // nome do arquivo no canto inferior esquerdo
    mostrarContador: true,
    prefixoIA: 'IA_',     // arquivos com esse prefixo ganham o selo
    tituloSelo: 'processada com IA'
  };

  var CFG = {};
  for (var k in PADRAO) CFG[k] = PADRAO[k];
  var user = window.CFG || {};
  for (var k2 in user) if (user[k2] !== undefined) CFG[k2] = user[k2];

  var $ = function (s) { return document.querySelector(s); };

  var camadas, cam = 0;
  var fotos = [];
  var idx = -1;
  var tela = 'carregando';   // 'menu' | 'galeria' | 'slideshow'
  var origem = 'menu';       // de onde o slideshow foi aberto
  var modoNav = false;       // true = veio da galeria: nao avanca sozinho
  var pausado = false;
  var timerFoto = null, timerToast = null, timerCursor = null;
  var trocando = false;
  var gradeMontada = 0;      // quantas celulas ja estao na grade

  /* ---------------------------------------------------------------- util */

  function embaralha(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function ehIA(foto) {
    return !!(CFG.prefixoIA && foto.nome &&
      foto.nome.toUpperCase().indexOf(CFG.prefixoIA.toUpperCase()) === 0);
  }

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { el.classList.remove('on'); }, 4500);
  }

  function aviso(titulo, texto, ehErro) {
    var el = $('#aviso');
    $('#aviso-t').textContent = titulo;
    $('#aviso-p').innerHTML = texto || '';
    el.classList.toggle('erro', !!ehErro);
    el.classList.remove('off');
  }

  /* --------------------------------------------------------------- telas */

  function irPara(nova) {
    tela = nova;
    document.body.className =
      (document.body.classList.contains('sem-cursor') ? 'sem-cursor ' : '') + 'tela-' + nova;
    $('#aviso').classList.add('off');

    clearTimeout(timerFoto);
    if (nova === 'slideshow' && !modoNav && !pausado) agenda();
    if (nova === 'galeria') montarGrade();
    if (nova === 'menu') atualizaMenu();
  }

  function atualizaMenu() {
    $('#menu-titulo').textContent = CFG.titulo;
    $('#menu-conta').textContent = fotos.length;
    atualizaProgresso();
  }

  function notaAtualizacao() {
    return CFG.atualizarACada > 0
      ? 'a lista se atualiza sozinha a cada ' +
        Math.max(1, Math.round(CFG.atualizarACada / 60)) + ' min'
      : '';
  }

  /* ------------------------------------------------------ pre-carregamento */

  function precarregar(foto) {
    if (foto.urlOk) return Promise.resolve(true);
    var tentativas = [foto.url, foto.urlAlt].filter(Boolean);
    return new Promise(function (res) {
      var i = 0;
      (function tenta() {
        if (i >= tentativas.length) { foto.quebrada = true; return res(false); }
        var src = tentativas[i++];
        var im = new Image();
        var t = setTimeout(function () { im.onload = im.onerror = null; tenta(); }, 9000);
        im.onload = function () { clearTimeout(t); foto.urlOk = src; res(true); };
        im.onerror = function () { clearTimeout(t); tenta(); };
        im.src = src;
      })();
    });
  }

  /* ------------------------------------------- baixar tudo em 2o plano

     Puxa todas as imagens assim que a pagina abre, antes de precisar delas.
     Nao guardamos os objetos Image em memoria de proposito: o que importa e
     que os bytes fiquem no cache do navegador. Assim uma pasta grande nao
     estoura a RAM, e se a internet cair no meio da apresentacao as fotos ja
     baixadas continuam aparecendo normalmente.                              */

  var prefetchRodando = false;

  function jaResolvida(f) { return !!(f.urlOk || f.quebrada); }

  function contaProntas() {
    var n = 0;
    for (var i = 0; i < fotos.length; i++) if (jaResolvida(fotos[i])) n++;
    return n;
  }

  function atualizaProgresso() {
    var el = $('#menu-rodape');
    if (!el) return;
    var nota = notaAtualizacao();

    if (!CFG.baixarTudo || !fotos.length) { el.textContent = nota; return; }

    var n = contaProntas(), tot = fotos.length;
    if (n >= tot) {
      el.textContent = tot + ' imagens já baixadas — a passagem não depende mais da internet' +
        (nota ? '  ·  ' + nota : '');
    } else {
      el.textContent = 'baixando tudo para não depender da conexão…  ' + n + ' / ' + tot;
    }
  }

  function baixarTudo() {
    if (!CFG.baixarTudo || prefetchRodando) return;
    prefetchRodando = true;

    var i = 0, ativos = 0;
    var limite = Math.max(1, CFG.baixarDeCadaVez);

    function passo() {
      while (ativos < limite && i < fotos.length) {
        var f = fotos[i++];
        if (jaResolvida(f)) continue;
        ativos++;
        precarregar(f).then(function () {
          ativos--;
          atualizaProgresso();
          passo();
        });
      }
      if (ativos === 0 && i >= fotos.length) {
        prefetchRodando = false;
        atualizaProgresso();
      }
    }
    passo();
  }

  /* ----------------------------------------------------------- slideshow */

  function atualizaLegendas(foto) {
    $('#selo-txt').textContent = CFG.tituloSelo;
    $('#selo').classList.toggle('on', ehIA(foto));

    var elNome = $('#nome');
    if (CFG.mostrarNome && foto.nome) {
      var limpo = foto.nome.replace(/\.[a-z0-9]+$/i, '');
      elNome.textContent = foto.pasta ? foto.pasta + '  ·  ' + limpo : limpo;
      elNome.classList.remove('sumiu');
    } else {
      elNome.classList.add('sumiu');
    }

    var hud = $('#hud');
    if (CFG.mostrarContador && fotos.length) {
      hud.textContent = (idx + 1) + ' / ' + fotos.length;
      hud.classList.remove('sumiu');
    } else {
      hud.classList.add('sumiu');
    }
  }

  function agenda() {
    clearTimeout(timerFoto);
    if (pausado || modoNav || tela !== 'slideshow') return;
    timerFoto = setTimeout(function () { ir(1, false); }, CFG.segundos * 1000);
  }

  // instantaneo = true -> troca seca, sem crossfade (setas, clique, galeria)
  function trocarCamada(foto, instantaneo) {
    var prox = camadas[1 - cam], velha = camadas[cam];

    if (instantaneo) { prox.classList.add('instantaneo'); velha.classList.add('instantaneo'); }

    prox.src = foto.urlOk;
    prox.classList.add('ativa');
    velha.classList.remove('ativa');
    cam = 1 - cam;

    if (instantaneo) {
      // libera a transicao so depois que o navegador pintou, senao o
      // proximo avanco automatico sairia sem fade
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          prox.classList.remove('instantaneo');
          velha.classList.remove('instantaneo');
        });
      });
    }
  }

  function ir(delta, instantaneo) {
    if (trocando) return;
    clearTimeout(timerFoto);

    var vivas = 0;
    for (var i = 0; i < fotos.length; i++) if (!fotos[i].quebrada) vivas++;
    if (!vivas) {
      aviso('Nenhuma imagem pôde ser exibida',
        'A pasta tem arquivos, mas nenhum carregou. Confira se o compartilhamento está como ' +
        '<code>Qualquer pessoa com o link</code>.', true);
      return;
    }

    var voltas = 0, foto;
    do {
      idx = ((idx + delta) % fotos.length + fotos.length) % fotos.length;
      foto = fotos[idx];
      voltas++;
    } while (foto && foto.quebrada && voltas <= fotos.length);
    if (!foto) return;

    trocando = true;
    precarregar(foto).then(function (ok) {
      trocando = false;
      if (!ok) return ir(delta, instantaneo);

      trocarCamada(foto, instantaneo);
      atualizaLegendas(foto);
      $('#aviso').classList.add('off');
      agenda();

      var seg = fotos[(idx + 1) % fotos.length];
      if (seg && seg !== foto) precarregar(seg);
    });
  }

  function abrirSlideshow(de, posicao) {
    origem = de;
    modoNav = (de === 'galeria');
    pausado = false;
    $('#pausa').classList.remove('on');
    $('#dica').classList.remove('sumiu');
    setTimeout(function () { $('#dica').classList.add('sumiu'); }, 9000);

    irPara('slideshow');
    if (posicao === undefined) {
      idx = -1;
      ir(1, true);           // a primeira aparece direto, sem fade de abertura
    } else {
      idx = posicao - 1;
      ir(1, true);
    }
  }

  function voltar() {
    clearTimeout(timerFoto);
    if (tela === 'slideshow') irPara(origem);
    else if (tela === 'galeria') irPara('menu');
  }

  function togglePausa() {
    if (tela !== 'slideshow' || modoNav) return;
    pausado = !pausado;
    $('#pausa').classList.toggle('on', pausado);
    if (pausado) clearTimeout(timerFoto); else agenda();
  }

  /* ------------------------------------------------------------- galeria */

  // a galeria mostra na ordem original da pasta, mesmo com o slideshow embaralhado
  function ordemGaleria() {
    return fotos.slice().sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
  }

  function montarGrade(forcar) {
    var lista = ordemGaleria();
    $('#galeria-conta').textContent = lista.length + (lista.length === 1 ? ' imagem' : ' imagens');

    if (!forcar && gradeMontada === lista.length) return;
    var grade = $('#grade');
    grade.innerHTML = '';

    if (!lista.length) {
      grade.innerHTML = '<div class="vazio">Nenhuma imagem na pasta ainda.</div>';
      gradeMontada = 0;
      return;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < lista.length; i++) {
      (function (foto, n) {
        var cel = document.createElement('div');
        cel.className = 'cel';
        cel.title = (foto.pasta ? foto.pasta + '  ·  ' : '') + foto.nome;

        var im = document.createElement('img');
        im.loading = 'lazy';
        im.decoding = 'async';
        im.alt = foto.nome || '';
        im.onload = function () { im.classList.add('ok'); };
        im.onerror = function () {
          if (foto.urlAlt && im.src !== foto.urlAlt) im.src = foto.urlAlt;
        };
        im.src = foto.urlThumb || foto.url;
        cel.appendChild(im);

        if (ehIA(foto)) {
          var tg = document.createElement('span');
          tg.className = 'tag';
          tg.textContent = 'IA';
          cel.appendChild(tg);
        }

        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = n;
        cel.appendChild(num);

        cel.addEventListener('click', function () {
          var pos = fotos.indexOf(foto);
          if (pos >= 0) abrirSlideshow('galeria', pos);
        });

        frag.appendChild(cel);
      })(lista[i], i + 1);
    }
    grade.appendChild(frag);
    gradeMontada = lista.length;
  }

  /* ------------------------------------------------------ lista de fotos */

  function sincronizar(primeira) {
    return Promise.resolve()
      .then(function () { return carregarFotos(); })
      .then(function (lista) {
        lista = lista || [];

        if (!lista.length) {
          if (primeira) {
            aviso('A pasta está vazia',
              'Nenhuma imagem encontrada. Assim que as primeiras fotos entrarem no Drive, ' +
              'esta página as encontra sozinha — ela reconsulta a pasta a cada ' +
              Math.max(1, Math.round(CFG.atualizarACada / 60)) + ' min.', true);
          }
          return;
        }

        var atual = fotos[idx];
        var jaTinha = {};
        for (var i = 0; i < fotos.length; i++) jaTinha[fotos[i].id] = true;

        var idsAgora = {}, ordem = {}, novas = [];
        for (var j = 0; j < lista.length; j++) {
          var f = lista[j];
          idsAgora[f.id] = true;
          ordem[f.id] = j;                 // posicao na pasta, para a galeria
          if (!jaTinha[f.id]) { f.ord = j; novas.push(f); }
        }

        fotos = fotos.filter(function (f) { return idsAgora[f.id] || f === atual; });
        for (var m = 0; m < fotos.length; m++) {
          if (ordem[fotos[m].id] !== undefined) fotos[m].ord = ordem[fotos[m].id];
        }

        if (novas.length) {
          if (CFG.embaralhar) embaralha(novas);
          var pos = fotos.length;
          if (!primeira && CFG.novasNaFrente && atual && tela === 'slideshow') {
            pos = Math.min(fotos.indexOf(atual) + 2, fotos.length);
          }
          Array.prototype.splice.apply(fotos, [pos, 0].concat(novas));
        }

        if (primeira && CFG.embaralhar) embaralha(fotos);

        idx = atual ? fotos.indexOf(atual) : idx;

        if (primeira) {
          if (CFG.pularMenu) abrirSlideshow('menu');
          else irPara('menu');
        } else {
          if (tela === 'menu') atualizaMenu();
          if (tela === 'galeria') montarGrade(true);
          if (novas.length) {
            toast('+' + novas.length + (novas.length === 1 ? ' foto nova' : ' fotos novas'));
          }
        }

        baixarTudo();   // pega tambem as que acabaram de entrar
      })
      .catch(function (e) {
        console.error(e);
        if (primeira) {
          aviso('Não consegui ler a pasta do Drive',
            '<code>' + String(e && e.message ? e.message : e).slice(0, 400) + '</code>', true);
        }
        // ja estava rodando: ignora e continua com o que tem
      });
  }

  /* -------------------------------------------------------------- eventos */

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); voltar(); return; }

    if (tela === 'menu') {
      if (e.key === 'Enter') { e.preventDefault(); abrirSlideshow('menu'); }
      return;
    }
    if (tela !== 'slideshow') return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(1, true); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(-1, true); }
    else if (e.key === ' ') { e.preventDefault(); togglePausa(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); telaCheia(); }
    else if (e.key === 'r' || e.key === 'R') { sincronizar(false); toast('procurando fotos novas…'); }
  });

  document.addEventListener('click', function (e) {
    if (tela !== 'slideshow') return;
    if (e.target.closest && e.target.closest('button')) return;
    ir(1, true);
  });

  function mexeuMouse() {
    document.body.classList.remove('sem-cursor');
    clearTimeout(timerCursor);
    timerCursor = setTimeout(function () {
      if (tela === 'slideshow') document.body.classList.add('sem-cursor');
    }, 2500);
  }
  document.addEventListener('mousemove', mexeuMouse);

  /* ---------------------------------------------------------------- start */

  function iniciar() {
    camadas = [$('#a'), $('#b')];
    document.documentElement.style.setProperty('--fade', CFG.fade + 'ms');

    $('#bt-slideshow').addEventListener('click', function () { abrirSlideshow('menu'); });
    $('#bt-slideshow-2').addEventListener('click', function () { abrirSlideshow('galeria'); modoNav = false; agenda(); });
    $('#bt-galeria').addEventListener('click', function () { irPara('galeria'); });
    $('#bt-voltar').addEventListener('click', voltar);
    $('#bt-voltar-menu').addEventListener('click', voltar);

    mexeuMouse();
    sincronizar(true);

    if (CFG.atualizarACada > 0) {
      setInterval(function () { sincronizar(false); }, CFG.atualizarACada * 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
