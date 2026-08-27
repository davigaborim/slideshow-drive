/* =========================================================================
   Trilha sonora de fundo.

   De onde vem a musica, nesta ordem:
     1. arquivos de audio que estiverem na propria pasta do Drive
        (mp3, m4a, wav... e so a professora jogar um la);
     2. CFG.musicaUrl  - um endereco de mp3, ou uma lista deles;
     3. nada disso  -> um fundo ambiente gerado na hora pelo proprio
        navegador (Web Audio). Nao baixa arquivo nenhum e nao tem
        questao de direito autoral.

   Regra combinada: quando entra um video, a trilha abaixa ate sumir, para
   valer o audio do video. Quando o video acaba, ela volta sozinha.
   ========================================================================= */
window.Trilha = (function () {
  'use strict';

  var el = null;            // <audio> quando a musica vem de arquivo
  var faixas = [];          // [{ nome, urls: [] }]
  var atual = 0;
  var ligada = false;
  var abafada = false;
  var volume = 0.35;        // 0..1, escolhido pelo usuario
  var ctx = null, mestre = null, gerador = null;
  var rampa = null;

  /* ------------------------------------------------------------- volume */

  function alvoDeVolume() {
    if (!ligada) return 0;
    return abafada ? 0 : volume;
  }

  // sobe/desce devagar: cortar seco estala e chama atencao
  function aplicarVolume(imediato) {
    var v = alvoDeVolume();

    if (mestre && ctx) {
      var agora = ctx.currentTime;
      mestre.gain.cancelScheduledValues(agora);
      mestre.gain.setValueAtTime(mestre.gain.value, agora);
      mestre.gain.linearRampToValueAtTime(v * 0.9, agora + (imediato ? 0.05 : 0.9));
    }

    if (el) {
      clearInterval(rampa);
      if (imediato) { el.volume = v; return; }
      var passos = 18, i = 0, de = el.volume;
      rampa = setInterval(function () {
        i++;
        el.volume = Math.max(0, Math.min(1, de + (v - de) * (i / passos)));
        if (i >= passos) clearInterval(rampa);
      }, 45);
    }
  }

  /* ----------------------------------------------- musica de arquivo */

  function tocarFaixa(n) {
    if (!faixas.length) return;
    atual = ((n % faixas.length) + faixas.length) % faixas.length;
    var f = faixas[atual];
    el.tentativa = 0;
    el.loop = (faixas.length === 1);
    el.src = f.urls[0];
    el.volume = 0;
    el.play().then(function () { aplicarVolume(false); }).catch(function () {});
  }

  function prepararElemento() {
    if (el) return;
    el = document.getElementById('trilha');
    if (!el) { el = document.createElement('audio'); document.body.appendChild(el); }

    el.addEventListener('ended', function () {
      if (faixas.length > 1) tocarFaixa(atual + 1);
    });

    el.addEventListener('error', function () {
      var f = faixas[atual];
      if (!f) return;
      // tenta o endereco alternativo do mesmo arquivo antes de desistir dele
      el.tentativa = (el.tentativa || 0) + 1;
      if (f.urls[el.tentativa]) {
        el.src = f.urls[el.tentativa];
        el.play().catch(function () {});
        return;
      }
      faixas.splice(atual, 1);
      if (faixas.length) tocarFaixa(atual);
      else { desmontarArquivo(); if (ligada) iniciarGerado(); }
    });
  }

  function desmontarArquivo() {
    if (!el) return;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
  }

  /* --------------------------------------------- ambiente gerado na hora

     Um pad de tres notas que troca de acorde a cada 8 s, mais alguns
     toques esparsos de uma escala pentatonica. Pentatonica porque
     qualquer combinacao dela soa consonante: nao tem como sair errado
     no meio da apresentacao.                                             */

  function iniciarGerado() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;

    if (!ctx) {
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = 0;

      var filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 1750;
      filtro.Q.value = 0.6;

      mestre.connect(filtro);
      filtro.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (gerador) return true;

    var escala = [0, 2, 4, 7, 9];            // pentatonica maior
    var acordes = [0, -3, -5, 2];            // sequencia de raizes, em semitons
    var base = 174.6;                        // fa3
    var t = ctx.currentTime + 0.3;
    var compasso = 0;

    function hz(st) { return base * Math.pow(2, st / 12); }

    function nota(freq, quando, dur, vol, tipo) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, quando);
      g.gain.linearRampToValueAtTime(vol, quando + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
      o.connect(g); g.connect(mestre);
      o.start(quando);
      o.stop(quando + dur + 0.06);
    }

    function proximoCompasso() {
      var raiz = acordes[compasso % acordes.length];

      // o pad sustentado
      var triade = [0, 4, 7];
      for (var i = 0; i < triade.length; i++) {
        nota(hz(raiz + triade[i] - 12), t, 9, 0.075, 'sine');
      }

      // toques soltos por cima
      for (var j = 0; j < 6; j++) {
        if (Math.random() > 0.5) {
          var grau = escala[Math.floor(Math.random() * escala.length)];
          var oitava = Math.random() < 0.4 ? 12 : 0;
          nota(hz(raiz + grau + oitava), t + j * 1.3 + Math.random() * 0.35,
               2.4, 0.05, 'triangle');
        }
      }

      t += 8;
      compasso++;
    }

    proximoCompasso();
    gerador = setInterval(function () {
      if (!ctx) return;
      // mantem sempre uns 10 s agendados a frente
      while (t - ctx.currentTime < 10) proximoCompasso();
    }, 1500);

    return true;
  }

  function pararGerado() {
    clearInterval(gerador);
    gerador = null;
  }

  /* ------------------------------------------------------------- publico */

  return {
    /* Recebe os audios achados na pasta. Chamado a cada sincronizacao. */
    definirFaixasDoDrive: function (lista) {
      var novas = (lista || []).map(function (a) {
        return { nome: a.nome, urls: (a.urls && a.urls.length ? a.urls : [a.url]) };
      });

      if (!novas.length && window.CFG && CFG.musicaUrl) {
        var m = CFG.musicaUrl;
        novas = (typeof m === 'string' ? [m] : m).map(function (u) {
          return { nome: String(u).split('/').pop(), urls: [u] };
        });
      }

      var mudou = novas.length !== faixas.length;
      faixas = novas;

      if (ligada && faixas.length) {
        prepararElemento();
        pararGerado();
        if (mudou || !el.src) tocarFaixa(0);
      }
    },

    /* De onde a musica esta saindo, em uma frase, para mostrar no menu. */
    descricao: function () {
      if (!faixas.length) return 'som ambiente gerado no navegador';
      if (faixas.length === 1) return faixas[0].nome.replace(/\.[a-z0-9]+$/i, '');
      return faixas.length + ' músicas da pasta';
    },

    temArquivo: function () { return faixas.length > 0; },

    ligar: function () {
      ligada = true;
      if (faixas.length) {
        prepararElemento();
        pararGerado();
        if (!el.src) tocarFaixa(0);
        else el.play().catch(function () {});
      } else {
        iniciarGerado();
      }
      aplicarVolume(false);
    },

    desligar: function () {
      ligada = false;
      aplicarVolume(false);
      // deixa a rampa terminar antes de cortar de vez
      setTimeout(function () {
        if (ligada) return;
        desmontarArquivo();
        pararGerado();
      }, 1000);
    },

    estaLigada: function () { return ligada; },

    definirVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      aplicarVolume(true);
    },

    /* true enquanto um video com som estiver na tela */
    abafar: function (sim) {
      if (abafada === !!sim) return;
      abafada = !!sim;
      aplicarVolume(false);
    }
  };
})();
