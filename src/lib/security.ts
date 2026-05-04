import { z } from 'zod';

// ---- Schemas Zod compartilhados (validação client-side) ----
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail')
  .max(254, 'E-mail muito longo')
  .email('E-mail inválido');

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(128, 'Senha muito longa');

export const strongPasswordSchema = passwordSchema
  .regex(/[A-Z]/, 'A senha precisa ter ao menos uma letra maiúscula')
  .regex(/[a-z]/, 'A senha precisa ter ao menos uma letra minúscula')
  .regex(/[0-9]/, 'A senha precisa ter ao menos um número');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Informe seu nome completo')
  .max(120, 'Nome muito longo')
  .regex(/^[\p{L}\p{M} '\-.]+$/u, 'Nome contém caracteres inválidos');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
});

export const forgotSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'A confirmação não corresponde à nova senha',
  });

// ---- Fingerprint estável e leve do navegador (não-PII) ----
export function getDeviceFingerprint(): string {
  try {
    const KEY = 'ycaptura_device_fp';
    const cached = localStorage.getItem(KEY);
    if (cached) return cached;
    const seed = `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}|${new Date().getTimezoneOffset()}|${crypto.randomUUID()}`;
    // hash simples (FNV-1a like) só para encurtar — não é segredo
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    const fp = h.toString(16).padStart(8, '0') + '-' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem(KEY, fp);
    return fp;
  } catch {
    return 'anon-' + Math.random().toString(16).slice(2, 10);
  }
}

export function getUserAgent(): string {
  try {
    return (navigator.userAgent || '').slice(0, 500);
  } catch {
    return '';
  }
}
