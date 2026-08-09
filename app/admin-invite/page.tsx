import AdminInviteForm from "./AdminInviteForm";

export const dynamic = "force-dynamic";

export default async function AdminInvitePage({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const params = await searchParams;
  return <AdminInviteForm email={params.email ?? ""} token={params.token ?? ""} />;
}
