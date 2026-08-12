import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE,
  parsePasswordRecoveryEntry,
  safeCallbackPath,
} from "../../../lib/password-recovery";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeCallbackPath(request.nextUrl.searchParams.get("next"));
  const isPasswordRecovery =
    request.nextUrl.searchParams.get("flow") === "password_recovery" && next === "/update-password";
  const entry = parsePasswordRecoveryEntry(request.nextUrl.searchParams.get("source"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url));
      if (isPasswordRecovery) {
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, entry, {
          httpOnly: true,
          maxAge: PASSWORD_RECOVERY_MAX_AGE,
          path: "/",
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
        });
      }
      return response;
    }
  }

  if (isPasswordRecovery) {
    const target = new URL("/update-password", request.url);
    target.searchParams.set("error", "invalid");
    target.searchParams.set("source", entry);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
