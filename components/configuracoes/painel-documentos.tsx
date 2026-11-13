"use client";

import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ArrowDownToLine } from "lucide-react";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PreviewIdentidadeEmpresa } from "./preview-identidade-empresa";
import { SecaoConfiguracoes } from "./secao-configuracoes";

const itensDocumentos = [
  {
    titulo: "Proposta Comercial",
    descricao: "Usa logo, nome fantasia, razão social, CNPJ, telefone e endereço da empresa.",
    status: "Prévia disponível",
    aviso: "Prévia ao lado mostra exatamente o cabeçalho que sai no PDF.",
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
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          {itensDocumentos.map((item) => (
            <div key={item.titulo} className="flex flex-col gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-kx-texto">{item.titulo}</p>
                  <p className="mt-1 text-xs text-kx-legenda">{item.descricao}</p>
                </div>
                <PilulaStatus variante="neutro" className="shrink-0">
                  {item.status}
                </PilulaStatus>
              </div>

              <div className="rounded-kx-botao border border-dashed border-kx-campo-borda bg-kx-superficie p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">
                  Dados da empresa usados
                </p>
                <p className="mt-2 text-sm text-kx-texto-2">
                  Logo, nome fantasia, razão social, CNPJ, telefone principal e endereço completo.
                </p>
              </div>

              <p className="text-xs text-kx-legenda">{item.aviso}</p>

              <div>
                <Button type="button" variant="outline" size="sm" className="rounded-kx-botao" asChild>
                  <a href="#previa-cabecalho-documentos">
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Ver prévia
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-kx-texto">Impressão de Ordem de Serviço</p>
              <p className="mt-1 text-xs text-kx-legenda">
                Escolha o modelo padrão usado ao imprimir uma OS e personalize o cupom térmico.
              </p>
            </div>
            <PilulaStatus variante="sucesso" className="shrink-0">
              Persistência ativa
            </PilulaStatus>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-kx-texto">Modelo padrão de impressão da OS</Label>
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
                  <div className="flex items-center gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3">
                    <RadioGroupItem value="A4" id="modeloImpressaoOSPadrao-a4" />
                    <Label htmlFor="modeloImpressaoOSPadrao-a4" className="cursor-pointer font-normal text-kx-texto-2">
                      Folha A4
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3">
                    <RadioGroupItem value="TERMICA_80MM" id="modeloImpressaoOSPadrao-termica" />
                    <Label htmlFor="modeloImpressaoOSPadrao-termica" className="cursor-pointer font-normal text-kx-texto-2">
                      Impressora térmica 80 mm
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3">
            <div>
              <Label htmlFor="imprimirLogoTermica" className="cursor-pointer text-sm font-bold text-kx-texto">
                Imprimir logo no cupom térmico
              </Label>
              <p className="mt-1 text-xs text-kx-legenda">
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
            <Label htmlFor="mensagemRodapeImpressaoOS" className="text-xs font-bold text-kx-texto">
              Mensagem de rodapé da impressão
            </Label>
            <Textarea
              id="mensagemRodapeImpressaoOS"
              rows={3}
              maxLength={300}
              placeholder="Ex.: Garantia sujeita aos termos entregues junto ao equipamento."
              disabled={salvando}
              className="border-kx-campo-borda bg-kx-superficie"
              {...register("mensagemRodapeImpressaoOS")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-kx-texto">Mensagens padrão</p>
              <p className="mt-1 text-xs text-kx-legenda">
                Nesta etapa, apenas a mensagem do cupom/recibo possui persistência no modelo atual.
              </p>
            </div>
            <PilulaStatus variante="sucesso" className="shrink-0">
              Persistência ativa
            </PilulaStatus>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagemCupom" className="text-xs font-bold text-kx-texto">
              Mensagem padrão do cupom / recibo
            </Label>
            <Textarea
              id="mensagemCupom"
              rows={4}
              placeholder="Ex.: Obrigado pela preferência. Volte sempre."
              disabled={salvando}
              className="border-kx-campo-borda bg-kx-superficie"
              {...register("mensagemCupom")}
            />
          </div>

        </div>

        <PreviewIdentidadeEmpresa
          id="previa-cabecalho-documentos"
          configuracao={configuracaoAtual}
          titulo="Prévia do cabeçalho dos documentos"
          descricao="Simulação simples do topo usado em proposta, OS, garantia e recibos, com fallback seguro para campos ausentes."
          mostrarMensagemCupom
          compacta
        />

        <div className="rounded-kx-botao border border-kx-alerta/40 bg-kx-alerta-fundo p-4">
          <div className="mb-1 flex items-center gap-2">
            <PilulaStatus variante="alerta">Planejado</PilulaStatus>
            <p className="text-sm font-bold text-kx-alerta-texto">Extensões de documento sem migration nesta etapa</p>
          </div>
          <p className="text-xs text-kx-alerta-texto">
            Cabeçalho, rodapé e mensagens específicas de proposta, OS e garantia ficaram sinalizados, mas não foram persistidos fora do modelo atual.
          </p>
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
