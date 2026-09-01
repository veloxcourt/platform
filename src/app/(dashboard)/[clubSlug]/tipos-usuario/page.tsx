import { redirect } from "next/navigation";

export default async function UserTypesRedirectPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  redirect(`/${clubSlug}/control-usuarios/tipo-usuario`);
}
