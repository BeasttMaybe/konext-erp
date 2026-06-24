"use client";

import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UseFormRegister } from "react-hook-form";
import {
  CAMPOS_EMPRESA_PLANEJADOS,
  formatarCepVisual,
  formatarCnpjVisual,
  formatarTelefoneVisual,
} from "@/lib/configuracoes-documentos";
import { PreviewIdentidadeEmpresa } from "./preview-identidade-empresa";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelEmpresa = {
  register: UseFormRegister<DadosConfiguracoes>;
  buscandoCnpj: boolean;
  onBuscarCnpj: () => Promise<void>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

export function PainelEmpresa({
  register,
  buscandoCnpj,
  onBuscarCnpj,
  salvando,
  configuracaoAtual,
}: PropsPainelEmpresa) {
  const registroCnpj = register("cnpj", {
    onChange: (evento) => {
      evento.target.value = formatarCnpjVisual(evento.target.value);
    },
  });

  const registroTelefone = register("telefone", {
    onChange: (evento) => {
      evento.target.value = formatarTelefoneVisual(evento.target.value);
    },
  });

  const registroCep = register("cep", {
    onChange: (evento) => {
      evento.target.value = formatarCepVisual(evento.target.value);
    },
  });

  return (
    <SecaoConfiguracoes
      titulo="Empresa"
      descricao="Dados cadastrais e identidade institucional da empresa."
    >
      <div className="space-y-5">
        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Identificação da empresa</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Base cadastral usada nos documentos, impressões e cabeçalhos do ERP.
              </p>
            </div>
            <Badge variant="secondary">Persistência ativa</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão Social</Label>
              <Input id="razaoSocial" placeholder="Informe a razão social" {...register("razaoSocial")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
              <Input id="nomeFantasia" placeholder="Informe o nome fantasia" {...register("nomeFantasia")} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <Input id="cnpj" placeholder="00.000.000/0000-00" maxLength={18} {...registroCnpj} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onBuscarCnpj()}
                  disabled={buscandoCnpj || salvando}
                  className="whitespace-nowrap"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {buscandoCnpj ? "Buscando..." : "Buscar dados"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
              <Input
                id="inscricaoEstadual"
                placeholder="Informe a inscrição estadual"
                {...register("inscricaoEstadual")}
              />
            </div>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Contato</p>
          <p className="text-xs text-muted-foreground">
            Nesta etapa, o telefone principal já é persistido. Demais canais ficam sinalizados para expansão do modelo.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone Principal</Label>
              <Input id="telefone" placeholder="(00) 00000-0000" maxLength={15} {...registroTelefone} />
            </div>

            <div className="rounded-xl border border-dashed border-border bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Planejado para próxima etapa
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CAMPOS_EMPRESA_PLANEJADOS.contato.map((campo) => (
                  <Badge key={campo} variant="outline">
                    {campo}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Endereço</p>
          <p className="text-xs text-muted-foreground">
            CEP, logradouro e endereço completo seguem o fluxo atual, inclusive com apoio da busca por CNPJ.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" placeholder="00000-000" maxLength={9} {...registroCep} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input id="logradouro" placeholder="Rua / Avenida" {...register("logradouro")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" placeholder="123" {...register("numero")} />
            </div>

            <div className="rounded-xl border border-dashed border-border bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Planejado para próxima etapa
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CAMPOS_EMPRESA_PLANEJADOS.endereco.map((campo) => (
                  <Badge key={campo} variant="outline">
                    {campo}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" placeholder="Centro" {...register("bairro")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" placeholder="Sua cidade" {...register("cidade")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" placeholder="SP" maxLength={2} {...register("estado")} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço Completo</Label>
              <Textarea
                id="endereco"
                rows={3}
                placeholder="Rua, número, bairro, cidade, estado e CEP"
                {...register("endereco")}
              />
            </div>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Identidade visual</p>
          <p className="text-xs text-muted-foreground">
            A logo é usada nas áreas visuais já compatíveis e possui fallback seguro quando ausente.
          </p>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL da Logo da Empresa</Label>
            <Input id="logoUrl" placeholder="https://exemplo.com/logo.png" {...register("logoUrl")} />
          </div>
        </Card>

        <PreviewIdentidadeEmpresa
          configuracao={configuracaoAtual}
          titulo="Pré-visualização da identidade"
          descricao="Simulação simples do cabeçalho usado nas áreas de impressão e documentos do ERP."
        />
      </div>
    </SecaoConfiguracoes>
  );
}
