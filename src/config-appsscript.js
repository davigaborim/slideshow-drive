/* Ajustes do slideshow (versao Apps Script).
   O ID da pasta do Drive NAO fica aqui - fica no Codigo.gs, na constante ID_PASTA. */
window.CFG = {
  titulo: 'Fotos da turma',
  segundos: 3,                // tempo de cada FOTO (o video usa a duracao dele)
  fade: 1200,
  embaralhar: true,           // ordem aleatoria, sem repetir ate passar por todas
  pularMenu: false,

  incluirVideos: true,
  maxSegundosVideo: 0,
  segundosVideo: 30,

  musica: false,
  volume: 0.35,
  musicaUrl: '',

  atualizarACada: 180,
  novasNaFrente: true,
  baixarTudo: true,
  baixarDeCadaVez: 4,

  mostrarNome: false,
  mostrarContador: true,
  prefixoIA: 'IA_',
  tituloSelo: 'processada com IA',
  lembrarAjustes: true
};
