/* =========================================================================
   Motor do slideshow - compartilhado pelas 3 versoes (web / apps-script / offline).
   Depende de uma funcao global carregarFotos() que devolve uma Promise com:
     [{ id, nome, tipo, tamanho, pasta, criado, urls[], urlThumb, urlIframe }, ...]
   tipo: 'imagem' | 'video' | 'audio'

   Telas: menu -> (slideshow | galeria -> visualizador)
   ========================================================================= */
(function () {
  'use strict';

  var PADRAO = {
    titulo: 'Fotos',
    segundos: 3,          // tempo de cada FOTO na tela (video usa a propria duracao)
    fade: 1200,           // crossfade em ms (so no avanco automatico)
    atualizarACada: 180,  // de quantos em quantos segundos reconsulta a pasta (0 = nunca)
    novasNaFrente: true,  // arquivo novo entra logo depois do atual em vez de no fim
    embaralhar: true,     // ordem aleatoria (sem repetir: veja "baralho" abaixo)
    pularMenu: false,     // true = abre direto no slideshow, sem a tela inicial

    incluirVideos: true,  // toca os videos da pasta junto com as fotos
    segundosVideo: 30,    // so vale para video que caiu no player do Drive (iframe)
    maxSegundosVideo: 0,  // 0 = deixa o video inteiro; >0 corta nesse tempo

    musica: false,        // trilha de fundo ligada ao abrir
    volume: 0.35,
    musicaUrl: '',        // mp3 avulso; vazio = usa audios da pasta ou som gerado

    baixarTudo: true,     // baixa as imagens em segundo plano assim que a pagina abre
    baixarDeCadaVez: 4,   // quantos downloads simultaneos no segundo plano

    mostrarNome: false,   // nome do arquivo no canto inferior esquerdo
    mostrarContador: true,
    prefixoIA: 'IA_',     // arquivos com esse prefixo ganham o selo
    tituloSelo: 'processada com IA',

    lembrarAjustes: true  // guarda o que foi mexido no painel, neste navegador
  };

  var CHAVE_AJUSTES = 'slideshow-ajustes-v1';

  var CFG = {};
  for (var k in PADRAO) CFG[k] = PADRAO[k];
  var user = window.CFG || {};
  for (var k2 in user) if (user[k2] !== undefined) CFG[k2] = user[k2];

  var $ = function (s) { return document.querySelector(s); };

  var camadas, cam = 0;

  var todos = [];        // tudo que veio da fonte, na ordem da pasta
  var itens = [];        // so o que entra no slideshow (imagem + video, se ligado)
  var audios = [];       // arquivos de musica da pasta

  /* --- o baralho ---------------------------------------------------------
     fila       = o que ainda falta mostrar NESTA rodada
     historico  = o que ja passou pela tela, na ordem, com a rodada de cada um
     histPos    = onde estamos dentro do historico (a seta esquerda anda aqui)
     Enquanto a fila nao esvaziar, nada repete. Quando esvazia, embaralha de
     novo e comeca outra rodada - garantindo que TODAS passaram antes.
     O historico atravessa a virada de rodada, senao a seta esquerda perderia
     o que estava na tela um segundo atras.                                  */
  var fila = [], historico = [], histPos = -1;
  var rodada = 1, naRodada = 0;
  var MAX_HISTORICO = 400;

  var atual = null;
  var navLista = [], navIdx = 0;   // modo galeria: percorre na ordem da pasta

  var tela = 'carregando';   // 'menu' | 'galeria' | 'slideshow'
  var origem = 'menu';
  var modoNav = false;       // true = veio da galeria: nao avanca sozinho
  var pausado = false;
  var timerItem = null, timerToast = null, timerCursor = null, timerAudio = null;
  var trocando = false;
  var gradeMontada = 0;
  var token = 0;             // invalida callbacks de troca antiga

  /* ---------------------------------------------------------------- util */

  function embaralha(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function ehIA(item) {
    return !!(CFG.prefixoIA && item && item.nome &&
      item.nome.toUpperCase().indexOf(CFG.prefixoIA.toUpperCase()) === 0);
  }

  function ehVideo(item) { return !!item && item.tipo === 'video'; }

  function plural(n, um, muitos) { return n + ' ' + (n === 1 ? um : muitos); }

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

  /* ------------------------------------------------------------- ajustes */

  function lerAjustesSalvos() {
    if (!CFG.lembrarAjustes) return;
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE_AJUSTES) || 'null');
      if (!s) return;
      if (typeof s.segundos === 'number') CFG.segundos = s.segundos;
      if (typeof s.embaralhar === 'boolean') CFG.embaralhar = s.embaralhar;
      if (typeof s.incluirVideos === 'boolean') CFG.incluirVideos = s.incluirVideos;
      if (typeof s.musica === 'boolean') CFG.musica = s.musica;
      if (typeof s.volume === 'number') CFG.volume = s.volume;
    } catch (e) {}
  }

  function salvarAjustes() {
    if (!CFG.lembrarAjustes) return;
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify({
        segundos: CFG.segundos,
        embaralhar: CFG.embaralhar,
        incluirVideos: CFG.incluirVideos,
        musica: CFG.musica,
        volume: CFG.volume
      }));
    } catch (e) {}
  }

  function marcarSegmento(idSeg, ligado) {
    var bs = $(idSeg).querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('on', (bs[i].getAttribute('data-v') === '1') === !!ligado);
    }
  }

  function pintarAjustes() {
    $('#tempo-val').textContent = CFG.segundos + 's';
    $('#tempo-menos').disabled = CFG.segundos <= 1;
    $('#tempo-mais').disabled = CFG.segundos >= 30;
    marcarSegmento('#seg-ordem', CFG.embaralhar);
    marcarSegmento('#seg-videos', CFG.incluirVideos);
    marcarSegmento('#seg-musica', CFG.musica);
    $('#volume').value = Math.round(CFG.volume * 100);
    $('#volume').disabled = !CFG.musica;

    var nv = contarVideos();
    $('#seg-videos').style.opacity = nv ? '1' : '.4';
    $('#nota-musica').textContent = CFG.musica
      ? 'tocando: ' + Trilha.descricao() +
        (nv ? '  ·  abaixa sozinha quando entrar um vídeo com som' : '')
      : (Trilha.temArquivo()
          ? 'a pasta tem música: ' + Trilha.descricao()
          : 'sem música na pasta — se ligar, o navegador gera um som ambiente');

    $('#sub-slideshow').textContent = CFG.embaralhar
      ? 'ordem aleatória, sem repetir nenhuma'
      : 'na ordem da pasta';
  }

  function ligarAjustes() {
    $('#tempo-menos').addEventListener('click', function () {
      CFG.segundos = Math.max(1, CFG.segundos - 1);
      salvarAjustes(); pintarAjustes();
    });
    $('#tempo-mais').addEventListener('click', function () {
      CFG.segundos = Math.min(30, CFG.segundos + 1);
      salvarAjustes(); pintarAjustes();
    });

    $('#seg-ordem').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      CFG.embaralhar = b.getAttribute('data-v') === '1';
      salvarAjustes(); novaRodada(true); pintarAjustes();
    });

    $('#seg-videos').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      CFG.incluirVideos = b.getAttribute('data-v') === '1';
      salvarAjustes(); reconstruirItens(); novaRodada(true);
      atualizaMenu(); montarGrade(true);
    });

    $('#seg-musica').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      alternarMusica(b.getAttribute('data-v') === '1');
    });

    $('#volume').addEventListener('input', function () {
      CFG.volume = (+this.value) / 100;
      Trilha.definirVolume(CFG.volume);
      salvarAjustes();
    });
    $('#volume').addEventListener('change', salvarAjustes);
  }

  function alternarMusica(ligar) {
    CFG.musica = (ligar === undefined) ? !CFG.musica : !!ligar;
    if (CFG.musica) { Trilha.definirVolume(CFG.volume); Trilha.ligar(); }
    else Trilha.desligar();
    salvarAjustes();
    pintarAjustes();
    return CFG.musica;
  }

  /* --------------------------------------------------------------- telas */

  function irPara(nova) {
    var antes = tela;
    tela = nova;
    document.body.className =
      (document.body.classList.contains('sem-cursor') ? 'sem-cursor ' : '') + 'tela-' + nova;
    $('#aviso').classList.add('off');

    clearTimeout(timerItem);
    if (antes === 'slideshow' && nova !== 'slideshow') pararMidias();

    if (nova === 'slideshow' && !modoNav && !pausado) agenda();
    if (nova === 'galeria') montarGrade();
    if (nova === 'menu') atualizaMenu();
  }

  function contarVideos() {
    var n = 0;
    for (var i = 0; i < todos.length; i++) if (todos[i].tipo === 'video') n++;
    return n;
  }

  function atualizaMenu() {
    $('#menu-titulo').textContent = CFG.titulo;

    var fotos = 0, videos = contarVideos();
    for (var i = 0; i < todos.length; i++) if (todos[i].tipo === 'imagem') fotos++;

    var partes = [plural(fotos, 'imagem', 'imagens')];
    if (videos) partes.push(plural(videos, 'vídeo', 'vídeos'));
    if (audios.length) partes.push(plural(audios.length, 'música', 'músicas'));
    $('#menu-conta').textContent = partes.join('  ·  ') + ' na pasta';

    pintarAjustes();
    atualizaProgresso();
  }

  function notaAtualizacao() {
    return CFG.atualizarACada > 0
      ? 'a lista se atualiza sozinha a cada ' +
        Math.max(1, Math.round(CFG.atualizarACada / 60)) + ' min'
      : '';
  }

  /* ------------------------------------------------------ pre-carregamento */

  function precarregarImagem(item) {
    if (item.urlOk) return Promise.resolve(true);
    var tentativas = (item.urls || [item.url]).filter(Boolean);
    return new Promise(function (res) {
      var i = 0;
      (function tenta() {
        if (i >= tentativas.length) { item.quebrada = true; return res(false); }
        var src = tentativas[i++];
        var im = new Image();
        var t = setTimeout(function () { im.onload = im.onerror = null; tenta(); }, 9000);
        im.onload = function () { clearTimeout(t); item.urlOk = src; res(true); };
        im.onerror = function () { clearTimeout(t); tenta(); };
        im.src = src;
      })();
    });
  }

  /* Video: so descobre qual endereco funciona e quanto tempo dura. Nao baixa
     o arquivo inteiro de proposito - um video de 200 MB derrubaria a pagina.
     Se nenhum endereco servir, cai no player do proprio Drive (iframe). */
  function precarregarVideo(item) {
    if (item.urlOk || item.usarIframe) return Promise.resolve(true);
    var tentativas = (item.urls || [item.url]).filter(Boolean);
    return new Promise(function (res) {
      var i = 0;
      (function tenta() {
        if (i >= tentativas.length) {
          if (item.urlIframe) { item.usarIframe = true; return res(true); }
          item.quebrada = true;
          return res(false);
        }
        var src = tentativas[i++];
        var v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        var fim = false;
        var t = setTimeout(function () { if (!fim) { fim = true; limpa(); tenta(); } }, 12000);
        function limpa() {
          clearTimeout(t);
          v.onloadedmetadata = v.onerror = null;
          try { v.removeAttribute('src'); v.load(); } catch (e) {}
        }
        v.onloadedmetadata = function () {
          if (fim) return; fim = true;
          item.duracao = isFinite(v.duration) ? v.duration : 0;
          item.urlOk = src;
          limpa(); res(true);
        };
        v.onerror = function () { if (fim) return; fim = true; limpa(); tenta(); };
        v.src = src;
      })();
    });
  }

  function precarregar(item) {
    return ehVideo(item) ? precarregarVideo(item) : precarregarImagem(item);
  }

  /* ------------------------------------------- baixar tudo em 2o plano

     Puxa as imagens assim que a pagina abre, antes de precisar delas.
     Nao guardamos os objetos Image em memoria de proposito: o que importa e
     que os bytes fiquem no cache do navegador. Assim uma pasta grande nao
     estoura a RAM, e se a internet cair no meio da apresentacao as fotos ja
     baixadas continuam aparecendo normalmente.                              */

  var prefetchRodando = false;

  function jaResolvido(f) { return !!(f.urlOk || f.usarIframe || f.quebrada); }

  function atualizaProgresso() {
    var el = $('#menu-rodape');
    if (!el) return;
    var nota = notaAtualizacao();

    if (!CFG.baixarTudo || !itens.length) { el.textContent = nota; return; }

    var imgs = 0, prontas = 0;
    for (var i = 0; i < itens.length; i++) {
      if (itens[i].tipo !== 'imagem') continue;
      imgs++;
      if (jaResolvido(itens[i])) prontas++;
    }

    if (!imgs) { el.textContent = nota; return; }

    if (prontas >= imgs) {
      var extra = contarVideos()
        ? ' — vídeos tocam direto do Drive, sem baixar antes'
        : ' — a passagem não depende mais da internet';
      el.textContent = imgs + ' imagens já baixadas' + extra +
        (nota ? '  ·  ' + nota : '');
    } else {
      el.textContent = 'baixando tudo para não depender da conexão…  ' + prontas + ' / ' + imgs;
    }
  }

  function baixarTudo() {
    if (!CFG.baixarTudo || prefetchRodando) return;
    prefetchRodando = true;

    var i = 0, ativos = 0;
    var limite = Math.max(1, CFG.baixarDeCadaVez);

    function passo() {
      while (ativos < limite && i < itens.length) {
        var f = itens[i++];
        if (jaResolvido(f)) continue;
        ativos++;
        precarregar(f).then(function () {
          ativos--;
          atualizaProgresso();
          passo();
        });
      }
      if (ativos === 0 && i >= itens.length) {
        prefetchRodando = false;
        atualizaProgresso();
      }
    }
    passo();
  }

  /* ------------------------------------------------------------- baralho */

  function reconstruirItens() {
    itens = todos.filter(function (f) {
      if (f.tipo === 'audio') return false;
      if (f.tipo === 'video' && !CFG.incluirVideos) return false;
      return true;
    });
  }

  function novaRodada(reiniciando) {
    var lista = itens.filter(function (f) { return !f.quebrada; });
    if (CFG.embaralhar) embaralha(lista);

    // nao emendar a rodada nova com a mesma que acabou de sair da tela
    if (lista.length > 1 && atual && lista[0].id === atual.id) {
      var t = lista[0]; lista[0] = lista[1]; lista[1] = t;
    }

    fila = lista;
    naRodada = 0;
    if (reiniciando) { historico = []; histPos = -1; rodada = 1; }
  }

  /* Devolve o proximo item, tirando da fila. Nunca repete dentro da rodada. */
  function puxarDaFila() {
    var voltas = 0;
    while (voltas++ <= itens.length + 2) {
      if (!fila.length) {
        if (!itens.length) return null;
        rodada++;
        novaRodada(false);
        if (!fila.length) return null;
      }
      var it = fila.shift();
      if (!it || it.quebrada) continue;

      historico.push({ item: it, n: ++naRodada, rodada: rodada });
      if (historico.length > MAX_HISTORICO) historico.shift();
      histPos = historico.length - 1;
      return it;
    }
    return null;
  }

  /* Entram itens novos no meio de uma rodada ja em andamento. */
  function encaixarNovos(novos) {
    if (!novos.length) return;
    var entram = novos.filter(function (f) {
      return f.tipo !== 'audio' && (f.tipo !== 'video' || CFG.incluirVideos);
    });
    if (!entram.length) return;

    if (CFG.embaralhar) embaralha(entram);

    if (CFG.novasNaFrente && tela === 'slideshow' && !modoNav) {
      // logo depois da atual, para a novidade aparecer na hora
      Array.prototype.splice.apply(fila, [Math.min(1, fila.length), 0].concat(entram));
    } else if (CFG.embaralhar) {
      // espalha pelo resto da rodada, sem furar a regra de nao repetir
      for (var i = 0; i < entram.length; i++) {
        fila.splice(Math.floor(Math.random() * (fila.length + 1)), 0, entram[i]);
      }
    } else {
      fila = fila.concat(entram);
    }
  }

  function tirarDaFila(sumiram) {
    if (!sumiram.length) return;
    var fora = {};
    for (var i = 0; i < sumiram.length; i++) fora[sumiram[i].id] = true;
    fila = fila.filter(function (f) { return !fora[f.id]; });
    var antes = historico.length;
    historico = historico.filter(function (h, n) {
      if (!fora[h.item.id]) return true;
      if (n <= histPos) histPos--;
      return false;
    });
    if (antes !== historico.length) histPos = Math.min(histPos, historico.length - 1);
  }

  /* --------------------------------------------------------- exibicao */

  function camadaDe(i) { return camadas[i]; }

  function limparCamada(el) {
    var v = el.querySelector('video');
    var f = el.querySelector('iframe');
    try { v.pause(); } catch (e) {}
    v.onended = v.onerror = v.onplaying = null;
    if (v.getAttribute('src')) { v.removeAttribute('src'); try { v.load(); } catch (e) {} }
    if (f.getAttribute('src')) f.removeAttribute('src');
    el.classList.remove('mostra-img', 'mostra-video', 'mostra-iframe');
    el.__item = null;
  }

  function pararMidias() {
    for (var i = 0; i < camadas.length; i++) {
      var v = camadas[i].querySelector('video');
      try { v.pause(); } catch (e) {}
      var f = camadas[i].querySelector('iframe');
      if (f.getAttribute('src')) f.removeAttribute('src');
    }
    clearTimeout(timerAudio);
    Trilha.abafar(false);
  }

  /* Monta o item dentro de uma camada, sem mexer na visibilidade. */
  function montarNaCamada(el, item) {
    if (el.__item === item) return;      // ja engatilhado pelo prepararProximo
    limparCamada(el);
    el.__item = item;

    if (ehVideo(item)) {
      if (item.usarIframe) {
        el.querySelector('iframe').src = item.urlIframe;
        el.classList.add('mostra-iframe');
      } else {
        var v = el.querySelector('video');
        v.src = item.urlOk || item.urls[0];
        v.currentTime = 0;
        v.muted = false;
        v.volume = 1;
        el.classList.add('mostra-video');
      }
    } else {
      el.querySelector('img').src = item.urlOk || item.urls[0];
      el.classList.add('mostra-img');
    }
  }

  /* Deixa o proximo item pronto na camada reserva: video ja carregado
     significa que a troca acontece sem engasgo. */
  function prepararProximo() {
    var prox = fila.length ? fila[0] : null;
    if (modoNav) prox = navLista[(navIdx + 1) % (navLista.length || 1)];
    if (!prox || prox === atual) return;

    precarregar(prox).then(function () {
      // so engatilha se nesse meio tempo ele continuar sendo o proximo
      var aindaEProximo = modoNav
        ? navLista[(navIdx + 1) % (navLista.length || 1)] === prox
        : fila[0] === prox;
      if (!aindaEProximo) return;
      if (ehVideo(prox) && !prox.usarIframe) montarNaCamada(camadas[1 - cam], prox);
    });
  }

  // instantaneo = true -> troca seca, sem crossfade (setas, clique, galeria)
  function trocarCamada(item, instantaneo) {
    var prox = camadas[1 - cam], velha = camadas[cam];

    montarNaCamada(prox, item);

    if (instantaneo) { prox.classList.add('instantaneo'); velha.classList.add('instantaneo'); }

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

    // a camada que saiu so e desmontada depois do fade, senao pisca.
    // se nesse meio tempo o prepararProximo ja engatilhou outra coisa nela,
    // deixa quieto - senao jogariamos fora o video que acabou de carregar
    var itemQueSaiu = velha.__item;
    var atrasoLimpeza = instantaneo ? 60 : CFG.fade + 120;
    setTimeout(function () {
      if (camadas[cam] !== velha && velha.__item === itemQueSaiu) limparCamada(velha);
    }, atrasoLimpeza);

    if (ehVideo(item)) tocarVideo(prox, item);
    else { clearTimeout(timerAudio); Trilha.abafar(false); }
  }

  /* -------------------------------------------------------------- video */

  function temAudio(v) {
    if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
    if (typeof v.webkitAudioDecodedByteCount === 'number') return v.webkitAudioDecodedByteCount > 0;
    if (v.audioTracks && typeof v.audioTracks.length === 'number') return v.audioTracks.length > 0;
    return true;
  }

  function tocarVideo(el, item) {
    var meu = ++token;

    if (item.usarIframe) {
      // dentro do iframe o player e do Drive: nao da para saber quando acabou
      Trilha.abafar(true);
      if (!pausado && !modoNav) {
        clearTimeout(timerItem);
        timerItem = setTimeout(function () {
          if (meu === token) ir(1, false);
        }, Math.max(5, CFG.segundosVideo) * 1000);
      }
      return;
    }

    var v = el.querySelector('video');

    // enquanto nao sabemos se o video tem som, abaixa a trilha por garantia
    Trilha.abafar(true);
    clearTimeout(timerAudio);
    timerAudio = setTimeout(function () {
      if (meu !== token) return;
      Trilha.abafar(!v.muted && temAudio(v));
    }, 900);

    v.onended = function () {
      if (meu !== token || modoNav) return;
      Trilha.abafar(false);
      ir(1, false);
    };
    v.onerror = function () {
      if (meu !== token) return;
      item.urlOk = null;
      item.usarIframe = !!item.urlIframe;
      if (!item.usarIframe) item.quebrada = true;
      ir(1, true);
    };

    v.play().catch(function () {
      // o navegador barrou o som sem gesto do usuario: toca mudo, que ele deixa
      v.muted = true;
      Trilha.abafar(false);
      v.play().catch(function () {});
    });

    // rede de seguranca: se o "ended" nao vier, o slideshow nao pode travar
    if (!pausado && !modoNav) {
      var limite = CFG.maxSegundosVideo > 0
        ? CFG.maxSegundosVideo
        : (item.duracao > 0 ? item.duracao + 6 : 90);
      clearTimeout(timerItem);
      timerItem = setTimeout(function () {
        if (meu === token) ir(1, false);
      }, limite * 1000);
    }
  }

  /* ---------------------------------------------------------- legendas */

  function atualizaLegendas(item) {
    $('#selo-txt').textContent = CFG.tituloSelo;
    $('#selo').classList.toggle('on', ehIA(item));

    var elNome = $('#nome');
    if (CFG.mostrarNome && item.nome) {
      var limpo = item.nome.replace(/\.[a-z0-9]+$/i, '');
      elNome.textContent = item.pasta ? item.pasta + '  ·  ' + limpo : limpo;
      elNome.classList.remove('sumiu');
    } else {
      elNome.classList.add('sumiu');
    }

    var hud = $('#hud');
    if (CFG.mostrarContador && itens.length) {
      var h = historico[histPos];
      hud.textContent = modoNav
        ? (navIdx + 1) + ' / ' + navLista.length
        : ((h ? h.n : 1) + ' / ' + itens.length);
      hud.classList.remove('sumiu');
    } else {
      hud.classList.add('sumiu');
    }
  }

  function agenda() {
    // o video ja marcou o proprio relogio dentro do tocarVideo(): mexer no
    // timerItem aqui apagaria ele e o slideshow ficaria preso no video
    if (ehVideo(atual) && !pausado && !modoNav && tela === 'slideshow') return;

    clearTimeout(timerItem);
    if (pausado || modoNav || tela !== 'slideshow') return;
    if (ehVideo(atual)) return;
    timerItem = setTimeout(function () { ir(1, false); }, CFG.segundos * 1000);
  }

  /* --------------------------------------------------------- navegacao */

  function proximoItem(delta) {
    if (modoNav) {
      if (!navLista.length) return null;
      navIdx = ((navIdx + delta) % navLista.length + navLista.length) % navLista.length;
      return navLista[navIdx];
    }

    if (delta > 0) {
      if (histPos < historico.length - 1) { histPos++; return historico[histPos].item; }
      return puxarDaFila();
    }

    if (histPos > 0) { histPos--; return historico[histPos].item; }
    return historico.length ? historico[histPos].item : null;
  }

  function ir(delta, instantaneo) {
    if (trocando) return;
    clearTimeout(timerItem);

    var vivos = 0;
    for (var i = 0; i < itens.length; i++) if (!itens[i].quebrada) vivos++;
    if (!vivos) {
      aviso('Nenhum arquivo pôde ser exibido',
        'A pasta tem arquivos, mas nenhum carregou. Confira se o compartilhamento está como ' +
        '<code>Qualquer pessoa com o link</code>.', true);
      return;
    }

    var item = proximoItem(delta);
    if (!item) return;

    trocando = true;
    precarregar(item).then(function (ok) {
      trocando = false;
      if (!ok) return ir(delta, instantaneo);

      atual = item;
      token++;                       // qualquer callback de video antigo morre aqui
      trocarCamada(item, instantaneo);
      atualizaLegendas(item);
      $('#aviso').classList.add('off');
      agenda();
      prepararProximo();
    });
  }

  function abrirSlideshow(de, itemInicial) {
    origem = de;
    modoNav = (de === 'galeria' && itemInicial !== undefined);
    pausado = false;
    $('#pausa').classList.remove('on');
    $('#dica').classList.remove('sumiu');
    setTimeout(function () { $('#dica').classList.add('sumiu'); }, 9000);

    if (modoNav) {
      navLista = ordemGaleria();
      navIdx = navLista.indexOf(itemInicial);
      if (navIdx < 0) navIdx = 0;
      navIdx--;                       // o ir(1) logo abaixo cai no item certo
    } else {
      novaRodada(true);
      // a musica so consegue tocar a partir de um clique do usuario:
      // este e o clique.
      if (CFG.musica) { Trilha.definirVolume(CFG.volume); Trilha.ligar(); }
    }

    irPara('slideshow');
    ir(1, true);                      // a primeira aparece direto, sem fade de abertura
  }

  function voltar() {
    clearTimeout(timerItem);
    if (tela === 'slideshow') irPara(origem);
    else if (tela === 'galeria') irPara('menu');
  }

  function togglePausa() {
    if (tela !== 'slideshow' || modoNav) return;
    pausado = !pausado;
    $('#pausa').classList.toggle('on', pausado);

    var v = camadas[cam].querySelector('video');
    if (ehVideo(atual) && !atual.usarIframe) {
      if (pausado) { try { v.pause(); } catch (e) {} }
      else { v.play().catch(function () {}); }
    }

    if (pausado) clearTimeout(timerItem);
    else if (ehVideo(atual)) tocarVideo(camadas[cam], atual);
    else agenda();
  }

  /* ------------------------------------------------------------- galeria */

  // a galeria mostra na ordem original da pasta, mesmo com o slideshow embaralhado
  function ordemGaleria() {
    return itens.slice().sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
  }

  function montarGrade(forcar) {
    var lista = ordemGaleria();
    $('#galeria-conta').textContent = lista.length + (lista.length === 1 ? ' arquivo' : ' arquivos');

    if (!forcar && gradeMontada === lista.length) return;
    var grade = $('#grade');
    grade.innerHTML = '';

    if (!lista.length) {
      grade.innerHTML = '<div class="vazio">Nenhum arquivo na pasta ainda.</div>';
      gradeMontada = 0;
      return;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < lista.length; i++) {
      (function (item, n) {
        var cel = document.createElement('div');
        cel.className = 'cel' + (ehVideo(item) ? ' video' : '');
        cel.title = (item.pasta ? item.pasta + '  ·  ' : '') + item.nome;

        var im = document.createElement('img');
        im.loading = 'lazy';
        im.decoding = 'async';
        im.alt = item.nome || '';
        im.onload = function () { im.classList.add('ok'); };
        im.onerror = function () {
          var alt = (item.urls || [])[1];
          if (alt && im.src !== alt) im.src = alt;
        };
        if (item.urlThumb) im.src = item.urlThumb;
        cel.appendChild(im);

        if (ehVideo(item)) {
          var pl = document.createElement('span');
          pl.className = 'play';
          pl.innerHTML = '&#9654;';
          cel.appendChild(pl);
        }

        if (ehIA(item)) {
          var tg = document.createElement('span');
          tg.className = 'tag';
          tg.textContent = 'IA';
          cel.appendChild(tg);
        }

        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = n;
        cel.appendChild(num);

        cel.addEventListener('click', function () { abrirSlideshow('galeria', item); });

        frag.appendChild(cel);
      })(lista[i], i + 1);
    }
    grade.appendChild(frag);
    gradeMontada = lista.length;
  }

  /* -------------------------------------------------- lista de arquivos */

  function sincronizar(primeira) {
    return Promise.resolve()
      .then(function () { return carregarFotos(); })
      .then(function (lista) {
        lista = lista || [];

        if (!lista.length) {
          if (primeira) {
            aviso('A pasta está vazia',
              'Nenhum arquivo encontrado. Assim que as primeiras fotos entrarem no Drive, ' +
              'esta página as encontra sozinha — ela reconsulta a pasta a cada ' +
              Math.max(1, Math.round(CFG.atualizarACada / 60)) + ' min.', true);
          }
          return;
        }

        var jaTinha = {};
        for (var i = 0; i < todos.length; i++) jaTinha[todos[i].id] = true;

        var idsAgora = {}, novos = [];
        for (var j = 0; j < lista.length; j++) {
          var f = lista[j];
          if (idsAgora[f.id]) continue;      // cinto e suspensorio contra repetida
          idsAgora[f.id] = true;
          f.ord = j;                         // posicao na pasta, para a galeria
          if (!jaTinha[f.id]) novos.push(f);
        }

        // preserva o estado (urlOk, duracao, quebrada) do que ja conheciamos
        var antigos = {};
        for (var m = 0; m < todos.length; m++) antigos[todos[m].id] = todos[m];

        var sumiram = todos.filter(function (f) {
          return !idsAgora[f.id] && f !== atual;
        });

        var novaTodos = [];
        for (var n = 0; n < lista.length; n++) {
          var f2 = lista[n];
          if (antigos[f2.id]) {
            antigos[f2.id].ord = f2.ord;
            novaTodos.push(antigos[f2.id]);
          } else {
            novaTodos.push(f2);
          }
        }
        if (atual && !idsAgora[atual.id]) novaTodos.push(atual);
        todos = novaTodos;

        audios = todos.filter(function (f) { return f.tipo === 'audio'; });
        Trilha.definirFaixasDoDrive(audios);

        reconstruirItens();
        tirarDaFila(sumiram);

        if (primeira) {
          novaRodada(true);
          if (CFG.pularMenu) abrirSlideshow('menu');
          else irPara('menu');
        } else {
          encaixarNovos(novos);
          if (tela === 'menu') atualizaMenu();
          if (tela === 'galeria') montarGrade(true);
          if (novos.length) {
            var nf = novos.filter(function (f) { return f.tipo !== 'audio'; }).length;
            if (nf) toast('+' + plural(nf, 'arquivo novo', 'arquivos novos'));
          }
        }

        baixarTudo();
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

    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toast(alternarMusica() ? 'música ligada' : 'música desligada');
      return;
    }

    if (tela === 'menu') {
      if (e.key === 'Enter') { e.preventDefault(); abrirSlideshow('menu'); }
      return;
    }
    if (tela !== 'slideshow') return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(1, true); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(-1, true); }
    else if (e.key === ' ') { e.preventDefault(); togglePausa(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); telaCheia(); }
    else if (e.key === 'r' || e.key === 'R') { sincronizar(false); toast('procurando arquivos novos…'); }
  });

  document.addEventListener('click', function (e) {
    if (tela !== 'slideshow') return;
    if (e.target.closest && e.target.closest('button')) return;
    // clicar em cima de um video e para controlar o video, nao para avancar
    if (e.target.tagName === 'VIDEO' || e.target.tagName === 'IFRAME') return;
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

    lerAjustesSalvos();
    ligarAjustes();
    pintarAjustes();

    $('#bt-slideshow').addEventListener('click', function () { abrirSlideshow('menu'); });
    $('#bt-slideshow-2').addEventListener('click', function () { abrirSlideshow('galeria'); });
    $('#bt-galeria').addEventListener('click', function () { irPara('galeria'); });
    $('#bt-voltar').addEventListener('click', voltar);
    $('#bt-voltar-menu').addEventListener('click', voltar);

    mexeuMouse();
    sincronizar(true);

    if (CFG.atualizarACada > 0) {
      setInterval(function () { sincronizar(false); }, CFG.atualizarACada * 1000);
    }

    // atalho de diagnostico: window.__estado() no console mostra o baralho
    window.__estado = function () {
      return {
        total: itens.length, rodada: rodada,
        naRodada: historico[histPos] ? historico[histPos].n : 0, faltam: fila.length,
        atual: atual && atual.nome, musica: Trilha.estaLigada()
      };
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
