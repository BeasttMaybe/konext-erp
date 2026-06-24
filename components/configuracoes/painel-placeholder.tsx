import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelPlaceholder = {
  titulo: string;
  descricao: string;
  itens: string[];
};

export function PainelPlaceholder({ titulo, descricao, itens }: PropsPainelPlaceholder) {
  return (
    <SecaoConfiguracoes titulo={titulo} descricao={descricao}>
      <div className="grid gap-3 md:grid-cols-2">
        {itens.map((item) => (
          <Card key={item} className="border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">{item}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configuração planejada para as próximas etapas da reformulação.
            </p>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-emerald-500/50 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Em preparação</Badge>
          <p className="text-sm text-foreground">
            Esta seção está pronta para evoluir sem alterar as regras atuais do ERP.
          </p>
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
