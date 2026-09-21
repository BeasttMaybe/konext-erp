"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarUsuariosDaEmpresa, type UsuarioListado } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { ModalEditarUsuario } from "./modal-editar-usuario";
import { ModalTransferirPropriedade } from "./modal-transferir-propriedade";

function formatarUltimoAcesso(iso: string | null): string {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

function buscarUsuarios(
  aoConcluir: (usuarios: UsuarioListado[]) => void,
  aoFinalizar: () => void
) {
  listarUsuariosDaEmpresa()
    .then((resultado) => {
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        aoConcluir([]);
        return;
      }
      aoConcluir(resultado.dados);
    })
    .finally(aoFinalizar);
}

/**
 * Aba Usuários (Fase 3-2E, Parte 3) — referência: referencia-
 * configuracoes-usuarios.html. Linhas em cartão (grid), não `<table>` —
 * mesmo padrão das telas já restiladas do Financeiro. "Fixo"/cor por
 * cargo não aparecem aqui: UsuarioListado não carrega nenhum dos dois, e
 * inventar cor por cargo sem dado real por trás seria decoração sem
 * significado.
 */
export function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioListado | null>(null);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);

  const recarregar = () => {
    setCarregando(true);
    buscarUsuarios(setUsuarios, () => setCarregando(false));
  };

  useEffect(() => {
    buscarUsuarios(setUsuarios, () => setCarregando(false));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_130px_110px_85px_160px] gap-3 px-3 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
        <span>Pessoa</span>
        <span>Cargo</span>
        <span>Último acesso</span>
        <span>Situação</span>
        <span className="text-right">Ação</span>
      </div>

      <div className="flex flex-col gap-2">
        {carregando ? (
          <p className="py-8 text-center text-sm text-kx-legenda">Carregando usuários...</p>
        ) : !usuarios || usuarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-kx-legenda">Nenhum usuário encontrado.</p>
        ) : (
          usuarios.map((usuario) => (
            <div
              key={usuario.usuarioEmpresaId}
              className="grid grid-cols-1 gap-2 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1.4fr)_130px_110px_85px_160px] sm:items-center sm:gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-primaria/15 text-xs font-extrabold text-kx-primaria">
                  {iniciaisDoNome(usuario.nome)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate">
                    <span className="font-bold text-kx-texto">{usuario.nome}</span>
                    {usuario.souEu && <span className="text-xs text-kx-legenda">(você)</span>}
                    {usuario.ehProprietario && (
                      <PilulaStatus variante="garantia" className="shrink-0">
                        Responsável pela loja
                      </PilulaStatus>
                    )}
                  </span>
                  <span className="truncate text-xs text-kx-legenda">{usuario.email}</span>
                </div>
              </div>

              <span>
                <PilulaStatus variante="neutro" className="w-fit">
                  {usuario.cargoNome}
                </PilulaStatus>
              </span>

              <span className="text-kx-texto-2">{formatarUltimoAcesso(usuario.ultimoAcessoEm)}</span>

              <span className="flex items-center gap-2 font-semibold">
                <span className={`h-2 w-2 rounded-full ${usuario.ativo ? "bg-kx-sucesso" : "bg-kx-legenda"}`} />
                <span className={usuario.ativo ? "text-kx-sucesso-texto" : "text-kx-legenda"}>
                  {usuario.ativo ? "Ativo" : "Desativado"}
                </span>
              </span>

              <span className="flex justify-end">
                {usuario.ehProprietario ? (
                  usuario.souEu && (
                    <Button type="button" variant="outline" size="sm" className="rounded-kx-botao" onClick={() => setTransferenciaAberta(true)}>
                      Transferir titularidade
                    </Button>
                  )
                ) : (
                  <Button type="button" variant="outline" size="sm" className="rounded-kx-botao" onClick={() => setUsuarioEmEdicao(usuario)}>
                    Editar
                  </Button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {usuarioEmEdicao && (
        <ModalEditarUsuario
          usuario={usuarioEmEdicao}
          aberto
          onFechar={() => setUsuarioEmEdicao(null)}
          onSalvo={() => {
            setUsuarioEmEdicao(null);
            recarregar();
          }}
        />
      )}

      {transferenciaAberta && usuarios && (
        <ModalTransferirPropriedade
          usuarios={usuarios}
          proprietarioAtualId={usuarios.find((usuario) => usuario.ehProprietario)?.usuarioEmpresaId ?? ""}
          aberto
          onFechar={() => setTransferenciaAberta(false)}
          onTransferido={() => {
            setTransferenciaAberta(false);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
