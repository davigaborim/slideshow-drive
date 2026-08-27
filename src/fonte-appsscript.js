/* Fonte dos arquivos: funcao listarFotos() do Codigo.gs, rodando no servidor
   do Apps Script. Nao existe chave de API aqui - quem le a pasta e a sua conta
   Google. O servidor manda so { id, nome, tipo, tamanho, pasta, criado };
   as URLs sao montadas aqui pelo montarMidia(). */
function carregarFotos() {
  return new Promise(function (res, rej) {
    google.script.run
      .withSuccessHandler(function (lista) {
        res((lista || []).map(montarMidia));
      })
      .withFailureHandler(function (e) {
        rej(new Error(e && e.message ? e.message : String(e)));
      })
      .listarFotos();
  });
}
