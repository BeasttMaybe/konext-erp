export const metadata = {
  title: "Auth - Konext ERP",
  description: "Autenticação do Konext ERP",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      {children}
    </div>
  );
}
