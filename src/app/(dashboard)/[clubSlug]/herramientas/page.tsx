import { redirect } from "next/navigation";

export default async function HerramientasPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  redirect(`/${clubSlug}/herramientas/eco-torneo`);
}
