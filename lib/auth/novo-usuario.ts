import { z } from "zod";

import { validarNovaSenha } from "@/lib/auth/senha";

/**
 * Cadastro de um usuario novo pela tela Usuarios e Cargos.
 *
 * Quem cadastra (o dono ou quem tem `configuracoes.usuarios`) define uma
 * senha inicial e a passa para a pessoa; ela troca depois em "Meu perfil".
 * Nao ha envio de convite por e-mail porque o sistema nao manda e-mail hoje.
 */
export const esquemaNovoUsuario = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo (mínimo 3 letras)."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido."),
  cargoId: z.string().min(1, "Escolha o cargo."),
  senhaInicial: z.string().superRefine((senha, ctx) => {
    const validacao = validarNovaSenha(senha);
    if (!validacao.valida) {
      ctx.addIssue({ code: "custom", message: validacao.motivo.replace("A nova senha", "A senha inicial") });
    }
  }),
});

export type DadosNovoUsuario = z.input<typeof esquemaNovoUsuario>;

/**
 * O que fazer com o e-mail informado, dado o que ja existe no banco central.
 *
 * - Ninguem com o e-mail: cria a conta.
 * - Conta existe mas sem vinculo com esta loja: so cria o vinculo. A senha
 *   dela NAO muda — a conta pode ser usada em outra loja, e trocar a senha
 *   de alguem por cadastro de terceiro seria tomar a conta dele.
 * - Ja e usuario desta loja: recusa, apontando o caminho certo (reativar,
 *   se estiver desativado).
 */
export type DecisaoNovoUsuario =
  | { tipo: "criar-conta" }
  | { tipo: "vincular-conta-existente" }
  | { tipo: "recusar"; motivo: string };

export function decidirNovoUsuario(existente: {
  contaExiste: boolean;
  vinculoNestaLoja: { ativo: boolean } | null;
}): DecisaoNovoUsuario {
  if (existente.vinculoNestaLoja) {
    return {
      tipo: "recusar",
      motivo: existente.vinculoNestaLoja.ativo
        ? "Este e-mail já é de um usuário desta loja."
        : "Este e-mail é de um usuário desativado. Reative-o na lista em vez de cadastrar de novo.",
    };
  }
  return existente.contaExiste ? { tipo: "vincular-conta-existente" } : { tipo: "criar-conta" };
}

/** RoleEmpresa (central) -> RoleUsuario (loja), o mesmo mapa do provisionamento. */
export const ROLE_DA_LOJA_PELO_ROLE_DA_EMPRESA = {
  ADMIN: "ADMIN",
  GESTOR: "OPERADOR",
  USUARIO: "TECNICO",
} as const;
