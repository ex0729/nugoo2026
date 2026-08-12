const commonFragments = ["password", "qwerty", "123456", "admin", "letmein", "nugoo", "ngn2021"];

export function passwordPolicyError(password: string) {
  if (password.length < 12) return "비밀번호는 12자 이상이어야 합니다.";
  const categories = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (categories < 3) return "영문 대·소문자, 숫자, 특수문자 중 3종 이상을 조합해 주세요.";
  const lowered = password.toLowerCase();
  if (commonFragments.some(fragment => lowered.includes(fragment))) return "쉽게 추측되거나 유출 가능성이 높은 문구는 사용할 수 없습니다.";
  return null;
}
