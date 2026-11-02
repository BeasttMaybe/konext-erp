"use client";

import { Suspense, useMemo, useState } from"react";
import { useRouter } from"next/navigation";
import {
  AlertTriangle,
  BadgePercent,
  Briefcase,
  CalendarCheck2,
  ChevronRight,
  Landmark,
  Target,
  UserPlus,
  Users,
} from"lucide-react";
import { toast } from"sonner";

import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Card } from"@/components/ui/card";

interface InactivityAlertItem {
  id: string;
  title: string;
  description: string;
  daysWithoutUpdate: number;
  severity:"warning" |"critical";
}

const formatCurrencyBRL = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style:"currency",
    currency:"BRL",
  }).format(value);

function SkeletonCRMHub() {
  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm/70/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="h-9 w-72 rounded-lg bg-kx-painel-borda animate-pulse" />
          <div className="h-4 w-96 rounded bg-kx-superficie animate-pulse mt-2" />
        </div>
      </div>

      <div className="flex-1 px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="h-4 w-28 rounded bg-kx-superficie animate-pulse" />
                <div className="h-8 w-24 rounded bg-kx-superficie animate-pulse" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="h-6 w-56 rounded bg-kx-superficie animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="h-5 w-40 rounded bg-kx-superficie animate-pulse" />
                    <div className="h-4 w-full rounded bg-kx-superficie animate-pulse" />
                    <div className="h-9 w-32 rounded bg-kx-superficie animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="h-6 w-32 rounded bg-kx-superficie animate-pulse" />
              <div className="h-10 w-full rounded bg-kx-superficie animate-pulse" />
              <div className="h-10 w-full rounded bg-kx-superficie animate-pulse" />
              <div className="h-10 w-full rounded bg-kx-superficie animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CRMHubContent() {
  const router = useRouter();

  const [placeholderPipelineTotal] = useState(0);
  const [placeholderConversionRate] = useState(0);

  const [todayTasks] = useState([
    { id:"task-1", status:"PENDENTE" },
    { id:"task-2", status:"PENDENTE" },
  ]);

  const [inactivityAlerts] = useState<InactivityAlertItem[]>([
    {
      id:"followup-1",
      title:"Proposta #1042 sem retorno",
      description:"Cliente B2B sem atualização desde o envio da proposta.",
      daysWithoutUpdate: 4,
      severity:"warning",
    },
    {
      id:"followup-2",
      title:"Oportunidade 'Contrato público - Lote A' parada",
      description:"Negociação sem atividade recente no funil de vendas.",
      daysWithoutUpdate: 7,
      severity:"critical",
    },
  ]);

  const totalContacts = 0;
  const tasksTodayCount = todayTasks.filter((task) => task.status ==="PENDENTE").length;

  const staleAlerts = useMemo(
    () => inactivityAlerts.filter((item) => item.daysWithoutUpdate > 3),
    [inactivityAlerts]
  );

  const goToModule = (route: string) => {
    router.push(route);
  };

  const openPlaceholderAction = (message: string) => {
    toast.info(message, {
      description:"Este recurso será habilitado na próxima etapa do CRM.",
    });
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm/70/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM | Central de Relacionamento</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Hub operacional de contatos, funil comercial, propostas e tarefas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => goToModule("/crm/contatos") }>
              <UserPlus className="h-4 w-4 mr-2" />
              Gerenciar contatos
            </Button>
            <Button variant="outline" onClick={() => goToModule("/crm/oportunidades") }>
              <Briefcase className="h-4 w-4 mr-2" />
              Nova Oportunidade
            </Button>
            <Button variant="outline" onClick={() => openPlaceholderAction("Nova tarefa em preparação") }>
              <CalendarCheck2 className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Contatos Totais</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{totalContacts}</p>
                    <p className="text-xs text-muted-foreground mt-1">Base de contatos consolidada na página dedicada.</p>
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Pipeline Ativo</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {formatCurrencyBRL(placeholderPipelineTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Volume aberto no funil</p>
                  </div>
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {placeholderConversionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Negócios ganhos no período</p>
                  </div>
                  <BadgePercent className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Tarefas Hoje</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{tasksTodayCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Atividades pendentes para hoje</p>
                  </div>
                  <CalendarCheck2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-5 border-border bg-card">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Módulos do CRM</h2>
                    <Badge variant="secondary" className="text-xs">
                      Estrutura pronta para expansão
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-border bg-background/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">Gestão de Contatos & Fornecedores</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Acesso rápido à base de clientes e fornecedores em uma página dedicada.
                      </p>
                      <Button variant="outline" onClick={() => goToModule("/crm/contatos")}>
                        Abrir contatos
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Card>

                    <Card className="border-border bg-background/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">Funil de Vendas (Kanban)</h3>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Etapas comerciais, follow-up e evolução de oportunidades.
                      </p>
                      <Button variant="outline" onClick={() => goToModule("/crm/oportunidades") }>
                        Acessar funil
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Card>

                    <Card className="border-border bg-background/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">Propostas & Orçamentos</h3>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Emissão de propostas comerciais e controle de aceite.
                      </p>
                      <Button variant="outline" onClick={() => goToModule("/crm/propostas") }>
                        Acessar propostas
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Card>

                    <Card className="border-border bg-background/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">Agenda & Tarefas</h3>
                        <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Compromissos, atividades do time e prazos de atendimento.
                      </p>
                      <Button variant="outline" onClick={() => goToModule("/crm/tarefas") }>
                        Acessar agenda
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Card>
                  </div>
                </Card>

                <Card className="p-5 border-border bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-kx-alerta-icone" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Alertas de Inatividade (Follow-up)
                    </h2>
                  </div>

                  {staleAlerts.length === 0 && (
                    <div className="rounded-lg border border-kx-sucesso bg-kx-sucesso-fundo p-4">
                      <p className="text-sm font-medium text-kx-sucesso-texto">
                        Nenhum alerta crítico no momento.
                      </p>
                      <p className="text-xs text-kx-sucesso-texto mt-1">
                        Todas as oportunidades e propostas estão com acompanhamento em dia.
                      </p>
                    </div>
                  )}

                  {staleAlerts.length > 0 && (
                    <div className="space-y-3">
                      {staleAlerts.map((alertItem) => {
                        const alertClass =
                          alertItem.severity ==="critical"
                            ?"border-kx-erro-borda bg-kx-erro-fundo"
                            :"border-kx-alerta bg-kx-alerta-fundo";

                        const textClass =
                          alertItem.severity ==="critical"
                            ?"text-kx-erro-texto"
                            :"text-kx-alerta-texto";

                        return (
                          <div key={alertItem.id} className={`rounded-lg border p-4 ${alertClass}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-sm font-semibold ${textClass}`}>{alertItem.title}</p>
                                <p className={`text-xs mt-1 ${textClass}`}>{alertItem.description}</p>
                              </div>
                              <Badge variant="outline" className={textClass}>
                                {alertItem.daysWithoutUpdate} dias
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="border-border bg-card p-4 sm:p-5 space-y-4">
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground">Gestão de contatos deslocada para área dedicada</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use a rota específica de contatos e fornecedores para consultar, editar e cadastrar registros.
                    </p>
                    <Button className="mt-3" variant="outline" onClick={() => goToModule("/crm/contatos") }>
                      Abrir página de contatos
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-5 border-border bg-card sticky top-4">
                  <h2 className="text-lg font-semibold text-foreground mb-3">Ações Rápidas</h2>
                  <div className="space-y-2">
                    <Button className="w-full justify-start" onClick={() => goToModule("/crm/contatos") }>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Gerenciar contatos
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => goToModule("/crm/oportunidades")}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Nova Oportunidade
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => openPlaceholderAction("Nova tarefa em preparação")}
                    >
                      <CalendarCheck2 className="h-4 w-4 mr-2" />
                      Nova Tarefa
                    </Button>
                  </div>

                  <div className="mt-4 rounded-lg border border-dashed border-border p-3 bg-muted/30">
                    <p className="text-sm font-medium text-foreground">Fluxo dedicado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta página abre separadamente para concentrar o trabalho de contatos e fornecedores.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CRMHubPage() {
  return (
    <Suspense fallback={<SkeletonCRMHub />}>
      <CRMHubContent />
    </Suspense>
  );
}
