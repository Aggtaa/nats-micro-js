import { microservice, method } from '../src';

@microservice({ name: 'echo', description: 'Decorated service' })
// @microservice() // can be as simple as this
export default class EchoMicroservice {

  // name is manual, subject is autodetected
  @method({ name: 'say' })
  private reply(text: string): string {
    return text;
  }

  // name is autodetected as 'config-change-event', subject is manual
  @method({ subject: '$EVT.config.change' })
  private configChangeEvent(change: unknown): void {
    console.log(change);
  }
}
