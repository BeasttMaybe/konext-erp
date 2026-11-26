import { CheckCircle2, Circle, Clock, Wrench, Package, Truck, ClipboardList } from "lucide-react";
import type { StatusOS } from "@prisma/client";
import { ROTULOS_STATUS_OS } from "@/lib/dominio/os/maquina-estados";
import { classesDoStatusOS } from "@/lib/dominio/os/cores-etapa";
import { primeiroNomePublico } from "@/lib/dominio/os/nome-publico";

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Subconjunto seguro da OS — sem custos internos, margens ou dados sensíveis. */
export interface OsPublica {
  id: string;
  numeroOs: number;
  primeiroNomeCliente: string; // Apenas o primeiro nome, por privacidade
  equipamento: string;
  marca: string | null;
  modelo: string | null;
  relatoCliente: string;
  statusAtual: string;
  criadoEm: Date;
  atualizadoEm: Date; // Necessário para calcular expiração do link após entrega
}

type OrdemServicoPublicaDelegate = {
  findUnique?: (args: unknown) => Promise<{
    id: string;
    numeroOs: number;
    equipamento: string;
    marca?: string | null;
    modelo?: string | null;
    relatoCliente: string;
    status: string;
    criadoEm: Date;
    atualizadoEm: Date;
    cliente?: { nomeRazaoSocial?: string | null } | null;
  } | null>;
};

// ── Etapas do timeline ─────────────────────────────────────────────────────────

/**
 * Ordem lógica das etapas do reparo.
 * Mapeia o valor do enum StatusOS para um rótulo legível e um ícone.
 */
const ETAPAS_TIMELINE: {
  status: string;
  rotulo: string;
  descricao: string;
  Icone: React.ElementType;
}[] = [
  {
    status: "AGUARDANDO_ORCAMENTO",
    rotulo: "Recebido",
    descricao: "Equipamento recebido e aguardando avaliação técnica.",
    Icone: ClipboardList,
  },
  {
    status: "AGUARDANDO_APROVACAO",
    rotulo: "Aguardando Aprovação",
    descricao: "Orçamento enviado. Aguardando sua aprovação para prosseguir.",
    Icone: Clock,
  },
  {
    status: "APROVADO",
    rotulo: "Aprovado",
    descricao: "Orçamento aprovado. Reparo autorizado.",
    Icone: CheckCircle2,
  },
  {
    status: "AGUARDANDO_PECA",
    rotulo: "Aguardando Peça",
    descricao: "Peça solicitada ao fornecedor. Em breve o reparo será iniciado.",
    Icone: Package,
  },
  {
    status: "EM_MANUTENCAO",
    rotulo: "Em Manutenção",
    descricao: "Seu equipamento está sendo reparado pelo nosso técnico.",
    Icone: Wrench,
  },
  {
    status: "GARANTIA_RETORNO",
    rotulo: "Garantia / Retorno",
    descricao: "Seu equipamento está em análise de retorno de garantia.",
    Icone: Wrench,
  },
  {
    status: "PRONTO",
    rotulo: "Pronto para Retirada",
    descricao: "Reparo concluído! Seu equipamento está pronto para retirada.",
    Icone: CheckCircle2,
  },
  {
    status: "ENTREGUE",
    rotulo: "Entregue",
    descricao: "Equipamento entregue ao cliente. Obrigado pela confiança!",
    Icone: Truck,
  },
];

// ── Consulta Prisma (apenas campos públicos) ───────────────────────────────────

/**
 * Busca a OS pelo ID e retorna apenas os campos seguros para exibição pública.
 * Campos internos (custoPeca, margens, observações internas, IMEI) são omitidos.
 */
/**
 * O cliente do Prisma vem de QUEM CHAMA, nunca de um import global.
 *
 * É o que torna esta tela utilizável por mais de uma loja. Cada loja tem o
 * próprio banco, e uma rota pública não tem sessão pra dizer qual é — a rota
 * nova resolve a loja pelo slug na URL (`/r/<loja>/<os>`) e entrega o cliente
 * certo aqui dentro.
 */
