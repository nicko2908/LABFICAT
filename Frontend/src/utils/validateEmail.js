const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(valor) {
  return PATRON_EMAIL.test(String(valor ?? "").trim());
}
