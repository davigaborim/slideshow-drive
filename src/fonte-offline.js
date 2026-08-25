/* Fonte das fotos: pasta local ./fotos (com subpastas), listada em lista.js.
   Cada item vem como caminho relativo, ex.: "Dia 1/bastidores/foto.jpg". */
function carregarFotos() {
  var l = window.FOTOS_LOCAIS || [];
  return Promise.resolve(l.map(function (caminho, i) {
    var partes = caminho.split('/');
    var nome = partes.pop();
    // codifica cada pedaco separado, para nao escapar as barras
    var url = 'fotos/' + caminho.split('/').map(encodeURIComponent).join('/');
    return {
      id: 'local-' + i + '-' + caminho,
      nome: nome,
      pasta: partes.join(' / '),
      criado: i,
      url: url,
      urlThumb: url   // offline nao tem miniatura: a propria imagem serve
    };
  }));
}
