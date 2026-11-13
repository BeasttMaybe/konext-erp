import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { Selo, tomDoStatus } from "~/components/selo";
import { data, haQuanto, ROTULO_STATUS } from "~/lib/formatar";
import { listarLojas } from "~/lib/painel";
import { exigirAdministrador } from "~/lib/sessao";
import { IDS_DE_MODULO } from "@erp/lib/modulos/catalogo";

export default async function LojasPage() {
  await exigirAdministrador();
  const lojas = await listarLojas();
  const ativas = lojas.filter((l) => l.status === "ATIVA").length;
  const usuarios = lojas.reduce((t, l) => t + l.usuariosAtivos, 0);
  const erros = lojas.reduce((t, l) => t + l.erros24h, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Lojas</h1>
          <p className="text-sm text-legenda">Todas as lojas que usam o TechOS ERP. Toque numa loja para ver detalhes, ligar ou desligar módulos e suspender ou reativar.</p>
        </div>
        <Link href="/lojas/nova" className="flex h-10 items-center gap-2 rounded-lg bg-destaque px-4 text-sm font-bold text-fundo">
          <Plus className="h-4 w-4" aria-hidden />
          Nova loja
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Lojas", lojas.length],
          ["Ativas", ativas],
          ["Usuários ativos", usuarios],
          ["Erros nas últimas 24 h", erros],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-borda bg-painel p-4">
            <dt className="text-xs text-legenda">{rotulo}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>

      <ul className="flex flex-col gap-2" aria-label="Lojas">
        {lojas.map((loja) => (
          <li key={loja.id}>
            <Link
              href={`/lojas/${loja.id}`}
              className="flex items-center gap-4 rounded-xl border border-borda bg-painel p-4 transition-colors hover:border-destaque/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold">{loja.nome}</span>
                  <Selo tom={tomDoStatus(loja.status)}>{ROTULO_STATUS[loja.status] ?? loja.status}</Selo>
                  {loja.tenantStatus && loja.tenantStatus !== "ATIVO" ? (
                    <Selo tom={tomDoStatus(loja.tenantStatus)}>Banco: {ROTULO_STATUS[loja.tenantStatus] ?? loja.tenantStatus}</Selo>
                  ) : null}
                  {loja.erros24h > 0 ? <Selo tom="erro">{loja.erros24h} erros em 24 h</Selo> : null}
                </div>
                <p className="mt-1 text-xs text-legenda">
                  {loja.slug} · desde {data(loja.criadoEm)}
                  {loja.responsavel ? ` · responsável: ${loja.responsavel}` : ""}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
                  <span>
                    {loja.usuariosAtivos} {loja.usuariosAtivos === 1 ? "usuário ativo" : "usuários ativos"}
                    {loja.usuariosTotal > loja.usuariosAtivos ? ` (${loja.usuariosTotal} no total)` : ""}
                  </span>
                  <span>
                    Módulos: {loja.modulosAtivos} de {IDS_DE_MODULO.length}
                  </span>
                  <span>Último acesso: {haQuanto(loja.ultimoAcesso)}</span>
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-legenda" aria-hidden />
            </Link>
          </li>
        ))}
        {lojas.length === 0 ? <li className="text-sm text-legenda">Nenhuma loja cadastrada.</li> : null}
      </ul>
    </div>
  );
}
