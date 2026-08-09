import { requireAdmin } from "../../lib/auth";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  return <SettingsClient currentAdmin={{
    userId: admin.user_id,
    name: admin.full_name,
    email: admin.email,
    role: admin.role,
  }} />;
}
