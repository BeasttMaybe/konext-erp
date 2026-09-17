/**
 * SHIM DE COMPATIBILIDADE.
 *
 * Os mapas de rotulo e cor de status vivem agora em
 * `lib/dominio/os/maquina-estados.ts`, fonte unica de verdade do ciclo de vida
 * da OS. Este arquivo so re-exporta para nao quebrar os importadores atuais:
 *   - components/os/cartao-os.tsx
 *   - components/os/coluna-kanban.tsx  (componente morto, ver AUDIT_REPORT 17.2)
 *
 * O nome "mock-os" tambem e enganoso: nunca houve dado mockado aqui (F-67).
 * Nao adicione nada novo neste arquivo.
 */

import { CLASSES_STATUS_OS, ROTULOS_STATUS_OS } from "@/lib/dominio/os/maquina-estados";

export const mapStatusLabel: Record<string, string> = ROTULOS_STATUS_OS;

export const mapStatusColor: Record<string, string> = Object.fromEntries(
  Object.entries(CLASSES_STATUS_OS).map(([status, classes]) => [status, classes.chip])
);
