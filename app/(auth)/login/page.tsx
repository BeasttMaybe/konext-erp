"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, Clock, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login } from "@/app/actions/auth";

const estadoInicial = {
  erro: null as string | null,
};

const classeFoco =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2";

function estiloCampo(comErro: boolean): React.CSSProperties {
  return {
    height: 52,
    borderRadius: 14,
    backgroundColor: "var(--kx-painel)",
    border: `1px solid ${comErro ? "var(--kx-erro-borda)" : "var(--kx-campo-borda)"}`,
    color: "var(--kx-texto)",
  };
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageConteudo />
    </Suspense>
  );
}

function LoginPageConteudo() {
  const searchParams = useSearchParams();
  const sessaoExpirada = searchParams.get("expirada") === "1";
  const [estado, acaoLogin, carregandoLogin] = useActionState(login, estadoInicial);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--kx-link)" }}>
          Bem-vindo de volta
        </span>
        <h2 className="text-[32px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--kx-texto)" }}>
          Entrar na sua loja
        </h2>
      </div>

      {sessaoExpirada && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-[1.45]"
          style={{ backgroundColor: "var(--kx-alerta-fundo)", color: "var(--kx-alerta-texto)" }}
        >
          <Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--kx-alerta-icone)" }} aria-hidden />
          <span>Sua sessão expirou por segurança. Entre novamente para continuar de onde parou.</span>
        </div>
      )}

      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-[1.45]"
          style={{ backgroundColor: "var(--kx-erro-fundo)", color: "var(--kx-erro-texto)" }}
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--kx-erro-icone)" }} aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <form action={acaoLogin} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-bold" style={{ color: "var(--kx-texto)" }}>
            E-mail
          </label>
          <div className="flex items-center gap-2.5 px-4" style={estiloCampo(Boolean(estado.erro))}>
            <Mail className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--kx-legenda)" }} aria-hidden />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="voce@sualoja.com.br"
              required
              autoComplete="username"
              className={`h-full flex-grow bg-transparent text-[15px] outline-none placeholder:opacity-100 ${classeFoco}`}
              style={{ color: "var(--kx-texto)", outlineColor: "var(--kx-foco)" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="senha" className="text-sm font-bold" style={{ color: "var(--kx-texto)" }}>
              Senha
            </label>
            <Link
              href="/login/recuperar"
              className={`text-[13px] font-semibold hover:text-[#C7CAFF] ${classeFoco}`}
              style={{ color: "var(--kx-link)", outlineColor: "var(--kx-foco)" }}
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="flex items-center gap-2.5 py-0 pl-4 pr-1.5" style={estiloCampo(Boolean(estado.erro))}>
            <Lock className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--kx-legenda)" }} aria-hidden />
            <input
              id="senha"
              name="senha"
              type={mostrarSenha ? "text" : "password"}
              placeholder="Sua senha"
              required
              autoComplete="current-password"
              className={`h-full flex-grow bg-transparent text-[15px] outline-none placeholder:opacity-100 ${classeFoco}`}
              style={{ color: "var(--kx-texto)", outlineColor: "var(--kx-foco)" }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((atual) => !atual)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={mostrarSenha}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${classeFoco}`}
              style={{ color: "var(--kx-texto-2)", outlineColor: "var(--kx-foco)" }}
            >
              {mostrarSenha ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        <label
          className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm"
          style={{ color: "var(--kx-texto-2)" }}
        >
          <input
            type="checkbox"
            name="manterConectado"
            className={`h-5 w-5 rounded ${classeFoco}`}
            style={{ accentColor: "var(--kx-primaria)", outlineColor: "var(--kx-foco)" }}
          />
          Manter conectado neste computador
        </label>

        <button
          type="submit"
          disabled={carregandoLogin}
          className={`flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] text-base font-extrabold transition-opacity ${classeFoco}`}
          style={{
            backgroundColor: "var(--kx-primaria)",
            color: "#FFFFFF",
            opacity: carregandoLogin ? 0.7 : 1,
            outlineColor: "var(--kx-foco)",
          }}
        >
          {carregandoLogin ? "Entrando…" : "Entrar"}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </form>

      <p
        className="m-0 border-t pt-5 text-[13px] leading-[1.5]"
        style={{ borderColor: "var(--kx-painel-borda)", color: "var(--kx-legenda)" }}
      >
        Acesso restrito a usuários cadastrados pela loja. Precisa de acesso? Peça ao administrador da sua loja.
      </p>
    </div>
  );
}
