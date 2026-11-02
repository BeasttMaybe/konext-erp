import { Settings } from "lucide-react";
import Link from "next/link";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PaginaInicioTenantMigrado() {
  const contexto = await exigirContextoTenant();

  return (
    <div className= "space-y-6">
      <div className= "space-y-2">
        <h1 className= "text-3xl font-bold tracking-tight text-foreground">Inicio</h1>
        <p className= "text-sm text-muted-foreground">
          Empresa {contexto.empresaSlug} conectada ao tenant {contexto.tenantSlug}.
        </p>
      </div>

      <Card className= "border-border bg-card p-6">
        <div className= "max-w-2xl space-y-4">
          <div className= "flex h-12 w-12 items-center justify-center rounded-lg bg-kx-sucesso/15 text-kx-sucesso">
            <Settings className= "h-6 w-6" />
          </div>
          <div className= "space-y-2">
            <h2 className= "text-xl font-semibold text-foreground">Modulos operacionais liberados</h2>
            <p className= "text-sm text-muted-foreground">
              O tenant migrado ja pode operar Dashboard, CRM, Estoque, OS, Garantias, PDV, Vendas,
              Financeiro, Metas, Notas Fiscais e Configuracoes com isolamento de dados.
            </p>
          </div>
          <Button asChild>
            <Link href= "/">Abrir Dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
