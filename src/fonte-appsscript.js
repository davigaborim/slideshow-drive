/* Fonte das fotos: funcao listarFotos() do Codigo.gs, rodando no servidor do Apps Script.
   Nao existe chave de API aqui - quem le a pasta e a sua conta Google.
   O servidor manda so { id, nome, pasta }; as URLs sao montadas aqui. */
function carregarFotos() {
  return new Promise(function (res, rej) {
    google.script.run
      .withSuccessHandler(function (lista) {
        res((lista || []).map(function (f) {
          return {
            id: f.id,
            nome: f.nome,
            pasta: f.pasta || '',
            criado: f.criado || 0,
            url: 'https://lh3.googleusercontent.com/d/' + f.id + '=w2048',
            urlThumb: 'https://lh3.googleusercontent.com/d/' + f.id + '=w400',
            urlAlt: 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w2048'
          };
        }));
      })
      .withFailureHandler(function (e) {
        rej(new Error(e && e.message ? e.message : String(e)));
      })
      .listarFotos();
  });
}
