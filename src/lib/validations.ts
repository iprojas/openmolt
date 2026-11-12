import * as z from 'zod';
import { LIMITS } from './constants';

// Agent schemas
export const agentNameSchema = z.string()
  .min(LIMITS.AGENT_NAME_MIN, `El nombre necesita al menos ${LIMITS.AGENT_NAME_MIN} caracteres.`)
  .max(LIMITS.AGENT_NAME_MAX, `El nombre admite hasta ${LIMITS.AGENT_NAME_MAX} caracteres.`)
  .regex(/^[a-z0-9_]+$/i, 'Usa letras de la a a la z, números y guion bajo.');

export const registerAgentSchema = z.object({
  name: agentNameSchema,
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `La descripción admite hasta ${LIMITS.DESCRIPTION_MAX} caracteres.`).optional(),
});

export const updateAgentSchema = z.object({
  displayName: z.string().max(50, 'El nombre visible admite hasta 50 caracteres.').optional(),
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `La descripción admite hasta ${LIMITS.DESCRIPTION_MAX} caracteres.`).optional(),
});

// Post schemas
export const createPostSchema = z.object({
  submolt: z.string().min(1, 'Elige un Subchile.'),
  title: z.string()
    .min(1, 'Agrega un título.')
    .max(LIMITS.POST_TITLE_MAX, `El título admite hasta ${LIMITS.POST_TITLE_MAX} caracteres.`),
  content: z.string().max(LIMITS.POST_CONTENT_MAX, `El texto admite hasta ${LIMITS.POST_CONTENT_MAX} caracteres.`).optional(),
  url: z.string().url('Revisa el enlace.').optional().or(z.literal('')),
  postType: z.enum(['text', 'link']),
}).refine(
  data => (data.postType === 'text' && data.content) || (data.postType === 'link' && data.url),
  { message: 'Agrega un texto o un enlace para publicar.', path: ['content'] }
);

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'El comentario necesita algo de contenido.')
    .max(LIMITS.COMMENT_CONTENT_MAX, `El comentario admite hasta ${LIMITS.COMMENT_CONTENT_MAX} caracteres.`),
  parentId: z.string().optional(),
});

// Submolt schemas
export const submoltNameSchema = z.string()
  .min(LIMITS.SUBMOLT_NAME_MIN, `El nombre necesita al menos ${LIMITS.SUBMOLT_NAME_MIN} caracteres.`)
  .max(LIMITS.SUBMOLT_NAME_MAX, `El nombre admite hasta ${LIMITS.SUBMOLT_NAME_MAX} caracteres.`)
  .regex(/^[a-z0-9_]+$/, 'Usa letras minúsculas de la a a la z, números y guion bajo.');

export const createSubmoltSchema = z.object({
  name: submoltNameSchema,
  displayName: z.string().max(50, 'El nombre visible admite hasta 50 caracteres.').optional(),
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `La descripción admite hasta ${LIMITS.DESCRIPTION_MAX} caracteres.`).optional(),
});

// Auth schemas
export const loginSchema = z.object({
  apiKey: z.string()
    .min(1, 'Ingresa la clave API.')
    .regex(/^moltbook_/, 'La clave API debe comenzar con «moltbook_».'),
});

// Search schemas
export const searchSchema = z.object({
  query: z.string().min(2, 'Escribe al menos 2 caracteres para buscar.'),
  limit: z.number().min(1).max(LIMITS.MAX_PAGE_SIZE).optional(),
});

// Types from schemas
export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateSubmoltInput = z.infer<typeof createSubmoltSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
