import EventEmitter from 'events';

import { Broker } from './broker.js';
import { debug } from './debug.js';
import {
  Message, MicroserviceInfo, MicroserviceRegistration, MicroserviceRegistrationSubject,
} from './types/index.js';
import { wrapMethod, wrapThread } from './utils.js';

export type MonitorDiscoveryOptions = {
  doNotClear: boolean;
}

export type DiscoveredMicroservice = MicroserviceInfo & {
  firstFoundAt: Date;
  lastFoundAt: Date;
}

type UserConnectEvent = {
  client: {
    id: number;
    acc: string;
  }
}

type UserDisconnectEvent = UserConnectEvent;

export class Monitor extends EventEmitter {

  public readonly services: DiscoveredMicroservice[] = [];
  private discoveryInterval: NodeJS.Timer | undefined;

  constructor(
    private readonly broker: Broker,
    systemBroker?: Broker,
  ) {
    super();

    const handleServiceRegistration = wrapMethod(this.broker, wrapThread('monitor', this.handleServiceRegistration.bind(this)), 'handleServiceStatus');
    broker.on(MicroserviceRegistrationSubject, handleServiceRegistration);

    if (systemBroker)
      systemBroker.on('$SYS.ACCOUNT.*.DISCONNECT', this.handleAccountDisconnect.bind(this));

    this.discover(30000); // clear cache and do discovery in background
  }

  private handleServiceRegistration(data: MicroserviceRegistration): void {
    this.saveService(data.info);
  }

  private async handleAccountDisconnect(msg: Message<UserDisconnectEvent>): Promise<void> {
    const clientId = msg.data.client.id;

    let count = 0;
    let idx = 0;
    while (idx < this.services.length) {
      const service = this.services[idx];

      if (this.getServiceClientId(service) === clientId) {
        const removed = this.services.splice(idx, 1);
        count++;
        this.emit('removed', removed[0]);
      }
      else
        idx++;
    }

    debug.monitor.info(`Client ${clientId} disconnected, removing ${count} microservices`);

    this.emit('change', this.services);
  }

  private getServiceClientId(service: MicroserviceInfo): number | undefined {
    return service.metadata['_nats.client.id'];
  }

  private saveService(service: MicroserviceInfo): void {
    const idx = this.services.findIndex((svc) => svc.id === service.id);

    debug.monitor.info(`Found ${idx >= 0 ? '' : 'new '}microservice ${service.name}.${service.id} on client ${this.getServiceClientId(service)}`);

    if (idx >= 0) {
      this.services[idx] = {
        ...this.services[idx],
        ...service,
        lastFoundAt: new Date(),
      };
    }
    else
      this.services.push({
        firstFoundAt: new Date(),
        lastFoundAt: new Date(),
        ...service,
      });

    this.emit('added', service);
    this.emit('change', this.services);
  }

  public async discover(
    timeout: number,
    options?: Partial<MonitorDiscoveryOptions>,
  ): Promise<void> {
    const l = this.services.length;
    if (!options?.doNotClear && l > 0) {
      debug.monitor.info(`Forgetting ${l} known microservices and starting from scratch`);
      this.services.splice(0, l);
    }

    const services = await this.broker.requestMany<string, MicroserviceInfo>(
      '$SRV.INFO',
      '',
      {
        limit: -1,
        timeout,
      },
    );

    for await (const service of services)
      this.saveService(service);
  }

  public startPeriodicDiscovery(
    interval: number,
    discoveryTimeout: number,
  ) {
    this.stopPeriodicDiscovery();
    this.discoveryInterval = setInterval(
      () => this.discover(discoveryTimeout),
      interval,
    );
  }

  public stopPeriodicDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }
  }
}
