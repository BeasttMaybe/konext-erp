import { detectarTipoDaLogo, formatarMegabytes, type TipoDaLogo } from "@/lib/dominio/empresa/logo-enviada";

/**
 * Assinatura de cada usuario, ja assinada, que sai na linha de assinatura dos
 * documentos.
 *
 * QUEM ASSINA CADA DOCUMENTO
 *
 * - OS (A4) e termo de garantia: o tecnico PRINCIPAL da OS; sem tecnico, quem
 *   abriu a OS. E quem responde pelo servico.
 * - Proposta: quem gera o PDF. A proposta nao guarda autor, e quem envia ao
 *   cliente e quem responde por ela.
 *
 * Sem assinatura cadastrada, a linha sai em branco, como antes — para assinar
 * a caneta.
 *
 * A imagem e um PNG com fundo transparente (desenhada na tela) ou um arquivo
 * enviado; mesmo controle de tipo da logo: pelos primeiros bytes, sem SVG.
 */

export const TAMANHO_MAXIMO_DA_ASSINATURA = 300 * 1024;

export const CAMINHO_DA_ASSINATURA = "/assinatura";

export function caminhoDaAssinatura(usuarioId: string, versao: number): string {
  return `${CAMINHO_DA_ASSINATURA}/${encodeURIComponent(usuarioId)}?v=${Math.trunc(versao)}`;
}

export type ResultadoDaAssinatura = { ok: true; tipo: TipoDaLogo } | { ok: false; erro: string };

export function validarAssinaturaRecebida(bytes: Uint8Array): ResultadoDaAssinatura {
  if (bytes.length === 0) return { ok: false, erro: "A assinatura chegou vazia." };
  if (bytes.length > TAMANHO_MAXIMO_DA_ASSINATURA) {
    return {
      ok: false,
      erro: `A assinatura tem ${formatarMegabytes(bytes.length)}; o limite é 300 KB. Use uma imagem menor.`,
    };
  }
  const tipo = detectarTipoDaLogo(bytes);
  if (!tipo) return { ok: false, erro: "A assinatura precisa ser uma imagem PNG, JPG ou WEBP." };
  return { ok: true, tipo };
}

export type Assinante = { usuarioId: string; nome: string };

/**
 * Quem assina a OS: o tecnico principal; se nenhum estiver marcado como
 * principal, o primeiro tecnico; sem tecnicos, quem abriu a OS.
 */
export function assinanteDaOS(os: {
  tecnicos: ReadonlyArray<{ principal: boolean; usuario: { id: string; nome: string } }>;
  criadoPor: { id: string; nome: string } | null;
}): Assinante | null {
  const tecnico = os.tecnicos.find((t) => t.principal) ?? os.tecnicos[0];
  if (tecnico) return { usuarioId: tecnico.usuario.id, nome: tecnico.usuario.nome };
  if (os.criadoPor) return { usuarioId: os.criadoPor.id, nome: os.criadoPor.nome };
  return null;
}

/** O que o documento recebe: nome legivel e, se houver, a imagem da assinatura. */
export type AssinaturaDoDocumento = { nome: string; url: string | null };
