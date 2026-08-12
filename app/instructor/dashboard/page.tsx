import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth";
import InstructorDashboardClient from "./InstructorDashboardClient";

export const dynamic = "force-dynamic";

export default async function InstructorDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/instructor/login");
  if (profile.role !== "instructor") redirect("/");
  if (profile.status !== "active") redirect("/instructor");
  return <InstructorDashboardClient instructorName={profile.full_name.trim() || "강사"} />;
}
