"use client";

import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PilulaStatus } from "@/components/ui/pilula-status";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import {
  formatarCepVisual,
  formatarCnpjVisual,
  formatarTelefoneVisual,
} from "@/lib/configuracoes-documentos";
import { EnvioDaLogo } from "./envio-da-logo";
import { PreviewIdentidadeEmpresa } from "./preview-identidade-empresa";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelEmpresa = {
  register: UseFormRegister<DadosConfiguracoes>;
  setValue: UseFormSetValue<DadosConfiguracoes>;
  buscandoCnpj: boolean;
  onBuscarCnpj: () => Promise<void>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

/**
 * Empresa (Fase 3-2E, Parte 2) — referência: referencia-configuracoes-
 * empresa.html. Três campos que a referência mostra não existem no
 * modelo real e por isso NÃO foram inventados aqui: "E-mail de contato"
 * (ainda sem campo proprio),
 * "Mostrar endereço no link de rastreio" (nenhum campo correspondente em
 * DadosConfiguracoes). A logo é enviada como arquivo (EnvioDaLogo), com o
 * link de imagem como alternativa.
 */
export function PainelEmpresa({
  register,
  setValue,
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

  const registroLogoUrl = register("logoUrl");

  return (
    <SecaoConfiguracoes
      titulo="Empresa"
      descricao="Dados cadastrais e identidade institucional da empresa."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-kx-texto">Dados da empresa</span>
              <span className="text-xs text-kx-legenda">Aparecem na OS, no termo de garantia e no cupom do PDV</span>
            </div>
          </div>

          <EnvioDaLogo
            logoUrl={configuracaoAtual.logoUrl}
            nomeFantasia={configuracaoAtual.nomeFantasia}
            campoDoLink={registroLogoUrl}
            aoMudarLogo={(url, gravado) => setValue("logoUrl", url, { shouldDirty: !gravado })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nomeFantasia" className="text-xs font-bold text-kx-texto">
                Nome fantasia
              </Label>
              <Input id="nomeFantasia" placeholder="Informe o nome fantasia" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("nomeFantasia")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="razaoSocial" className="text-xs font-bold text-kx-texto">
                Razão social
              </Label>
              <Input id="razaoSocial" placeholder="Informe a razão social" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("razaoSocial")} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cnpj" className="text-xs font-bold text-kx-texto">
                CNPJ
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="cnpj" placeholder="00.000.000/0000-00" maxLength={18} className="h-11 border-kx-campo-borda bg-kx-superficie" {...registroCnpj} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onBuscarCnpj()}
                  disabled={buscandoCnpj || salvando}
                  className="h-11 shrink-0 rounded-kx-botao whitespace-nowrap"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {buscandoCnpj ? "Buscando..." : "Buscar dados"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inscricaoEstadual" className="text-xs font-bold text-kx-texto">
                Inscrição estadual
              </Label>
              <Input id="inscricaoEstadual" placeholder="Informe a inscrição estadual" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("inscricaoEstadual")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefone" className="text-xs font-bold text-kx-texto">
                Telefone / WhatsApp
              </Label>
              <Input id="telefone" placeholder="(00) 00000-0000" maxLength={15} className="h-11 border-kx-campo-borda bg-kx-superficie" {...registroTelefone} />
            </div>
          </div>

        </div>

        <div className="flex flex-col gap-5 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-kx-texto">Endereço e atendimento</span>
            <span className="text-xs text-kx-legenda">Usado nos documentos e no link de rastreio do cliente</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cep" className="text-xs font-bold text-kx-texto">
                CEP
              </Label>
              <Input id="cep" placeholder="00000-000" maxLength={9} className="h-11 border-kx-campo-borda bg-kx-superficie" {...registroCep} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logradouro" className="text-xs font-bold text-kx-texto">
                Logradouro
              </Label>
              <Input id="logradouro" placeholder="Rua / Avenida" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("logradouro")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero" className="text-xs font-bold text-kx-texto">
                Número
              </Label>
              <Input id="numero" placeholder="123" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("numero")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bairro" className="text-xs font-bold text-kx-texto">
                Bairro
              </Label>
              <Input id="bairro" placeholder="Centro" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("bairro")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cidade" className="text-xs font-bold text-kx-texto">
                Cidade
              </Label>
              <Input id="cidade" placeholder="Sua cidade" className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("cidade")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estado" className="text-xs font-bold text-kx-texto">
                Estado (UF)
              </Label>
              <Input id="estado" placeholder="SP" maxLength={2} className="h-11 border-kx-campo-borda bg-kx-superficie" {...register("estado")} />
            </div>
          </div>

          {/* O campo de texto livre "Endereço completo" saiu daqui.
              Ele duplicava os seis campos acima — e, pior, GANHAVA deles: o
              dono preenchia CEP, rua, número, bairro, cidade e estado, e
              nenhum aparecia em documento algum enquanto o texto livre
              estivesse preenchido. O CEP nunca aparecia em lugar nenhum.

              A coluna continua no banco e ainda é usada como reserva para
              quem nunca preencheu os campos separados (ver
              `montarEnderecoEmpresa`): tirar da tela para de criar trabalho
              dobrado sem encolher o endereço de ninguém. */}

        </div>

        <PreviewIdentidadeEmpresa
          configuracao={configuracaoAtual}
          titulo="Pré-visualização da identidade"
          descricao="Simulação simples do cabeçalho usado nas áreas de impressão e documentos do ERP."
        />
      </div>
    </SecaoConfiguracoes>
  );
}
