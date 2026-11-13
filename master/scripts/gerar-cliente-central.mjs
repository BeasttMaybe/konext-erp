// Gera o cliente Prisma do banco CENTRAL para o master a partir do schema
// UNICO do ERP (../prisma/central/schema.prisma) — o master nunca tem uma
// copia propria do schema, entao os dois nao divergem.
//
// So muda o destino do cliente gerado (para o node_modules do master) e grava
// a versao ajustada em prisma/gerado/ (fora do git).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizDoMaster = path.resolve(aqui, "..");
const origem = path.resolve(raizDoMaster, "../prisma/central/schema.prisma");
const destino = path.resolve(raizDoMaster, "prisma/gerado/central.prisma");

const schema = readFileSync(origem, "utf8");
// prisma/gerado/ fica dois niveis abaixo de master/, entao este caminho cai
// em master/node_modules (no ERP, o mesmo texto cai no node_modules da raiz).
const SAIDA = 'output     = "../../node_modules/@prisma/client-central"';
if (!/output\s*=\s*"[^"]*"/.test(schema)) {
  throw new Error("gerador do schema central sem 'output' — conferir prisma/central/schema.prisma");
}
const ajustado = schema.replace(/output\s*=\s*"[^"]*"/, SAIDA);

mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, `// GERADO de ../prisma/central/schema.prisma — nao editar.\n${ajustado}`);
execFileSync("npx", ["prisma", "generate", "--schema", destino], { cwd: raizDoMaster, stdio: "inherit" });
