import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  parsePasswordRecoveryEntry,
} from "../../lib/password-recovery";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const cookieStore = await cookies();
  const recoveryCookie = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  const entry = parsePasswordRecoveryEntry(recoveryCookie);
  const hasRecoveryMarker = recoveryCookie === "admin" || recoveryCookie === "instructor";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const hasRecoverySession = hasRecoveryMarker && !error && Boolean(data.user);

  return <UpdatePasswordForm entry={entry} initialRecoverySession={hasRecoverySession} />;
}

