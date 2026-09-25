export const isPlausiblePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

export const isValidPassword = (value: string) =>
  value.length > 6 && /[A-Z]/.test(value) && /[0-9]/.test(value);
