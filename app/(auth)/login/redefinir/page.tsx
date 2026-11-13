import { connection } from "next/server";

import { Aviso, FormularioNovaSenha, VoltarAoLogin } from "@/components/auth/formularios-recuperacao";
import { prismaCentral } from "@/lib/central/prisma-central";
import { hashDoToken, MENSAGEM_LINK_INVALIDO, situacaoDoToken, tokenTemFormatoValido } from "@/lib/auth/recuperacao-de-senha";

export const metadata = {
  title: "Criar senha nova - TechOS ERP",
};

/**
 * Destino do link do e-mail de "Esqueci minha senha". Confere o link antes de
 * mostrar o formulario (o envio confere de novo). Rota publica: /login/*.
 */
export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await connection();
  const { token = "" } = await searchParams;

  let erro: string | null = null;
  if (!tokenTemFormatoValido(token)) {
    erro = MENSAGEM_LINK_INVALIDO.inexistente;
  } else {
    const registro = await prismaCentral.tokenRecuperacaoSenha.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: { expiraEm: true, usadoEm: true },
    });
    const situacao = situacaoDoToken(registro, new Date());
    if (situacao !== "valido") erro = MENSAGEM_LINK_INVALIDO[situacao];
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--kx-link)" }}>
          Recuperar senha
        </span>
        <h2 className="text-[32px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--kx-texto)" }}>
          Criar senha nova
        </h2>
      </div>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : <FormularioNovaSenha token={token} />}
      <VoltarAoLogin />
    </div>
  );
}
