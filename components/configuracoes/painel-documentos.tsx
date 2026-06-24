import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SecaoConfiguracoes } from "./secao-configuracoes";

const itensDocumentos = [
  "Proposta comercial",
  "OS impressa",
  "Termo de garantia",
  "Comprovante e cupom",
  "Cabeçalho e rodapé",
  "Mensagem padrão",
];

export function PainelDocumentos() {
  return (
    <SecaoConfiguracoes
      titulo="Documentos"
      descricao="Personalize propostas, termos, cupons e impressões do sistema."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {itensDocumentos.map((item) => (
          <Card key={item} className="border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">{item}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Estrutura preparada para configuração visual e textual nas próximas etapas.
            </p>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary">Em breve</Badge>
          <p className="text-sm font-medium text-foreground">Módulo de documentos em expansão</p>
        </div>
        <p className="text-xs text-muted-foreground">
          O conteúdo desta área será ativado em etapas futuras sem impacto nas rotinas atuais.
        </p>
      </div>
    </SecaoConfiguracoes>
  );
}
