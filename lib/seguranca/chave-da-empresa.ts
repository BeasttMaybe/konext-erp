import "server-only";

import { prismaCentral } from "@/lib/central/prisma-central";
import {
  abrir,
  cifrar,
  CONTEXTO_DESENHO_DO_APARELHO,
  CONTEXTO_SENHA_DO_APARELHO,
  gerarChave,
  lerChave,
} from "@/lib/seguranca/cifra";

/**
 * Chave de cifra da loja, guardada no banco CENTRAL (ChaveDeCifraEmpresa) —
 * separada do banco da loja, onde ficam os dados cifrados.
 *
 * Criada na primeira vez que a loja precisa. Duas requisicoes simultaneas
 * podem tentar criar: a chave primaria (empresaId) deixa so uma vencer, e a
 * outra rele a vencedora — nunca existem duas chaves para a mesma loja.
 *
 * Fica em memoria no processo depois da primeira leitura: a chave nunca muda.
 */
const cache = new Map<string, Buffer>();

export async function chaveDaEmpresa(empresaId: string): Promise<Buffer> {
  const emCache = cache.get(empresaId);
  if (emCache) return emCache;

  let linha = await prismaCentral.chaveDeCifraEmpresa.findUnique({ where: { empresaId }, select: { chave: true } });
  if (!linha) {
    await prismaCentral.chaveDeCifraEmpresa.createMany({
      data: [{ empresaId, chave: gerarChave() }],
      skipDuplicates: true,
    });
    linha = await prismaCentral.chaveDeCifraEmpresa.findUnique({ where: { empresaId }, select: { chave: true } });
  }
  if (!linha) throw new Error("Nao foi possivel obter a chave de cifra da loja.");

  const chave = lerChave(linha.chave);
  cache.set(empresaId, chave);
  return chave;
}

export type SenhasDoAparelho = { senha: string | null; senhaDesenho: string | null };

/** Para gravar: cifra o que veio preenchido; vazio vira null. */
export async function protegerSenhasDoAparelho(empresaId: string, senhas: SenhasDoAparelho): Promise<SenhasDoAparelho> {
  const senha = senhas.senha?.trim() || null;
  const senhaDesenho = senhas.senhaDesenho?.trim() || null;
  if (!senha && !senhaDesenho) return { senha: null, senhaDesenho: null };
  const chave = await chaveDaEmpresa(empresaId);
  return {
    senha: senha ? cifrar(senha, chave, CONTEXTO_SENHA_DO_APARELHO) : null,
    senhaDesenho: senhaDesenho ? cifrar(senhaDesenho, chave, CONTEXTO_DESENHO_DO_APARELHO) : null,
  };
}

/** Para mostrar: abre os cifrados; texto puro antigo passa como esta. */
export async function abrirSenhasDoAparelho(empresaId: string, senhas: SenhasDoAparelho): Promise<SenhasDoAparelho> {
  if (!senhas.senha && !senhas.senhaDesenho) return { senha: null, senhaDesenho: null };
  const chave = await chaveDaEmpresa(empresaId);
  return {
    senha: abrir(senhas.senha, chave, CONTEXTO_SENHA_DO_APARELHO),
    senhaDesenho: abrir(senhas.senhaDesenho, chave, CONTEXTO_DESENHO_DO_APARELHO),
  };
}
