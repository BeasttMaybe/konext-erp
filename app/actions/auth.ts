"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prismaCentral } from "@/lib/central/prisma-central";
import { COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";
import { criarSessaoCentral, revogarSessaoCentralAtual } from "@/lib/auth/sessao-central";

type LoginState = {
  erro: string | null;
};

const ERRO_CREDENCIAIS = "Credenciais inválidas.";

type ResultadoLoginCentral =
  | { autenticado: true }
  | { autenticado: false };

/**
 * Fluxo unico de autenticacao para todos os usuarios:
 * e-mail + senha -> UsuarioCentral -> hash -> UsuarioEmpresa -> Empresa -> Tenant -> SessaoCentral.
 * Nao existe fallback para o banco operacional.
 */
async function autenticarCentral(email: string, senha: string): Promise<ResultadoLoginCentral> {
  const usuarioCentral = await prismaCentral.usuarioCentral.findUnique({
    where: { email },
    select: {
      id: true,
      senha: true,
      ativo: true,
    },
  });

  if (!usuarioCentral?.ativo || !usuarioCentral.senha) {
    return { autenticado: false };
  }

  let senhaConfere = await bcrypt.compare(senha, usuarioCentral.senha);

  // Tolerancia para input acidental com espacos no inicio/fim.
  const senhaNormalizada = senha.trim();
  if (!senhaConfere && senhaNormalizada !== senha) {
    senhaConfere = await bcrypt.compare(senhaNormalizada, usuarioCentral.senha);
  }

  if (!senhaConfere) {
    return { autenticado: false };
  }

  const vinculos = await prismaCentral.usuarioEmpresa.findMany({
    where: {
      usuarioId: usuarioCentral.id,
      ativo: true,
    },
    select: {
      role: true,
      empresa: {
        select: {
          id: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  const vinculosAtivos = vinculos.filter((vinculo) => vinculo.empresa.status === "ATIVA");

  if (vinculosAtivos.length !== 1) {
    return { autenticado: false };
  }

  const vinculo = vinculosAtivos[0];
  const tenantsAtivos = await prismaCentral.tenant.findMany({
    where: {
      empresaId: vinculo.empresa.id,
      status: "ATIVO",
    },
    select: {
      id: true,
      slug: true,
      connectionRef: true,
    },
  });

  if (tenantsAtivos.length !== 1 || !tenantsAtivos[0].connectionRef) {
    return { autenticado: false };
  }

  const tenant = tenantsAtivos[0];

  await criarSessaoCentral({
    usuarioCentralId: usuarioCentral.id,
    empresaId: vinculo.empresa.id,
    tenantId: tenant.id,
    role: vinculo.role,
  });

  // Remove qualquer cookie legado residual: konext_session nao autentica mais.
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO_LEGADA);

  return { autenticado: true };
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const resultado = await autenticarCentral(email, senha);

  if (!resultado.autenticado) {
    // Mensagem generica: nao revela existencia do e-mail.
    return { erro: ERRO_CREDENCIAIS };
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  await revogarSessaoCentralAtual();
  // Limpeza do cookie legado mantida temporariamente por compatibilidade.
  cookieStore.delete(COOKIE_SESSAO_LEGADA);
  redirect("/login");
}
