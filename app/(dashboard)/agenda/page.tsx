import { obterAgenda } from "@/app/actions/agenda";
import { PaginaAgenda } from "@/components/agenda/pagina-agenda";
import { chaveDoDiaNaLoja, FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

export const metadata = { title: "Agenda | TechOS" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

/**
 * Agenda: o mes em grade (domingo a sabado, com as pontas dos meses
 * vizinhos) e a lista do dia escolhido. `?mes=AAAA-MM` navega, `?dia=`
 * escolhe o dia e `?novo=1` abre o "Novo compromisso" (botao do CRM).
 */
export default async function AgendaPage({ searchParams }: PageProps) {
  const contexto = await exigirContextoTenant();
  const params = await searchParams;
  const hoje = chaveDoDiaNaLoja(new Date(), contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);

  const mesPedido = primeiro(params.mes);
  const mes = mesPedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido) ? mesPedido : hoje.slice(0, 7);
  const [ano, numeroMes] = mes.split("-").map(Number) as [number, number];

  const primeiroDia = new Date(Date.UTC(ano, numeroMes - 1, 1));
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0));
  const inicioGrade = new Date(Date.UTC(ano, numeroMes - 1, 1 - primeiroDia.getUTCDay()));
  const fimGrade = new Date(Date.UTC(ano, numeroMes - 1, ultimoDia.getUTCDate() + (6 - ultimoDia.getUTCDay())));
  const chave = (d: Date) => d.toISOString().slice(0, 10);

  const agenda = await obterAgenda(chave(inicioGrade), chave(fimGrade));

  const diaPedido = primeiro(params.dia);
  const diaSelecionado =
    diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido >= agenda.de && diaPedido <= agenda.ate
      ? diaPedido
      : hoje.startsWith(mes)
        ? hoje
        : `${mes}-01`;

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <PaginaAgenda
        key={`${mes}-${diaSelecionado}`}
        agenda={agenda}
        mes={mes}
        diaSelecionado={diaSelecionado}
        abrirNovo={primeiro(params.novo) === "1"}
      />
    </div>
  );
}
