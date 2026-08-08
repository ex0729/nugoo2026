import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type UserRole = "instructor" | "company_member" | "service_admin" | "super_admin";
export type UserStatus = "pending" | "active" | "suspended";

export type UserProfile = {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export const ADMIN_ROLES: UserRole[] = ["super_admin", "service_admin"];

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("user_id,email,full_name,role,status,created_at,updated_at")
    .eq("user_id", user.id)
    .single<UserProfile>();

  if (error || !profile) return null;
  return profile;
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.status !== "active" || (profile.role !== "super_admin" && profile.role !== "service_admin")) {
    redirect("/access-pending");
  }

  return profile as UserProfile & {
    role: "super_admin" | "service_admin";
    status: "active";
  };
}
