import { connection } from "next/server";

import { Aviso, FormularioPedirLink, VoltarAoLogin } from "@/components/auth/formularios-recuperacao";
import { envioDeEmailConfigurado } from "@/lib/email/enviar-email";

export const metadata = {
  title: "Recuperar senha - Konext ERP",
};

/**
 * "Esqueci minha senha". Com o envio de e-mail configurado (RESEND_API_KEY +
 * EMAIL_REMETENTE na Vercel), a pessoa pede um link para o proprio e-mail.
 * Sem isso, a tela manda falar com o administrador — que gera uma senha nova
 * em Configuracoes -> Usuarios e Cargos. Rota publica (proxy.ts).
 */
export default async function RecuperarSenhaPage() {
  // Le a configuracao na hora, nao no build.
  await connection();
  const porEmail = envioDeEmailConfigurado();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--kx-link)" }}>
          Precisa de uma senha nova?
        </span>
        <h2 className="text-[32px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--kx-texto)" }}>
          Recuperar senha
        </h2>
      </div>

      {porEmail ? (
        <>
          <p className="m-0 text-sm leading-[1.5]" style={{ color: "var(--kx-texto-2)" }}>
            Informe o e-mail com que você entra no Konext. Enviamos um link para você criar uma senha nova.
          </p>
          <FormularioPedirLink />
          <p className="m-0 text-[13px] leading-[1.5]" style={{ color: "var(--kx-legenda)" }}>
            Não chegou? O administrador da sua loja também pode gerar uma senha nova para você.
          </p>
        </>
      ) : (
        <Aviso tipo="info">
          Fale com o administrador da sua loja: em Configurações → Usuários e Cargos, ele toca em &quot;Nova senha&quot; ao
          lado do seu nome e passa a senha nova para você.
        </Aviso>
      )}

      <VoltarAoLogin />
    </div>
  );
}
