import ForgotPasswordForm from "./ForgotPasswordForm";
import { parsePasswordRecoveryEntry } from "../../lib/password-recovery";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ source?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { source } = await searchParams;
  return <ForgotPasswordForm entry={parsePasswordRecoveryEntry(source)} />;
}

