const { z } = require('zod');

const editorialLimits = {
  description: 500,
  editorial_text: 4000,
  agent_guidance: 12000,
};

const editorialSchema = z.object({
  description: z.string().trim().max(editorialLimits.description),
  editorial_text: z.string().trim().max(editorialLimits.editorial_text).nullable(),
  agent_guidance: z.string().trim().max(editorialLimits.agent_guidance).nullable(),
}).strict();

module.exports = { editorialLimits, editorialSchema };
