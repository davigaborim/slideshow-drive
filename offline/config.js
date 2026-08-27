/* Ajustes da versao offline (le a pasta ./fotos, sem internet). */
window.CFG = {
  titulo: 'Fotos da turma',
  segundos: 3,
  fade: 1200,
  atualizarACada: 0,      // offline nao tem o que reconsultar
  embaralhar: true,
  pularMenu: false,

  incluirVideos: true,
  maxSegundosVideo: 0,

  musica: false,          // se houver mp3 dentro de ./fotos, ele e usado
  volume: 0.35,
  musicaUrl: '',

  baixarTudo: false,      // ja estao no disco
  mostrarNome: false,
  mostrarContador: true,
  prefixoIA: 'IA_',
  tituloSelo: 'processada com IA',
  lembrarAjustes: true
};
