"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Palette } from "lucide-react";

export default function ConfiguracoesPage() {
  const [temaSelecionado, setTemaSelecionado] = useState<"claro" | "escuro">("claro");
  const [calculoMargemAutomatico, setCalculoMargemAutomatico] = useState(true);
  const [permitirVendaSemEstoque, setPermitirVendaSemEstoque] = useState(false);

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Configurações do Sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina informações da empresa, regras operacionais e personalização visual.
        </p>
      </div>

      <Card className="border-border bg-card p-6">
        <Tabs defaultValue="empresa" className="w-full">
          <TabsList className="grid w-full grid-cols-1 gap-2 h-auto md:grid-cols-3 md:h-10">
            <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="pdv-financeiro">PDV e Financeiro</TabsTrigger>
            <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa" className="mt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input id="razaoSocial" defaultValue="Konext" placeholder="Informe a razão social" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                <Input id="nomeFantasia" placeholder="Informe o nome fantasia" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" placeholder="00.000.000/0000-00" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                <Input id="inscricaoEstadual" placeholder="Informe a inscrição estadual" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="telefonePrincipal">Telefone Principal</Label>
                <Input id="telefonePrincipal" placeholder="(00) 00000-0000" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="enderecoCompleto">Endereço Completo</Label>
                <Textarea
                  id="enderecoCompleto"
                  rows={3}
                  placeholder="Rua, número, bairro, cidade, estado e CEP"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pdv-financeiro" className="mt-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pixPadrao">Chave PIX Padrão</Label>
                  <Input id="pixPadrao" placeholder="pix@konext.com.br" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="mensagemCupom">Mensagem Padrão do Cupom Fiscal</Label>
                  <Textarea
                    id="mensagemCupom"
                    rows={4}
                    placeholder="Obrigado pela preferência. Volte sempre!"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Regras Operacionais</p>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Habilitar cálculo automático de margem na OS
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sugere margem padrão durante a elaboração do orçamento.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={calculoMargemAutomatico}
                      onClick={() => setCalculoMargemAutomatico((atual) => !atual)}
                      className={`relative h-6 w-12 rounded-full transition-colors ${
                        calculoMargemAutomatico ? "bg-emerald-600" : "bg-zinc-400"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          calculoMargemAutomatico ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Permitir venda sem estoque
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Libera finalização de venda mesmo com saldo negativo no item.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={permitirVendaSemEstoque}
                      onClick={() => setPermitirVendaSemEstoque((atual) => !atual)}
                      className={`relative h-6 w-12 rounded-full transition-colors ${
                        permitirVendaSemEstoque ? "bg-emerald-600" : "bg-zinc-400"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          permitirVendaSemEstoque ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personalizacao" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Tema da Interface</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl">
                <button
                  type="button"
                  onClick={() => setTemaSelecionado("claro")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    temaSelecionado === "claro"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <span className="text-sm font-medium">Modo Claro</span>
                    </div>
                    {temaSelecionado === "claro" && <Badge>Ativo</Badge>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemaSelecionado("escuro")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    temaSelecionado === "escuro"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span className="text-sm font-medium">Modo Escuro</span>
                    </div>
                    {temaSelecionado === "escuro" && <Badge>Ativo</Badge>}
                  </div>
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Esta seção permite simular preferências visuais. A sincronização global pode ser integrada ao provedor de tema existente.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur md:left-20 lg:left-64">
        <div className="container mx-auto px-6 py-3">
          <Button className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