export async function buscarOsPublica(
  cliente: unknown,
  id: string
): Promise<OsPublica | null> {
  const prismaAny = cliente as {
    ordemServico?: OrdemServicoPublicaDelegate;
    OrdemServico?: OrdemServicoPublicaDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.findUnique) return null;

  const os = await ordemServicoDelegate.findUnique({
    where: { id },
    select: {
      id: true,
      numeroOs: true,
      equipamento: true,
      marca: true,
      modelo: true,
      relatoCliente: true,
      status: true,
      criadoEm: true,
      atualizadoEm: true, // Usado para calcular expiração do link de rastreio
      // Apenas o nome do cliente — sem documento, telefone ou endereço
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
    },
  });

  if (!os) return null;

  const primeiroNome = primeiroNomePublico(os.cliente?.nomeRazaoSocial);

  return {
    id: os.id,
    numeroOs: os.numeroOs,
    primeiroNomeCliente: primeiroNome,
    equipamento: os.equipamento,
    marca: os.marca ?? null,
    modelo: os.modelo ?? null,
    relatoCliente: os.relatoCliente,
    statusAtual: String(os.status),
    criadoEm: new Date(os.criadoEm),
    atualizadoEm: new Date(os.atualizadoEm),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Retorna o índice da etapa atual no array ETAPAS_TIMELINE.
 * Caso o status não seja encontrado, retorna 0 (primeira etapa).
 */
function indiceEtapaAtual(status: string): number {
  const idx = ETAPAS_TIMELINE.findIndex((e) => e.status === status);
  return idx === -1 ? 0 : idx;
}

/**
 * Verifica se o link de rastreio expirou.
 * A regra: OS entregue há mais de 6 horas → link expirado.
 */
function linkExpirado(status: string, atualizadoEm: Date): boolean {
  if (status !== "ENTREGUE") return false;
  const diferencaMs = new Date().getTime() - atualizadoEm.getTime();
  const diferencaHoras = diferencaMs / (1000 * 60 * 60);
  return diferencaHoras > 6;
}

/** Formata uma data no padrão brasileiro dd/mm/aaaa. */
function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Componentes de UI ──────────────────────────────────────────────────────────

/** Indicador visual de uma etapa da linha do tempo. */
function EtapaTimeline({
  rotulo,
  descricao,
  Icone,
  estado,
  ehUltima,
}: {
  rotulo: string;
  descricao: string;
  Icone: React.ElementType;
  /**"concluida" = passada, "atual" = em andamento, "pendente" = futura */
  estado: "concluida" |"atual" |"pendente";
  ehUltima: boolean;
}) {
  const corIcone =
    estado === "concluida"
      ? "text-kx-sucesso"
      : estado === "atual"
        ? "text-kx-link"
        : "text-kx-texto-2";

  const corFundoIcone =
    estado === "concluida"
      ? "bg-kx-sucesso-fundo border-kx-sucesso"
      : estado === "atual"
        ? "bg-kx-info-fundo border-kx-info ring-4 ring-kx-foco"
        : "bg-kx-superficie border-kx-painel-borda";

  const corRotulo =
    estado === "concluida"
      ? "text-kx-sucesso-texto font-medium"
      : estado === "atual"
        ? "text-kx-info-texto font-semibold"
        : "text-kx-legenda";

  const corDescricao =
    estado === "pendente" ? "text-kx-texto-2" : "text-kx-legenda";

  const corLinha =
    estado === "concluida" ? "bg-kx-sucesso" : "bg-kx-painel-borda";

  return (
    <div className="flex gap-4">
      {/* Coluna do ícone + linha conectora */}
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${corFundoIcone}`}
        >
          {estado === "concluida" ? (
            <CheckCircle2 className={`w-5 h-5 ${corIcone}`} />
          ) : estado === "atual" ? (
            <Icone className={`w-5 h-5 ${corIcone}`} />
          ) : (
            <Circle className="w-5 h-5 text-kx-texto-2" />
          )}
        </div>
        {/* Linha conectora vertical — oculta na última etapa */}
        {!ehUltima && <div className={`w-0.5 flex-1 mt-1 ${corLinha}`} />}
      </div>

      {/* Conteúdo textual da etapa */}
      <div className="pb-8">
        <p className={`text-sm leading-tight ${corRotulo}`}>{rotulo}</p>
        <p className={`text-xs mt-0.5 leading-snug ${corDescricao}`}>{descricao}</p>
      </div>
    </div>
  );
}

// ── Tela ───────────────────────────────────────────────────────────────────────

/**
 * A tela de rastreio, já com a OS em mãos.
 *
 * Recebe a OS pronta em vez de buscá-la porque as duas rotas que a usam
 * descobrem a loja de formas diferentes: a nova pelo slug na URL, a antiga
 * pelo banco do tenant principal. A tela é a mesma nos dois casos.
 */
export function PaginaRastreio({ os }: { os: (OsPublica & { nomeDaLoja?: string }) | null }) {
  // OS não encontrada — exibe estado amigável sem expor detalhes internos.
  if (!os) {
    return (
      <main className="min-h-screen bg-kx-superficie flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-kx-painel rounded-kx-cartao shadow-lg p-8 text-center">
          {/* Logotipo */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-kx-primaria rounded-kx-cartao flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
          </div>

          <div className="w-16 h-16 bg-kx-erro-fundo rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-kx-erro-texto" />
          </div>
          <h1 className="text-xl font-bold text-kx-texto mb-2">OS não encontrada</h1>
          <p className="text-sm text-kx-legenda leading-relaxed">
            Não encontramos nenhuma Ordem de Serviço com o código informado. Verifique o link
            recebido ou entre em contato com nossa equipe.
          </p>
        </div>
      </main>
    );
  }

  // Bloqueia a visualização se o link expirou (entregue há mais de 6 horas).
  if (linkExpirado(os.statusAtual, os.atualizadoEm)) {
    return (
      <main className="min-h-screen bg-kx-superficie flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-kx-painel rounded-kx-cartao shadow-lg p-8 text-center">
          {/* Logotipo */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-kx-primaria rounded-kx-cartao flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
          </div>

          <div className="w-16 h-16 bg-kx-superficie rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-kx-legenda" />
          </div>
          <h1 className="text-xl font-bold text-kx-texto mb-2">Link expirado</h1>
          <p className="text-sm text-kx-legenda leading-relaxed">
            Este link de rastreio expirou. O aparelho já foi entregue e a ordem de serviço foi encerrada.
          </p>
        </div>
      </main>
    );
  }

  const idxAtual = indiceEtapaAtual(os.statusAtual);
  const equipamentoCompleto = [os.marca, os.modelo, os.equipamento]
    .filter(Boolean)
    .join("");

  return (
    <main className="min-h-screen bg-kx-superficie py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Cabeçalho da página — logotipo + título */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 bg-kx-primaria rounded-kx-cartao flex items-center justify-center shadow">
            <span className="text-primary-foreground font-bold text-lg select-none">
              {(os.nomeDaLoja?.trim()[0] ?? "T").toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-kx-legenda uppercase tracking-widest font-medium">
            {os.nomeDaLoja ? `${os.nomeDaLoja} — Rastreio de Reparo` : "Rastreio de Reparo"}
          </p>
        </div>

        {/* Card principal — identificação da OS */}
        <div className="bg-kx-painel rounded-kx-cartao shadow-lg p-6 border border-kx-painel-borda">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-kx-legenda uppercase tracking-wider font-medium mb-0.5">
                Ordem de Serviço
              </p>
              <h1 className="text-3xl font-extrabold text-kx-texto tracking-tight">
                #{os.numeroOs}
              </h1>
            </div>

            {/* Badge do status atual */}
            <StatusBadge status={os.statusAtual} />
          </div>

          {/* Detalhes públicos da OS — sem dados sensíveis */}
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-kx-superficie rounded-kx-cartao p-3">
              <dt className="text-xs text-kx-legenda font-medium mb-0.5">Cliente</dt>
              <dd className="text-sm font-semibold text-kx-texto">{os.primeiroNomeCliente}</dd>
            </div>

            <div className="bg-kx-superficie rounded-kx-cartao p-3">
              <dt className="text-xs text-kx-legenda font-medium mb-0.5">Equipamento</dt>
              <dd className="text-sm font-semibold text-kx-texto">{equipamentoCompleto}</dd>
            </div>

            <div className="bg-kx-superficie rounded-kx-cartao p-3">
              <dt className="text-xs text-kx-legenda font-medium mb-0.5">Data de Entrada</dt>
              <dd className="text-sm font-semibold text-kx-texto">{formatarData(os.criadoEm)}</dd>
            </div>
          </dl>

          {/* Relato do cliente — exibido como informação de contexto */}
          <div className="mt-4 p-3 bg-kx-alerta-fundo border border-kx-alerta rounded-kx-cartao">
            <p className="text-xs text-kx-alerta-texto font-medium mb-0.5">Problema relatado</p>
            <p className="text-sm text-kx-texto leading-relaxed">{os.relatoCliente}</p>
          </div>
        </div>

        {/* Card da linha do tempo — progressão visual do reparo */}
        <div className="bg-kx-painel rounded-kx-cartao shadow-lg p-6 border border-kx-painel-borda">
          <h2 className="text-base font-bold text-kx-texto mb-6">
            Acompanhamento do Reparo
          </h2>

          <div>
            {ETAPAS_TIMELINE.map((etapa, idx) => {
              const estado =
                idx < idxAtual
                  ? "concluida"
                  : idx === idxAtual
                    ? "atual"
                    : "pendente";

              return (
                <EtapaTimeline
                  key={etapa.status}
                  rotulo={etapa.rotulo}
                  descricao={etapa.descricao}
                  Icone={etapa.Icone}
                  estado={estado}
                  ehUltima={idx === ETAPAS_TIMELINE.length - 1}
                />
              );
            })}
          </div>
        </div>

        {/* Rodapé informativo */}
        <p className="text-center text-xs text-kx-legenda pb-6">
          Dúvidas? Entre em contato com nossa equipe de atendimento.
          <br />
          Esta página é atualizada automaticamente conforme o andamento do reparo.
        </p>

      </div>
    </main>
  );
}

// ── Badge de status ────────────────────────────────────────────────────────────

/**
 * Exibe o status atual da OS como um badge colorido e legível.
 * Separa a camada de apresentação da lógica de mapeamento.
 */
function StatusBadge({ status }: { status: string }) {
  const mapa: Record<string, { rotulo: string; classes: string }> = Object.fromEntries(
    Object.keys(ROTULOS_STATUS_OS).map((valor) => [
      valor,
      {
        rotulo: ROTULOS_STATUS_OS[valor as StatusOS],
        classes: classesDoStatusOS(valor as StatusOS).chip,
      },
    ])
  );

  const config = mapa[status] ?? { rotulo: status, classes: "bg-kx-superficie text-kx-texto-2" };

  return (
    <span
      className={`inline-flex items-center border px-3 py-1.5 rounded-kx-pilula text-xs font-semibold tracking-wide whitespace-nowrap ${config.classes}`}
    >
      {config.rotulo}
    </span>
  );
}
