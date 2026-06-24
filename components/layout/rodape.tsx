/**
 * Componente do Rodapé (Footer) do Dashboard
 */
export function Rodape() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-950 py-4">
      <div className="container mx-auto px-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <p>Powered by Konext © {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
