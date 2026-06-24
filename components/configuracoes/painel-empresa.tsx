"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import type { UseFormRegister } from "react-hook-form";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelEmpresa = {
  register: UseFormRegister<DadosConfiguracoes>;
  buscandoCnpj: boolean;
  onBuscarCnpj: () => Promise<void>;
  salvando: boolean;
};

export function PainelEmpresa({ register, buscandoCnpj, onBuscarCnpj, salvando }: PropsPainelEmpresa) {
  return (
    <SecaoConfiguracoes
      titulo="Empresa"
      descricao="Dados cadastrais e identidade institucional da empresa."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input id="razaoSocial" placeholder="Informe a razão social" {...register("razaoSocial")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nomeFantasia">Nome fantasia</Label>
          <Input id="nomeFantasia" placeholder="Informe o nome fantasia" {...register("nomeFantasia")} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <div className="flex items-end gap-2">
            <Input id="cnpj" placeholder="00.000.000/0000-00" {...register("cnpj")} />
            <Button
              type="button"
              variant="outline"
              onClick={() => void onBuscarCnpj()}
              disabled={buscandoCnpj || salvando}
              className="whitespace-nowrap"
            >
              <Search className="h-4 w-4 mr-2" />
              {buscandoCnpj ? "Buscando..." : "Buscar dados"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inscricaoEstadual">Inscrição estadual</Label>
          <Input id="inscricaoEstadual" placeholder="Informe a inscrição estadual" {...register("inscricaoEstadual")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone principal</Label>
          <Input id="telefone" placeholder="(00) 00000-0000" {...register("telefone")} />
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
          <Label htmlFor="endereco">Endereço completo</Label>
          <Textarea
            id="endereco"
            rows={3}
            placeholder="Rua, número, bairro, cidade, estado e CEP"
            {...register("endereco")}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="logoUrl">URL da logo da empresa</Label>
          <Input id="logoUrl" placeholder="https://exemplo.com/logo.png" {...register("logoUrl")} />
        </div>
      </div>

      <Card className="border-border bg-background p-4">
        <p className="text-sm font-medium text-foreground">Persistência ativa</p>
        <p className="text-xs text-muted-foreground mt-1">
          Esta seção mantém o fluxo atual de leitura e gravação em Configuracao, sem alteração de regra de negócio.
        </p>
      </Card>
    </SecaoConfiguracoes>
  );
}
