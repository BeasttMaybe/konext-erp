import { Card } from "@/components/ui/card";

type ItemFunil = {
  status: string;
  label: string;
  quantidade: number;
};

type FunilOrdensServicoProps = {
  itens: ItemFunil[];
};

export function FunilOrdensServico({ itens }: FunilOrdensServicoProps) {
  const maximo = Math.max(1, ...itens.map((item) => item.quantidade));

  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Funil de Ordens de Servico</h2>
          <p className="text-xs text-zinc-400">Status operacionais com foco em acao.</p>
        </div>

        <div className="space-y-3">
          {itens.map((item) => {
            const percentual = Math.round((item.quantidade / maximo) * 100);

            return (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{item.label}</span>
                  <span className="font-semibold text-white">{item.quantidade}</span>
                </div>
                <div className="h-2.5 rounded-full bg-zinc-800">
                  <div
                    className="h-2.5 rounded-full bg-sky-500 transition-all"
                    style={{ width: `${percentual}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
