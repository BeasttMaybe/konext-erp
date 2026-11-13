import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Selo, tomDoStatus } from "~/components/selo";
import { data, dataHora, haQuanto, ROTULO_STATUS } from "~/lib/formatar";
import { detalheDaLoja } from "~/lib/painel";
import { exigirAdministrador } from "~/lib/sessao";
import { MODULOS } from "@erp/lib/modulos/catalogo";

import { ModulosDaLoja, SituacaoDaLoja } from "./controles";

const ROTULO_DA_ACAO: Record<string, string> = {
  LIGAR_MODULO: "Ligou o módulo",
  DESLIGAR_MODULO: "Desligou o módulo",
  SUSPENDER_LOJA: "Suspendeu a loja",
  REATIVAR_LOJA: "Reativou a loja",
};

function descreverRegistro(acao: string, detalhes: unknown): string {
  const modulo = (detalhes as { modulo?: string } | null)?.modulo;
  const nome = modulo ? MODULOS.find((m) => m.id === modulo)?.nome ?? modulo : null;
  return `${ROTULO_DA_ACAO[acao] ?? acao}${nome ? ` ${nome}` : ""}`;
}

function Secao({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-borda bg-painel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default async function LojaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdministrador();
  const { id } = await params;
  const detalhe = await detalheDaLoja(id);
  if (!detalhe) notFound();
  const { empresa, usuarios, modulos, erros, auditoria, historico } = detalhe;
  const ativos = modulos.filter((m) => m.ativo).length;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex w-fit items-center gap-1.5 text-sm text-texto-2 hover:text-texto">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Lojas
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">{empresa.nome}</h1>
        <Selo tom={tomDoStatus(empresa.status)}>{ROTULO_STATUS[empresa.status] ?? empresa.status}</Selo>
      </div>
      <p className="-mt-2 text-sm text-legenda">
        {empresa.slug} · cadastrada em {data(empresa.criadoEm)}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Módulos do plano" extra={<span className="text-xs text-legenda">{ativos} de {modulos.length} ligados</span>}>
          <ModulosDaLoja empresaId={empresa.id} modulos={modulos} />
        </Secao>

        <Secao titulo="Banco de dados">
          <ul className="flex flex-col gap-2 text-sm">
            {empresa.tenants.map((t) => (
              <li key={t.slug} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.slug}</span>
                  <Selo tom={tomDoStatus(t.status)}>{ROTULO_STATUS[t.status] ?? t.status}</Selo>
                </span>
                <span className="break-all text-xs text-legenda">Versão do schema: {t.versaoSchema}</span>
              </li>
            ))}
          </ul>
        </Secao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Situação da loja">
          <SituacaoDaLoja empresaId={empresa.id} slug={empresa.slug} status={empresa.status} />
        </Secao>
        <Secao titulo="Histórico do master" extra={<span className="text-xs text-legenda">últimas 20</span>}>
          {historico.length === 0 ? (
            <p className="text-sm text-legenda">Nenhuma ação do master nesta loja.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {historico.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 border-b border-borda pb-1.5 last:border-0">
                  <span className="text-texto-2">
                    {descreverRegistro(h.acao, h.detalhes)} <span className="text-legenda">· {h.administrador.nome}</span>
                  </span>
                  <span className="shrink-0 text-legenda">{dataHora(h.criadoEm)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      <Secao titulo="Usuários" extra={<span className="text-xs text-legenda">{usuarios.filter((u) => u.ativo).length} ativos</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-legenda">
              <tr>
                <th className="py-1.5 pr-3 font-semibold">Nome</th>
                <th className="py-1.5 pr-3 font-semibold">E-mail</th>
                <th className="py-1.5 pr-3 font-semibold">Cargo</th>
                <th className="py-1.5 pr-3 font-semibold">Situação</th>
                <th className="py-1.5 font-semibold">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-borda">
                  <td className="py-2 pr-3">
                    {u.nome}
                    {u.responsavel ? <span className="ml-2 text-xs text-destaque">responsável</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-texto-2">{u.email}</td>
                  <td className="py-2 pr-3 text-texto-2">{u.cargo ?? "—"}</td>
                  <td className="py-2 pr-3">{u.ativo ? <Selo tom="ok">Ativo</Selo> : <Selo tom="neutro">Desativado</Selo>}</td>
                  <td className="py-2 text-texto-2">{haQuanto(u.ultimoAcesso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Erros recentes" extra={<span className="text-xs text-legenda">últimos 20</span>}>
          {erros.length === 0 ? (
            <p className="text-sm text-legenda">Nenhum erro registrado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {erros.map((e) => (
                <li key={e.id} className="rounded-lg border border-borda bg-fundo px-3 py-2 text-xs">
                  <span className="font-semibold text-texto">{dataHora(e.criadoEm)}</span> · <span className="text-texto-2">{e.origem}</span>
                  <span className="mt-0.5 block break-words font-mono text-[11px] text-legenda">{e.mensagem}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Ações de administração da loja" extra={<span className="text-xs text-legenda">últimas 15</span>}>
          {auditoria.length === 0 ? (
            <p className="text-sm text-legenda">Nada registrado.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {auditoria.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 border-b border-borda pb-1.5 last:border-0">
                  <span className="text-texto-2">{a.acao.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="shrink-0 text-legenda">{dataHora(a.criadoEm)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  );
}
