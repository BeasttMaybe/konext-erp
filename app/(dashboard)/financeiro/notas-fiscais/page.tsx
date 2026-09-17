import { listarClientesParaNotaFiscal, listarNotasFiscais } from "@/app/actions/notas-fiscais";
import { PaginaNotasFiscais } from "@/components/financeiro/notas-fiscais/pagina-notas-fiscais";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const dynamic = "force-dynamic";

export default async function FinanceiroNotasFiscaisPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  const [resultadoNotas, clientes] = await Promise.all([
    listarNotasFiscais(),
    listarClientesParaNotaFiscal(),
  ]);

  const notas = resultadoNotas.sucesso ? resultadoNotas.dados : [];

  return (
    <div className="w-full min-h-full px-6 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PaginaNotasFiscais notasIniciais={notas} clientes={clientes} />
      </div>
    </div>
  );
}
