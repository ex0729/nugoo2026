import ClassFlowApp from "./ClassFlowApp";
import { requireAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = await requireAdmin();
  return <ClassFlowApp currentAdmin={{ name: admin.full_name, email: admin.email, role: admin.role }} />;
}
