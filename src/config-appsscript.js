/* Ajustes do slideshow (versao Apps Script).
   O ID da pasta do Drive NAO fica aqui - fica no Codigo.gs, na constante ID_PASTA. */
window.CFG = {
  titulo: 'Fotos da turma',   // aparece na tela inicial
  segundos: 7,                // tempo de cada foto na tela
  fade: 1500,                 // crossfade em ms (so no avanco automatico)
  atualizarACada: 180,        // reconsulta a pasta a cada X segundos (0 desliga)
  novasNaFrente: true,        // foto recem-enviada entra logo depois da atual
  embaralhar: true,           // ordem aleatoria
  pularMenu: false,           // true = abre direto no slideshow, sem tela inicial
  baixarTudo: true,           // baixa todas as imagens de cara, para nao depender da conexao
  baixarDeCadaVez: 4,
  mostrarNome: false,
  mostrarContador: true,
  prefixoIA: 'IA_',
  tituloSelo: 'processada com IA'
};
