import type { IdModulo } from "@/lib/modulos/catalogo";

/**
 * "Primeiros passos" — a lista que aparece no Dashboard de uma loja nova ate
 * o basico estar pronto. Cada passo sabe se ja foi feito olhando os dados de
 * verdade (nao uma marcacao manual): cadastrou a logo, a logo conta.
 *
 * Passos de modulo nao contratado nao aparecem. Quando tudo esta feito, a
 * lista some sozinha.
 */

export type FatosDaLoja = {
  dadosDaEmpresa: boolean;
  logo: boolean;
  usuariosAtivos: number;
  minhaAssinatura: boolean;
  clientes: number;
  produtos: number;
  ordensDeServico: number;
};

export type PassoInicial = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  feito: boolean;
};

export function montarPrimeirosPassos(fatos: FatosDaLoja, modulos: ReadonlySet<IdModulo>): PassoInicial[] {
  const passos: Array<PassoInicial & { modulo?: IdModulo }> = [
    {
      id: "empresa",
      titulo: "Dados da empresa",
      descricao: "Razão social, CNPJ, telefone e endereço — saem na OS, no recibo e na proposta.",
      href: "/configuracoes?secao=empresa",
      feito: fatos.dadosDaEmpresa,
    },
    {
      id: "logo",
      titulo: "Logo da loja",
      descricao: "Envie a logo para ela sair nos documentos e na barra lateral.",
      href: "/configuracoes?secao=empresa",
      feito: fatos.logo,
    },
    {
      id: "equipe",
      titulo: "Cadastrar a equipe",
      descricao: "Crie o acesso de cada técnico e atendente, com o cargo certo.",
      href: "/configuracoes?secao=usuarios",
      feito: fatos.usuariosAtivos > 1,
    },
    {
      id: "assinatura",
      titulo: "Sua assinatura",
      descricao: "Desenhe uma vez; ela sai pronta na OS, no termo de garantia e na proposta.",
      href: "/perfil",
      feito: fatos.minhaAssinatura,
    },
    {
      id: "cliente",
      titulo: "Primeiro cliente",
      descricao: "Cadastre um cliente (ou importe sua lista por planilha).",
      href: "/crm",
      feito: fatos.clientes > 0,
    },
    {
      id: "produto",
      titulo: "Primeiro produto",
      descricao: "Cadastre peças e acessórios (ou importe por planilha) para vender no PDV.",
      href: "/estoque",
      feito: fatos.produtos > 0,
      modulo: "estoque",
    },
    {
      id: "os",
      titulo: "Primeira ordem de serviço",
      descricao: "Abra uma OS de teste para ver o fluxo do começo ao fim.",
      href: "/os",
      feito: fatos.ordensDeServico > 0,
      modulo: "os",
    },
  ];
  return passos
    .filter((p) => !p.modulo || modulos.has(p.modulo))
    .map((p) => ({ id: p.id, titulo: p.titulo, descricao: p.descricao, href: p.href, feito: p.feito }));
}

export function dadosDaEmpresaCompletos(config: {
  razaoSocial?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
}): boolean {
  return [config.razaoSocial, config.cnpj, config.telefone, config.endereco].every((v) => Boolean(v?.trim()));
}
