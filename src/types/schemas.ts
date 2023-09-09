import { z } from 'zod';

import { MicroserviceInfo } from './discovery.js';

export const registerMicroserviceRequestSchema = z.object({
  name: z.string(),
  id: z.string(),
  info: z.custom<MicroserviceInfo>(),
});

export type RegisterMicroserviceRequest = z.infer<typeof registerMicroserviceRequestSchema>;
