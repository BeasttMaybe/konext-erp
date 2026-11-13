// Gera os clientes Prisma do master a partir dos schemas UNICOS do ERP — o
// master nunca tem copia propria de schema, entao os dois nao divergem:
//
// - banco CENTRAL (../prisma/central/schema.prisma) -> @prisma/client-central
// - banco da LOJA (../prisma/schema.prisma) -> @prisma/client (o padrao). O
//   master so usa este para preparar o banco de uma loja nova (configuracao
//   inicial, consumidor final, usuario do dono).
//
// So muda o destino do cliente gerado (para o node_modules do master) e grava
// as versoes ajustadas em prisma/gerado/ (fora do git).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizDoMaster = path.resolve(aqui, "..");

function gerar(origemRelativa, destinoNome, ajustar) {
  const origem = path.resolve(raizDoMaster, origemRelativa);
  const destino = path.resolve(raizDoMaster, "prisma/gerado", destinoNome);
  const ajustado = ajustar(readFileSync(origem, "utf8"));
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, `// GERADO de ${origemRelativa} — nao editar.\n${ajustado}`);
  execFileSync("npx", ["prisma", "generate", "--schema", destino], { cwd: raizDoMaster, stdio: "inherit" });
}

// prisma/gerado/ fica dois niveis abaixo de master/, entao este caminho cai em
// master/node_modules (no ERP, o mesmo texto cai no node_modules da raiz).
gerar("../prisma/central/schema.prisma", "central.prisma", (schema) => {
  if (!/output\s*=\s*"[^"]*"/.test(schema)) {
    throw new Error("gerador do schema central sem 'output' — conferir prisma/central/schema.prisma");
  }
  return schema.replace(/output\s*=\s*"[^"]*"/, 'output     = "../../node_modules/@prisma/client-central"');
});

// Schema da loja sem 'output': o Prisma gera no @prisma/client do master.
gerar("../prisma/schema.prisma", "loja.prisma", (schema) => schema);
