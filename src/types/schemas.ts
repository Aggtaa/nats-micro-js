import { z } from 'zod';

import { MicroserviceInfo } from './discovery.js';

export const MicroserviceRegistrationSubject = '$SRV.REGISTER';

export const microserviceRegistrationSchema = z.object({
  // name: z.string(),
  // id: z.string(),
  info: z.custom<MicroserviceInfo>(),
  state: z.enum(['up', 'down']),
});

export type MicroserviceRegistration = z.infer<typeof microserviceRegistrationSchema>;
