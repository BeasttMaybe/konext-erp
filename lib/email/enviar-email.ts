import "server-only";

/**
 * Envio de e-mail pela API HTTP da Resend (resend.com) — sem SDK, um POST so.
 *
 * Fica DESLIGADO ate o dono configurar na Vercel:
 *   RESEND_API_KEY   — a chave da conta Resend
 *   EMAIL_REMETENTE  — ex.: "Konext <nao-responda@seudominio.com.br>" (dominio verificado na Resend)
 *
 * A chave nunca passa pelo codigo nem pelo chat: so a variavel de ambiente.
 */

export function envioDeEmailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_REMETENTE?.trim());
}

export async function enviarEmail(mensagem: { para: string; assunto: string; texto: string; html: string }): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY?.trim();
  const remetente = process.env.EMAIL_REMETENTE?.trim();
  if (!chave || !remetente) return false;

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: [mensagem.para],
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resposta.ok) {
      console.error("[email] Resend recusou o envio", resposta.status);
      return false;
    }
    return true;
  } catch (erro) {
    console.error("[email] falha ao enviar", erro instanceof Error ? erro.message : erro);
    return false;
  }
}

/** Escapa texto para dentro de HTML de e-mail. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
