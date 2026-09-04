"use client";

import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ArrowDownToLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CAMPOS_DOCUMENTOS_PLANEJADOS } from "@/lib/configuracoes-documentos";
import { PreviewIdentidadeEmpresa } from "./preview-identidade-empresa";
import { SecaoConfiguracoes } from "./secao-configuracoes";

const itensDocumentos = [
  {
    titulo: "Proposta Comercial",
    descricao: "Usa logo, nome fantasia, razão social, CNPJ, telefone e endereço da empresa.",
    status: "Prévia disponível",
    aviso: "Mensagens próprias de proposta seguem planejadas para a próxima etapa do modelo.",
  },
  {
    titulo: "Ordem de Serviço Impressa",
    descricao: "Usa identidade da empresa, cliente, equipamento e dados seguros de contato.",
    status: "Em uso",
    aviso: "Suporta folha A4 e cupom térmico 80 mm, com modelo padrão definido nesta seção.",
  },
  {
    titulo: "Termo de Garantia",
    descricao: "Usa dados da empresa, dados da OS, prazo de garantia e cláusulas padrão.",
    status: "Em uso",
    aviso: "Mensagens personalizadas de garantia exigem extensão futura do modelo Configuracao.",
  },
  {
    titulo: "Recibo / Cupom",
    descricao: "Usa nome da empresa, CNPJ, telefone, endereço, logo e mensagem padrão do cupom.",
    status: "Configurável agora",
    aviso: "A mensagem do cupom permanece conectada à action atual de Configurações.",
  },
] as const;

type PainelDocumentosProps = {
  register: UseFormRegister<DadosConfiguracoes>;
  control: Control<DadosConfiguracoes>;
  configuracaoAtual: DadosConfiguracoes;
  salvando: boolean;
};

export function PainelDocumentos({ register, control, configuracaoAtual, salvando }: PainelDocumentosProps) {
  return (
    <SecaoConfiguracoes
      titulo="Documentos"
      descricao="Personalize propostas, termos, cupons e impressões do sistema."
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          {itensDocumentos.map((item) => (
            <Card key={item.titulo} className="border-border bg-background">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p>
                </div>
                <Badge variant="secondary">{item.status}</Badge>
              </div>

              <div className="rounded-lg border border-dashed border-border bg-slate-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Dados da empresa usados
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Logo, nome fantasia, razão social, CNPJ, telefone principal e endereço completo.
                </p>
              </div>

              <p className="text-xs text-muted-foreground">{item.aviso}</p>

              <div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href="#previa-cabecalho-documentos">
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Ver prévia
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Impressão de Ordem de Serviço</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha o modelo padrão usado ao imprimir uma OS e personalize o cupom térmico.
              </p>
            </div>
            <Badge variant="secondary">Persistência ativa</Badge>
          </div>

          <div className="space-y-2">
            <Label>Modelo padrão de impressão da OS</Label>
            <Controller
              name="modeloImpressaoOSPadrao"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={salvando}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <RadioGroupItem value="A4" id="modeloImpressaoOSPadrao-a4" />
                    <Label htmlFor="modeloImpressaoOSPadrao-a4" className="cursor-pointer font-normal">
                      Folha A4
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <RadioGroupItem value="TERMICA_80MM" id="modeloImpressaoOSPadrao-termica" />
                    <Label htmlFor="modeloImpressaoOSPadrao-termica" className="cursor-pointer font-normal">
                      Impressora térmica 80 mm
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="imprimirLogoTermica" className="cursor-pointer">
                Imprimir logo no cupom térmico
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Desative para economizar espaço e vida útil da impressora térmica.
              </p>
            </div>
            <Controller
              name="imprimirLogoTermica"
              control={control}
              render={({ field }) => (
                <Switch
                  id="imprimirLogoTermica"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={salvando}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagemRodapeImpressaoOS">Mensagem de rodapé da impressão</Label>
            <Textarea
              id="mensagemRodapeImpressaoOS"
              rows={3}
              maxLength={300}
              placeholder="Ex.: Garantia sujeita aos termos entregues junto ao equipamento."
              disabled={salvando}
              {...register("mensagemRodapeImpressaoOS")}
            />
          </div>
        </Card>

        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Mensagens padrão</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nesta etapa, apenas a mensagem do cupom/recibo possui persistência no modelo atual.
              </p>
            </div>
            <Badge variant="secondary">Persistência ativa</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagemCupom">Mensagem padrão do cupom / recibo</Label>
            <Textarea
              id="mensagemCupom"
              rows={4}
              placeholder="Ex.: Obrigado pela preferência. Volte sempre."
              disabled={salvando}
              {...register("mensagemCupom")}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {CAMPOS_DOCUMENTOS_PLANEJADOS.map((campo) => (
              <div key={campo} className="rounded-xl border border-dashed border-border bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-foreground">{campo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Disponível na próxima etapa. Esta configuração exigirá extensão segura do modelo Configuracao.
                </p>
              </div>
            ))}
          </div>
        </Card>

        <PreviewIdentidadeEmpresa
          id="previa-cabecalho-documentos"
          configuracao={configuracaoAtual}
          titulo="Prévia do cabeçalho dos documentos"
          descricao="Simulação simples do topo usado em proposta, OS, garantia e recibos, com fallback seguro para campos ausentes."
          mostrarMensagemCupom
          compacta
        />

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">Planejado</Badge>
            <p className="text-sm font-medium text-foreground">Extensões de documento sem migration nesta etapa</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Cabeçalho, rodapé e mensagens específicas de proposta, OS e garantia ficaram sinalizados, mas não foram persistidos fora do modelo atual.
          </p>
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
