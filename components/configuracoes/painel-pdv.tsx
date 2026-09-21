"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelPdv = {
  register: UseFormRegister<DadosConfiguracoes>;
  control: Control<DadosConfiguracoes>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

type CampoTogglePdv =
  | "permitirPagamentoMisto"
  | "permitirDescontoPDV"
  | "permitirVendaFiado"
  | "permitirVendaSemEstoque"
  | "habilitarPix"
  | "habilitarDinheiro"
  | "habilitarCartaoDebito"
  | "habilitarCartaoCredito"
  | "habilitarBoleto"
  | "habilitarCrediario"
  | "fechamentoAutomaticoCaixaAtivo";

type BlocoToggleProps = {
  control: Control<DadosConfiguracoes>;
  campo: CampoTogglePdv;
  titulo: string;
  descricao: string;
};

function BlocoToggle({ control, campo, titulo, descricao }: BlocoToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3.5">
      <div className="space-y-0.5">
        <Label htmlFor={campo} className="cursor-pointer text-sm font-bold text-kx-texto">
          {titulo}
        </Label>
        <p className="text-xs text-kx-legenda">{descricao}</p>
      </div>
      <Controller
        name={campo}
        control={control}
        render={({ field }) => (
          <Switch id={campo} checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
        )}
      />
    </div>
  );
}

const CAMPOS_TAXA_CREDITO: Array<{ campo: keyof DadosConfiguracoes; label: string }> = [
  { campo: "taxaCartaoCredito1xPercentual", label: "Crédito 1x" },
  { campo: "taxaCartaoCredito2xPercentual", label: "Crédito 2x" },
  { campo: "taxaCartaoCredito3xPercentual", label: "Crédito 3x" },
  { campo: "taxaCartaoCredito4xPercentual", label: "Crédito 4x" },
  { campo: "taxaCartaoCredito5xPercentual", label: "Crédito 5x" },
  { campo: "taxaCartaoCredito6xPercentual", label: "Crédito 6x" },
  { campo: "taxaCartaoCredito7xPercentual", label: "Crédito 7x" },
  { campo: "taxaCartaoCredito8xPercentual", label: "Crédito 8x" },
  { campo: "taxaCartaoCredito9xPercentual", label: "Crédito 9x" },
  { campo: "taxaCartaoCredito10xPercentual", label: "Crédito 10x" },
  { campo: "taxaCartaoCredito11xPercentual", label: "Crédito 11x" },
  { campo: "taxaCartaoCredito12xPercentual", label: "Crédito 12x" },
];

