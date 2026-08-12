export const PASSWORD_RECOVERY_COOKIE = "classflow_password_recovery";
export const PASSWORD_RECOVERY_MAX_AGE = 10 * 60;

export type PasswordRecoveryEntry = "admin" | "instructor";

export function parsePasswordRecoveryEntry(value: string | null | undefined): PasswordRecoveryEntry {
  return value === "instructor" ? "instructor" : "admin";
}

export function passwordRecoveryLoginPath(entry: PasswordRecoveryEntry) {
  return entry === "instructor" ? "/instructor/login" : "/login";
}

export function safeCallbackPath(value: string | null) {
  const allowedPaths = new Set(["/", "/instructor", "/update-password"]);
  return value && allowedPaths.has(value) ? value : "/";
}

