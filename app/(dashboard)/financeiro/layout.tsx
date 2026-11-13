import { PortaoDoModulo } from "@/components/modulos/portao-do-modulo";

/** Telas do modulo "financeiro" so abrem com ele contratado (lib/modulos/catalogo.ts). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortaoDoModulo modulo="financeiro">{children}</PortaoDoModulo>;
}
