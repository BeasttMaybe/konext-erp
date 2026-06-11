"use client";

import { useMemo, useState } from "react";
import { useSidebar } from "@/contextos/contexto-sidebar";
import { useForm, Controller } from "react-hook-form";
import { Moon, Palette, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  consultarCnpjReceita,
  salvarConfiguracoes,
  type DadosConfiguracoes,
} from "@/app/actions/configuracoes";
import { useTheme } from "@/components/provedores/provedor-tema";

type PropsFormularioConfiguracoes = {
  defaultValues: DadosConfiguracoes;
};

export function FormConfiguracoes({ defaultValues }: PropsFormularioConfiguracoes) {
  const { contraida } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [abaAtiva, setAbaAtiva] = useState("empresa");
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const { register, handleSubmit, control, setValue, getValues } = useForm<DadosConfiguracoes>({
    defaultValues,
  });

  const montarEnderecoCompleto = (dados: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  }) => {
    const parteRua = [dados.logradouro, dados.numero].filter(Boolean).join(", ");
    const parteLocal = [dados.bairro, dados.cidade, dados.estado].filter(Boolean).join(" - ");
    const parteCep = dados.cep ? `CEP ${dados.cep}` : "";
    return [parteRua, parteLocal, parteCep].filter(Boolean).join(" | ");
  };

  const aoBuscarDadosCnpj = async () => {
    const cnpjAtual = getValues("cnpj");

    try {
      setBuscandoCnpj(true);
      const resultado = await consultarCnpjReceita(cnpjAtual);

      if (!resultado.sucesso) {
        toast.error("CNPJ inválido ou não encontrado na Receita.");
        return;
      }

      const { razaoSocial, cep, logradouro, numero, bairro, cidade, estado } = resultado.dados;

      setValue("razaoSocial", razaoSocial);
      setValue("cep", cep);
      setValue("logradouro", logradouro);
      setValue("numero", numero);
      setValue("bairro", bairro);
      setValue("cidade", cidade);
      setValue("estado", estado);
      setValue(
        "endereco",
        montarEnderecoCompleto({
          logradouro,
          numero,
          bairro,
          cidade,
          estado,
          cep,
        })
      );

      toast.success("Dados da empresa carregados com sucesso.");
    } catch {
      toast.error("CNPJ inválido ou não encontrado na Receita.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const onSubmit = async (dados: DadosConfiguracoes) => {
    try {
      setSalvando(true);
      await salvarConfiguracoes(dados);
      toast.success("Configurações salvas com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const textoBotaoSalvar = useMemo(() => {
    if (abaAtiva === "empresa") return "Salvar Dados da Empresa";
    if (abaAtiva === "pdv-financeiro") return "Salvar PDV e Financeiro";
    return "Salvar Configurações";
  }, [abaAtiva]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">
      <Card className="border-border bg-card p-6">
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
          <TabsList className="grid w-full grid-cols-1 gap-2 h-auto md:grid-cols-3 md:h-10">
            <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="pdv-financeiro">PDV e Financeiro</TabsTrigger>
            <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa" className="mt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input id="razaoSocial" placeholder="Informe a razão social" {...register("razaoSocial")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                <Input id="nomeFantasia" placeholder="Informe o nome fantasia" {...register("nomeFantasia")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <div className="flex items-end gap-2">
                  <Input id="cnpj" placeholder="00.000.000/0000-00" {...register("cnpj")} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={aoBuscarDadosCnpj}
                    disabled={buscandoCnpj}
                    className="whitespace-nowrap"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {buscandoCnpj ? "Buscando..." : "Buscar Dados"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                <Input id="inscricaoEstadual" placeholder="Informe a inscrição estadual" {...register("inscricaoEstadual")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" placeholder="00000000" {...register("cep")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input id="logradouro" placeholder="Rua / Avenida" {...register("logradouro")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" placeholder="123" {...register("numero")} />
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
                <Label htmlFor="telefone">Telefone Principal</Label>
                <Input id="telefone" placeholder="(00) 00000-0000" {...register("telefone")} />
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logoUrl">URL da Logo da Empresa</Label>
                <Input id="logoUrl" placeholder="https://exemplo.com/logo.png" {...register("logoUrl")} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pdv-financeiro" className="mt-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="chavePix">Chave PIX Padrão</Label>
                  <Input id="chavePix" placeholder="pix@konext.com.br" {...register("chavePix")} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="mensagemCupom">Mensagem Padrão do Cupom Fiscal</Label>
                  <Textarea
                    id="mensagemCupom"
                    rows={4}
                    placeholder="Obrigado pela preferência. Volte sempre!"
                    {...register("mensagemCupom")}
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
                    <Controller
                      name="habilitarMargemAutomatica"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                      )}
                    />
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
                    <Controller
                      name="permitirVendaSemEstoque"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                      )}
                    />
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
                  onClick={() => setTheme("light")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    theme === "light"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <span className="text-sm font-medium">Modo Claro</span>
                    </div>
                    {theme === "light" && <Badge>Ativo</Badge>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    theme === "dark"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span className="text-sm font-medium">Modo Escuro</span>
                    </div>
                    {theme === "dark" && <Badge>Ativo</Badge>}
                  </div>
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div
        className={`fixed bottom-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur px-6 py-3 transition-all duration-300 ${
          contraida ? "left-20" : "left-64"
        }`}
      >
        <Button type="submit" disabled={salvando} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
          {salvando ? "Salvando..." : textoBotaoSalvar}
        </Button>
      </div>
    </form>
  );
}
