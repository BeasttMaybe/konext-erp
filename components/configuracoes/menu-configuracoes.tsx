"use client";

import {
  Building2,
  CloudUpload,
  FileText,
  Wrench,
  ShieldCheck,
  ShoppingCart,
  Tags,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { ItemSecaoConfiguracoes, SecaoConfiguracoesId } from "./tipos";

const iconesPorSecao: Record<SecaoConfiguracoesId, LucideIcon> = {
  empresa: Building2,
  documentos: FileText,
  os: Wrench,
  "marcas-peca": Tags,
  garantias: ShieldCheck,
  "pdv-caixa": ShoppingCart,
  armazenamento: CloudUpload,
  usuarios: UserCog,
};

type PropsMenuConfiguracoes = {
  secoes: ItemSecaoConfiguracoes[];
  secaoAtiva: SecaoConfiguracoesId;
  onSelecionarSecao: (secao: SecaoConfiguracoesId) => void;
};

/**
 * Coluna de seções (Fase 3-2E, Parte 1) — cada item empilha rótulo +
 * descrição, como na referência; a ativa ganha fundo elevado e a borda de
 * destaque à esquerda (não é mais um botão horizontal ícone+texto).
 */
export function MenuConfiguracoes({ secoes, secaoAtiva, onSelecionarSecao }: PropsMenuConfiguracoes) {
  return (
    <nav
      aria-label="Seções das configurações"
      className="flex shrink-0 flex-col gap-0.5 overflow-y-auto rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3 min-[1400px]:min-h-0"
    >
      {secoes.map((secao) => {
        const Icone = iconesPorSecao[secao.id];
        const ativo = secao.id === secaoAtiva;

        return (
          <button
            key={secao.id}
            type="button"
            onClick={() => onSelecionarSecao(secao.id)}
            aria-current={ativo ? "page" : undefined}
            className={`flex flex-col gap-0.5 rounded-kx-botao border-l-[3px] px-3.5 py-2.5 text-left transition-colors ${
              ativo
                ? "border-l-kx-destaque bg-kx-cartao text-kx-texto"
                : "border-l-transparent text-kx-texto-2 hover:bg-kx-superficie"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {secao.rotulo}
            </span>
            <span className={`pl-6 text-xs ${ativo ? "text-kx-texto-2" : "text-kx-legenda"}`}>{secao.descricao}</span>
          </button>
        );
      })}
    </nav>
  );
}
