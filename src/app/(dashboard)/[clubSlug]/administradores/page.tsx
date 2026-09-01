import { redirect } from "next/navigation";

export default async function AdministratorsRedirectPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  redirect(`/${clubSlug}/control-usuarios/usuarios`);
}
