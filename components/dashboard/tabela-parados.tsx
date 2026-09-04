import type { OperacaoDashboard, OsParada } from "@/app/actions/dashboard";
import { CabecalhoCard } from "./cabecalho-card";
import {
  Superficie,
  TabelaDados,
  formatarNumero,
  type ColunaTabela,
} from "@/components/ui/pagina";

type TabelaParadosProps = {
  parados: OperacaoDashboard["parados"];
  limite?: number;
};

// Acima disso o atraso deixa de ser rotina e vira alerta.
const DIAS_ALTO = 21;

const COLUNAS: readonly ColunaTabela<OsParada>[] = [
  {
    chave: "os",
    titulo: "OS",
    className: "tabular-nums",
    renderizar: (os) => `#${os.numeroOs}`,
  },
  {
    chave: "cliente",
    titulo: "Cliente",
    className: "max-w-[10rem] truncate",
    renderizar: (os) => os.cliente,
  },
  {
    chave: "aparelho",
    titulo: "Aparelho",
    className: "max-w-[10rem] truncate",
    renderizar: (os) => os.aparelho,
  },
  {
    chave: "status",
    titulo: "Status",
    renderizar: (os) => (
      <span className="inline-block whitespace-nowrap rounded-full border border-border px-[7px] py-px text-[10.5px] text-muted-foreground">
        {os.status}
      </span>
    ),
  },
  {
    chave: "dias",
    titulo: "Dias",
    numerica: true,
    renderizar: (os) => (
      <span
        className={os.diasParado >= DIAS_ALTO ? "font-semibold" : undefined}
        style={os.diasParado >= DIAS_ALTO ? { color: "var(--t-vermelho)" } : undefined}
      >
        {formatarNumero(os.diasParado)}
      </span>
    ),
  },
];

export function TabelaParados({ parados, limite }: TabelaParadosProps) {
  const lista = typeof limite === "number" ? parados.lista.slice(0, limite) : parados.lista;

  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Parados na bancada"
        acao={
          parados.quantidade > 0
            ? `${formatarNumero(parados.quantidade)} sem movimento há mais de ${parados.diasLimite} dias`
            : undefined
        }
      />

      <div className="px-3 pb-3 pt-2.5">
        <TabelaDados
          colunas={COLUNAS}
          linhas={lista}
          chaveLinha={(os) => os.id}
          mensagemVazia="Nenhum aparelho parado."
          hrefLinha={(os) => `/os/${os.id}`}
        />
      </div>
    </Superficie>
  );
}
