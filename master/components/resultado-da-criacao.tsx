"use client";

import { useState } from "react";
import { Check, CircleCheck, Copy } from "lucide-react";

/** Tela de "loja pronta": o acesso do responsavel, mostrado uma unica vez. */
export function ResultadoDaCriacao({
  empresaId,
  email,
  senha,
  enderecoDoErp,
}: {
  empresaId: string;
  email: string;
  senha: string | null;
  enderecoDoErp: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = [
    "Seu acesso ao TechOS ERP",
    enderecoDoErp ? `Endereço: ${enderecoDoErp}` : null,
    `E-mail: ${email}`,
    senha ? `Senha: ${senha}` : "Senha: a mesma que você já usa no TechOS",
    senha ? "Troque a senha em Meu perfil no primeiro acesso." : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-ok/40 bg-ok/5 p-5">
      <p className="flex items-center gap-2 font-bold text-ok">
        <CircleCheck className="h-5 w-5" aria-hidden />
        Loja criada e no ar
      </p>
      <pre className="whitespace-pre-wrap rounded-lg border border-borda bg-fundo p-3 font-mono text-sm text-texto">{texto}</pre>
      {senha ? (
        <p className="text-xs text-alerta">
          Esta senha aparece só agora. Copie e mande para o responsável — o sistema guarda apenas uma versão codificada dela.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(texto).then(() => setCopiado(true));
          }}
          className="flex h-10 items-center gap-2 rounded-lg bg-destaque px-4 text-sm font-bold text-fundo"
        >
          {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copiado ? "Copiado" : "Copiar acesso"}
        </button>
        {/* <a>, nao <Link>: recarrega a pagina da loja ja com a criacao concluida. */}
        <a href={`/lojas/${empresaId}`} className="flex h-10 items-center rounded-lg border border-borda px-4 text-sm text-texto-2">
          Ver a loja
        </a>
      </div>
    </div>
  );
}
