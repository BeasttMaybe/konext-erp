// Carregado por NODE_OPTIONS=--require: aponta o driver do Neon para a ponte.
function configurar(neonConfig) {
  neonConfig.wsProxy = (host, porta) => `127.0.0.1:5488/v1?address=${host}:${porta}`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}
try {
  const raiz = process.env.RAIZ_DO_PROJETO;
  configurar(require(require.resolve("@neondatabase/serverless", { paths: [raiz] })).neonConfig);
  import(require("node:url").pathToFileURL(require.resolve("@neondatabase/serverless", { paths: [raiz] }).replace(/index\.js$/, "index.mjs")).href)
    .then((m) => configurar(m.neonConfig))
    .catch(() => {});
} catch (erro) {
  console.error("preparar-neon falhou:", erro.message);
}
