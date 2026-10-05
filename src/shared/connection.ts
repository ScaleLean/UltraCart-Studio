import { z } from 'zod';

export const profileSelector = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  merchantId: z.string().nullable(),
});
export const storefrontSchema = z.object({
  id: z.number().int().positive(),
  host: z.string(),
  themeId: z.number().int().nullable(),
});
export const selectionSchema = z.object({
  profileId: profileSelector,
  merchantId: z.string(),
  storefront: storefrontSchema,
  verifiedAt: z.string(),
});
export const loginSchema = z.object({
  id: z.string(),
  profile: profileSelector,
  phase: z.enum(['starting', 'waiting', 'succeeded', 'failed', 'cancelled']),
  url: z.string().nullable(),
  code: z.string().nullable(),
  message: z.string(),
});
export type Selection = z.infer<typeof selectionSchema>;
export type Login = z.infer<typeof loginSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Storefront = z.infer<typeof storefrontSchema>;
