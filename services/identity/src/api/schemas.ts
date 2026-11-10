import { z } from 'zod'

export const registerBody = z.object({
  profile: z.enum(['lawyer', 'common_user']),
  fullName: z.string(),
  email: z.string(),
  cpf: z.string(),
  oab: z.string().optional(),
  password: z.string(),
  passwordConfirmation: z.string(),
  acceptedTerms: z.boolean(),
})

export const credentialsBody = z.object({
  email: z.string(),
  password: z.string(),
})

export const refreshBody = z.object({
  refreshToken: z.string().min(20),
})

export const emailBody = z.object({
  email: z.string(),
})

export const tokenBody = z.object({
  token: z.string().min(20),
})

export const resetBody = z.object({
  token: z.string().min(20),
  password: z.string(),
  passwordConfirmation: z.string(),
})
