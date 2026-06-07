"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

// Numero de rounds do bcrypt. 10 e um bom equilibrio entre seguranca e desempenho.
const FATOR_HASH = 10;

// Senha padrao do admin criado no primeiro boot. Trocar apos o primeiro acesso.
const SENHA_ADMIN_PADRAO = "admin";

/**
 * Gera o hash seguro de uma senha em texto plano.
 */
async function gerarHashSenha(senhaPura: string): Promise<string> {
  return bcrypt.hash(senhaPura, FATOR_HASH);
}

/**
 * Verifica se um valor armazenado parece um hash bcrypt valido
 * (formato $2a$, $2b$ ou $2y$). Usado para suportar migracao suave
 * de senhas legadas que foram salvas em texto plano.
 */
function pareceHashBcrypt(valor: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(valor);
}

type LoginState = {
  erro: string | null;
};

type UsuarioDelegate = {
  findUnique?: (args: unknown) => Promise<any>;
  findFirst?: (args: unknown) => Promise<any>;
  count?: (args?: unknown) => Promise<number>;
  create?: (args: unknown) => Promise<any>;
  update?: (args: unknown) => Promise<any>;
};

function obterUsuarioDelegate(client: any): UsuarioDelegate | null {
  return (client?.usuario ?? client?.Usuario) as UsuarioDelegate | null;
}

async function contarUsuariosViaSql(client: any): Promise<number> {
  const resultado = await client.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM "Usuario"
  `;

  return Number(resultado?.[0]?.total ?? 0);
}

async function criarAdminViaSql(client: any) {
  const id = randomUUID();
  const senhaHash = await gerarHashSenha(SENHA_ADMIN_PADRAO);

  await client.$executeRaw`
    INSERT INTO "Usuario" (id, nome, email, senha, role, "criadoEm", "atualizadoEm")
    VALUES (${id}, 'Gabriel Konext', 'gabriel@konext.com.br', ${senhaHash}, 'ADMIN', NOW(), NOW())
  `;
}

async function buscarUsuarioPorEmailViaSql(
  client: any,
  email: string
): Promise<{ id: string; senha: string } | null> {
  const resultado = await client.$queryRaw<Array<{ id: string; senha: string }>>`
    SELECT id, senha
    FROM "Usuario"
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;

  if (!Array.isArray(resultado) || resultado.length === 0) {
    return null;
  }

  return {
    id: String(resultado[0].id),
    senha: String(resultado[0].senha ?? ""),
  };
}

export async function seedAdmin() {
  const prismaAny = prisma as any;
  const usuarioDelegate = obterUsuarioDelegate(prismaAny);

  const totalUsuarios = usuarioDelegate?.count
    ? await usuarioDelegate.count()
    : await contarUsuariosViaSql(prismaAny);

  if (totalUsuarios > 0) {
    return;
  }

  if (usuarioDelegate?.create) {
    await usuarioDelegate.create({
      data: {
        nome: "Gabriel Konext",
        email: "gabriel@konext.com.br",
        senha: await gerarHashSenha(SENHA_ADMIN_PADRAO),
        role: "ADMIN",
      },
    });
    return;
  }

  await criarAdminViaSql(prismaAny);
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  await seedAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const senhaNormalizada = senha.trim();

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const prismaAny = prisma as any;
  const usuarioDelegate = obterUsuarioDelegate(prismaAny);

  const usuario = usuarioDelegate?.findUnique
    ? await usuarioDelegate.findUnique({
        where: { email },
        select: {
          id: true,
          senha: true,
        },
      })
    : usuarioDelegate?.findFirst
      ? await usuarioDelegate.findFirst({
          where: { email },
          select: {
            id: true,
            senha: true,
          },
        })
      : await buscarUsuarioPorEmailViaSql(prismaAny, email);

  const senhaArmazenada = String(usuario?.senha ?? "");

  if (!usuario || !senhaArmazenada) {
    return { erro: "Credenciais inválidas." };
  }

  // Suporta migracao suave: se a senha no banco ainda estiver em texto plano,
  // compara diretamente e re-hasheia ao autenticar com sucesso.
  let senhaConfere = false;
  let precisaReHash = false;
  let senhaParaHash = senha;

  if (pareceHashBcrypt(senhaArmazenada)) {
    senhaConfere = await bcrypt.compare(senha, senhaArmazenada);

    // Tolerancia para input acidental com espacos no inicio/fim.
    if (!senhaConfere && senhaNormalizada !== senha) {
      senhaConfere = await bcrypt.compare(senhaNormalizada, senhaArmazenada);
    }
  } else {
    // Migração de senha legada: também tolera espaços/quebras de linha
    // residuais salvos no banco (ex.: "senha\n").
    const senhaArmazenadaNormalizada = senhaArmazenada.trim();

    senhaConfere =
      senhaArmazenada === senha ||
      senhaArmazenada === senhaNormalizada ||
      senhaArmazenadaNormalizada === senha ||
      senhaArmazenadaNormalizada === senhaNormalizada;

    senhaParaHash = senhaNormalizada || senha;
    precisaReHash = senhaConfere;
  }

  if (!senhaConfere) {
    return { erro: "Credenciais inválidas." };
  }

  if (precisaReHash) {
    try {
      const novoHash = await gerarHashSenha(senhaParaHash);

      if (usuarioDelegate?.update) {
        await usuarioDelegate.update({
          where: { id: String(usuario.id) },
          data: { senha: novoHash },
        });
      } else {
        await prismaAny.$executeRaw`
          UPDATE "Usuario"
          SET senha = ${novoHash}
          WHERE id = ${String(usuario.id)}
        `;
      }
    } catch (erro) {
      // Falha ao re-hashear nao deve bloquear o login ja autenticado.
      console.error("Falha ao migrar senha legada para hash:", erro);
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("konext_session", String(usuario.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("konext_session");
  redirect("/login");
}
