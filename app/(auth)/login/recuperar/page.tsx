import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Recuperar senha - Konext ERP",
};

/**
 * Sem self-service de recuperacao de senha ainda: quem reseta e o
 * administrador da loja, via /perfil de outro usuario. Autoatendimento por
 * e-mail fica para a Fase 1C. Rota publica (proxy.ts).
 */
const classeFoco =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2";

export default function RecuperarSenhaPage() {
  return (
    <div className= "flex flex-col gap-7">
      <div className= "flex flex-col gap-2">
        <span className= "text-sm font-bold" style={{ color: "var(--kx-link)" }}>
          Precisa de uma senha nova?
        </span>
        <h2 className= "text-[32px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--kx-texto)" }}>
          Recuperar senha
        </h2>
      </div>

      <p
        className= "rounded-[14px] px-4 py-3.5 text-sm leading-[1.5]"
        style={{ backgroundColor: "var(--kx-painel)", border: "1px solid var(--kx-campo-borda)", color: "var(--kx-texto-2)" }}
      >
        Por enquanto, a troca de senha é feita pelo administrador da sua loja. Fale com quem administra o Konext
        ERP na sua empresa para receber uma nova senha. O autoatendimento chega em uma fase futura.
      </p>

      <Link
        href= "/login"
        className={`inline-flex items-center gap-2 text-sm font-semibold hover:text-kx-link ${classeFoco}`}
        style={{ color: "var(--kx-link)", outlineColor: "var(--kx-foco)" }}
      >
        <ArrowLeft className= "h-4 w-4" aria-hidden />
        Voltar para o login
      </Link>
    </div>
  );
}
