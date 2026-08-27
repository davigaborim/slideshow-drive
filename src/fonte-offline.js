/* Fonte dos arquivos: pasta local ./fotos (com subpastas), listada em lista.js.
   Cada item vem como caminho relativo, ex.: "Dia 1/bastidores/foto.jpg".
   Reconhece foto, video e musica pela extensao. */

var EXT_VIDEO = /\.(mp4|m4v|mov|webm|ogv|avi|mkv)$/i;
var EXT_AUDIO = /\.(mp3|m4a|aac|ogg|oga|wav|flac)$/i;

function carregarFotos() {
  var l = window.FOTOS_LOCAIS || [];
  return Promise.resolve(l.map(function (caminho, i) {
    var partes = caminho.split('/');
    var nome = partes.pop();
    // codifica cada pedaco separado, para nao escapar as barras
    var url = 'fotos/' + caminho.split('/').map(encodeURIComponent).join('/');

    var tipo = EXT_VIDEO.test(nome) ? 'video'
             : EXT_AUDIO.test(nome) ? 'audio'
             : 'imagem';

    return {
      id: 'local-' + i + '-' + caminho,
      nome: nome,
      tipo: tipo,
      tamanho: 0,
      pasta: partes.join(' / '),
      criado: i,
      urls: [url],
      url: url,
      // offline nao tem miniatura pronta: a propria imagem serve.
      // video sem miniatura fica com o cartao escuro e o simbolo de play.
      urlThumb: tipo === 'imagem' ? url : ''
    };
  }));
}
