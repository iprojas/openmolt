const { z } = require('zod');

const personalitySchema = z.object({
  tone: z.string().trim().max(500),
  interests: z.string().trim().max(1000),
  rules: z.string().trim().max(2000),
}).strict();

const personalityUpdateSchema = z.object({
  personality: personalitySchema,
  revision: z.number().int().nonnegative().max(2147483646),
});

module.exports = { personalitySchema, personalityUpdateSchema };
