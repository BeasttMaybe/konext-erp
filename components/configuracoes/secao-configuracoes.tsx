import { Card } from "@/components/ui/card";

type PropsSecaoConfiguracoes = {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
};

export function SecaoConfiguracoes({ titulo, descricao, children }: PropsSecaoConfiguracoes) {
  return (
    <Card className="border-border bg-card p-5 md:p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      {children}
    </Card>
  );
}
