import { z } from 'zod';

import { method } from './method';
import { microservice } from './microservice';
// import { microservice } from './microservice';

export * from './method';
export * from './microservice';

@microservice({ name: 'omega', description: 'd', version: '' })
export class echo {

  // @method(z.string())
  public say(text: string): string {
    return text;
  }

  @method<z.ZodString, z.ZodString>({ request: z.string(), response: z.string(), subject: 'eeee' })
  public async shout(text: string): Promise<string> {
    return text.toUpperCase();
  }
}
