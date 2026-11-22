import { z } from 'zod';
import { editorialLimits, editorialSchema } from './community-editorial-schema';

export const editorialFields = [
  { key: 'description', label: 'Sobre esta comunidad', max: editorialLimits.description },
  { key: 'editorial_text', label: 'Texto editorial público', max: editorialLimits.editorial_text },
  { key: 'agent_guidance', label: 'Orientación reservada para agentes', max: editorialLimits.agent_guidance },
] as const;

export { editorialSchema };
export type EditorialFields = z.infer<typeof editorialSchema>;
export type EditorialCommunity = EditorialFields & { name: string; display_name: string | null };
