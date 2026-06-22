import { notFound } from "next/navigation";
import { obterMetaPorId } from "@/app/actions/metas";
import { DetalheMetaCliente } from "@/components/metas/detalhe-meta-cliente";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MetaDetalhePage({ params }: Props) {
  const { id } = await params;
  const meta = await obterMetaPorId(id);

  if (!meta) {
    notFound();
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <DetalheMetaCliente meta={meta} />
        </div>
      </div>
    </div>
  );
}
