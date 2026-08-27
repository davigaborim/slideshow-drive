/* =====================================================================
   Ajustes do slideshow. Este arquivo nunca e sobrescrito pelo build.sh -
   pode editar a vontade. Depois de editar:
     bash build.sh && git add -A && git commit -m "ajustes" && git push
     git subtree push --prefix web origin gh-pages
   ===================================================================== */
window.CFG = {

  // ---------- MODO 1 (em uso): sem chave de API ----------
  // URL /exec da implantacao do Apps Script. E ele que le a pasta do Drive.
  endpointAppsScript:
    'https://script.google.com/macros/s/AKfycbzH9XGV4-Ws6RG-MqS4VCgQV4GDEME2M8qak7mW-0tqOabkA0a47QWWyxr_Bes-Jdvw/exec',

  // ---------- MODO 2: direto na API do Drive ----------
  // So e usado se endpointAppsScript ficar vazio.
  pastaId: '1YO_R4YttUszffoXcyW4gjmNdKIbIERkb',
  apiKey: 'COLE_A_CHAVE_AQUI',

  // ------------------------------- exibicao
  titulo: 'Fotos da turma',
  segundos: 3,            // tempo de cada FOTO (o video usa a duracao dele)
  fade: 1200,             // crossfade em ms, so no avanco automatico
  embaralhar: true,       // ordem aleatoria, sem repetir ate passar por todas
  pularMenu: false,       // true = abre direto no slideshow

  // ------------------------------- videos
  incluirVideos: true,    // toca os videos da pasta junto com as fotos
  maxSegundosVideo: 0,    // 0 = deixa o video inteiro; 45 = corta em 45 s
  segundosVideo: 30,      // so para video que caiu no player do Drive (iframe)

  // ------------------------------- musica de fundo
  musica: false,          // liga ja ao abrir (da para ligar na tela inicial tambem)
  volume: 0.35,
  musicaUrl: '',          // mp3 avulso; vazio = usa audio da pasta, ou som gerado

  // ------------------------------- atualizacao e cache
  atualizarACada: 180,    // reconsulta a pasta a cada X segundos (0 desliga)
  novasNaFrente: true,    // arquivo recem-enviado entra logo depois do atual
  baixarTudo: true,       // baixa as imagens de cara, para nao depender da conexao
  baixarDeCadaVez: 4,

  // ------------------------------- detalhes
  mostrarNome: false,
  mostrarContador: true,
  prefixoIA: 'IA_',
  tituloSelo: 'processada com IA',
  lembrarAjustes: true    // guarda o que foi mexido no painel, neste navegador
};
