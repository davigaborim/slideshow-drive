/* Monta as URLs de cada item a partir do id do arquivo no Drive.
   Compartilhado pelas fontes "web" (JSONP) e "apps script".

   Item de entrada  : { id, nome, tipo, tamanho, pasta, criado }
   Item de saida    : + { urls[], urlThumb, urlIframe }

   urls[] e uma lista de tentativas em ordem: o motor usa a primeira que
   carregar. Imagem e video do Drive nao tem uma URL unica que funcione
   sempre, entao vale ter plano B. */

function montarMidia(f) {
  var id = f.id;
  var tipo = f.tipo || 'imagem';

  var item = {
    id: id,
    nome: f.nome || f.name || '',
    tipo: tipo,
    tamanho: f.tamanho || 0,
    pasta: f.pasta || '',
    criado: f.criado || 0
  };

  if (tipo === 'imagem') {
    item.urls = [
      'https://lh3.googleusercontent.com/d/' + id + '=w2048',
      'https://drive.google.com/thumbnail?id=' + id + '&sz=w2048'
    ];
    item.urlThumb = 'https://lh3.googleusercontent.com/d/' + id + '=w400';
  } else {
    // video e audio saem pelo endpoint de download do Drive; o <video>/<audio>
    // aceita cross-origin sem CORS, e o servidor responde a Range (permite pular)
    item.urls = [
      'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t',
      'https://drive.google.com/uc?export=download&id=' + id
    ];
    // ultimo recurso para video: o player do proprio Drive, dentro de um iframe
    item.urlIframe = 'https://drive.google.com/file/d/' + id + '/preview';
    item.urlThumb = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
  }

  // compatibilidade com o codigo antigo
  item.url = item.urls[0];
  item.urlAlt = item.urls[1];
  return item;
}
