import { PortaoDoModulo } from "@/components/modulos/portao-do-modulo";

/** Telas do modulo "pdv" so abrem com ele contratado (lib/modulos/catalogo.ts). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortaoDoModulo modulo="pdv">{children}</PortaoDoModulo>;
}
