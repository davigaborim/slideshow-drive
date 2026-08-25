/* =====================================================================
   Escolha UM dos dois modos abaixo. Este arquivo nunca e sobrescrito
   pelo build.sh - pode editar a vontade.
   ===================================================================== */
window.CFG = {

  // ---------- MODO 1 (recomendado): sem chave de API ----------
  // Cole aqui a URL /exec da sua implantacao do Apps Script.
  // A pagina pega a lista de fotos dele, e nao da API do Drive.
  endpointAppsScript: '',

  // ---------- MODO 2: direto na API do Drive ----------
  // So e usado se endpointAppsScript ficar vazio.
  pastaId: '1YO_R4YttUszffoXcyW4gjmNdKIbIERkb',
  apiKey: 'COLE_A_CHAVE_AQUI',

  // ------------------------------- ajustes
  titulo: 'Fotos da turma',
  segundos: 7,
  fade: 1500,
  atualizarACada: 180,
  novasNaFrente: true,
  embaralhar: true,
  pularMenu: false,
  baixarTudo: true,
  baixarDeCadaVez: 4,
  mostrarNome: false,
  mostrarContador: true,
  prefixoIA: 'IA_',
  tituloSelo: 'processada com IA'
};