export function PainelPdv({ register, control, salvando, configuracaoAtual }: PropsPainelPdv) {
  return (
    <SecaoConfiguracoes
      titulo="PDV e Caixa"
      descricao="Defina regras de recebimento, descontos, crediário, taxas de pagamento e fechamento do caixa."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-kx-texto">Regras comerciais no caixa</p>
              <p className="mt-1 text-xs text-kx-legenda">
                Estas preferências são validadas no backend antes de concluir vendas no PDV.
              </p>
            </div>
            <PilulaStatus variante="neutro" className="shrink-0">
              Até {configuracaoAtual.maxParcelasCartaoCredito}x no crédito
            </PilulaStatus>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggle
              control={control}
              campo="permitirPagamentoMisto"
              titulo="Permitir pagamento misto"
              descricao="Autoriza dividir uma venda em várias formas de pagamento."
            />
            <BlocoToggle
              control={control}
              campo="permitirDescontoPDV"
              titulo="Permitir desconto no PDV"
              descricao="Habilita desconto manual no fechamento da venda."
            />
            <BlocoToggle
              control={control}
              campo="permitirVendaFiado"
              titulo="Permitir venda fiado"
              descricao="Permite gerar venda sem recebimento imediato."
            />
            <BlocoToggle
              control={control}
              campo="permitirVendaSemEstoque"
              titulo="Permitir venda sem estoque"
              descricao="Autoriza vender um item mesmo com saldo zerado ou negativo."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="descontoMaximoPDVPercentual" className="text-xs font-bold text-kx-texto">
                Desconto máximo no PDV (%)
              </Label>
              <Input
                id="descontoMaximoPDVPercentual"
                type="number"
                min={0}
                max={100}
                step="0.01"
                disabled={salvando || !configuracaoAtual.permitirDescontoPDV}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("descontoMaximoPDVPercentual", { valueAsNumber: true })}
              />
              <p className="text-xs text-kx-legenda">
                Com 0%, ninguém sem a permissão &quot;Aplicar desconto acima do limite&quot; consegue dar desconto.
              </p>
              {configuracaoAtual.permitirDescontoPDV && configuracaoAtual.descontoMaximoPDVPercentual === 0 && (
                <p className="text-xs font-medium text-kx-alerta-texto">
                  Atenção: desconto está permitido, mas o limite está em 0% — na prática, ninguém sem aquela permissão
                  especial consegue aplicar desconto nenhum. Se não é essa a intenção, ajuste um dos dois campos.
                </p>
              )}
              {!configuracaoAtual.permitirDescontoPDV && configuracaoAtual.descontoMaximoPDVPercentual > 0 && (
                <p className="text-xs font-medium text-kx-alerta-texto">
                  Atenção: desconto está desligado, mas há um limite de {configuracaoAtual.descontoMaximoPDVPercentual}%
                  configurado — ele não tem efeito enquanto &quot;Permitir desconto no PDV&quot; estiver desmarcado.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxParcelasCartaoCredito" className="text-xs font-bold text-kx-texto">
                Máximo de parcelas no crédito
              </Label>
              <Input
                id="maxParcelasCartaoCredito"
                type="number"
                min={1}
                max={12}
                disabled={salvando || !configuracaoAtual.habilitarCartaoCredito}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("maxParcelasCartaoCredito", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Formas de pagamento habilitadas</p>
            <p className="text-xs text-kx-legenda">
              Mantenha pelo menos uma forma ativa para o fluxo de vendas continuar funcionando.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggle control={control} campo="habilitarPix" titulo="PIX" descricao="Permite recebimento instantâneo por chave ou QR Code." />
            <BlocoToggle control={control} campo="habilitarDinheiro" titulo="Dinheiro" descricao="Mantém recebimento em espécie no fechamento do caixa." />
            <BlocoToggle control={control} campo="habilitarCartaoDebito" titulo="Cartão de débito" descricao="Habilita pagamentos no débito com taxa configurável." />
            <BlocoToggle control={control} campo="habilitarCartaoCredito" titulo="Cartão de crédito" descricao="Permite parcelamento com taxa por quantidade de parcelas." />
            <BlocoToggle control={control} campo="habilitarBoleto" titulo="Boleto" descricao="Permite venda com vencimento futuro por boleto." />
            <BlocoToggle control={control} campo="habilitarCrediario" titulo="Crediário" descricao="Habilita recebimento a prazo com vencimento configurado." />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Taxas e vencimentos</p>
            <p className="text-xs text-kx-legenda">Use taxas em percentual e prazos em dias. Exemplo: 2,5 significa 2,5%.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="taxaCartaoDebitoPercentual" className="text-xs font-bold text-kx-texto">
                Taxa no débito (%)
              </Label>
              <Input
                id="taxaCartaoDebitoPercentual"
                type="number"
                min={0}
                step="0.01"
                disabled={salvando || !configuracaoAtual.habilitarCartaoDebito}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("taxaCartaoDebitoPercentual", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazoPadraoBoletoDias" className="text-xs font-bold text-kx-texto">
                Prazo padrão do boleto (dias)
              </Label>
              <Input
                id="prazoPadraoBoletoDias"
                type="number"
                min={1}
                max={365}
                disabled={salvando || !configuracaoAtual.habilitarBoleto}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("prazoPadraoBoletoDias", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazoPadraoCrediarioDias" className="text-xs font-bold text-kx-texto">
                Prazo padrão do crediário (dias)
              </Label>
              <Input
                id="prazoPadraoCrediarioDias"
                type="number"
                min={1}
                max={365}
                disabled={salvando || !configuracaoAtual.habilitarCrediario}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("prazoPadraoCrediarioDias", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CAMPOS_TAXA_CREDITO.map((item) => (
              <div key={String(item.campo)} className="space-y-1.5">
                <Label htmlFor={String(item.campo)} className="text-xs font-bold text-kx-texto">
                  {item.label} (%)
                </Label>
                <Input
                  id={String(item.campo)}
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={salvando || !configuracaoAtual.habilitarCartaoCredito}
                  className="h-11 border-kx-campo-borda bg-kx-superficie"
                  {...register(item.campo as keyof DadosConfiguracoes, { valueAsNumber: true })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Fechamento automático de caixa</p>
            <p className="text-xs text-kx-legenda">
              Encerra sozinho qualquer sessão de caixa que ficar aberta até o horário definido.
            </p>
          </div>

          <div className="rounded-kx-botao border border-kx-alerta/40 bg-kx-alerta-fundo px-3 py-2 text-xs text-kx-alerta-texto">
            Esta configuração ainda não faz nada sozinha: ela só fica salva aqui. O fechamento automático em si
            depende de uma tarefa agendada que ainda não existe — passa a valer quando ela for implementada numa
            fase futura.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggle
              control={control}
              campo="fechamentoAutomaticoCaixaAtivo"
              titulo="Fechar caixa automaticamente"
              descricao="Liga a regra de fechamento — sem efeito até a tarefa agendada existir (ver aviso acima)."
            />

            <div className="space-y-1.5">
              <Label htmlFor="fechamentoAutomaticoCaixaHorario" className="text-xs font-bold text-kx-texto">
                Horário do fechamento
              </Label>
              <Input
                id="fechamentoAutomaticoCaixaHorario"
                type="time"
                disabled={salvando || !configuracaoAtual.fechamentoAutomaticoCaixaAtivo}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("fechamentoAutomaticoCaixaHorario")}
              />
            </div>
          </div>
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
