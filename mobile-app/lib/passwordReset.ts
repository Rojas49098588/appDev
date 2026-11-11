// Pure helpers for the Forgot password screen.

// Supabase codes are 6 to 10 digits, set per project (ours send 8).
const MIN_CODE_DIGITS = 6;
const MAX_CODE_DIGITS = 10;

// People paste codes with spaces or dashes; keep only the digits.
export function cleanResetCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

// What's wrong with the reset form, or null if it's ready to send. Pass a null
// code once the code has been accepted, to check only the passwords.
export function resetFormProblem(code: string | null, password: string, confirmPassword: string): string | null {
  if (code !== null) {
    const digits = cleanResetCode(code);
    if (!digits) return 'Enter the code from the email.';
    if (digits.length < MIN_CODE_DIGITS || digits.length > MAX_CODE_DIGITS) {
      return "That doesn't look like the full code. Check the email and try again.";
    }
  }
  if (!password) return 'Enter a new password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}
