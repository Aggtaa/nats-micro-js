import EventEmitter from 'events';

import { Broker } from './broker.js';
import { MicroserviceInfo, RegisterMicroserviceRequest, RequestOptions } from './types/index.js';
import { wrapMethod } from './utils.js';
import { debug } from './debug.js';

export type MonitorDiscoveryOptions = {
  doNotClear: boolean;
}

export type DiscoveredMicroservice = MicroserviceInfo & {
  firstFoundAt: Date;
  lastFoundAt: Date;
}

export class Monitor extends EventEmitter {

  public readonly services: DiscoveredMicroservice[] = [];
  private discoveryInterval: NodeJS.Timer | undefined;

  constructor(private readonly broker: Broker) {
    super();

    const handleServiceStatus = wrapMethod(this.broker, 'monitor', 'handleSchema', this.handleServiceStatus.bind(this));
    broker.on('$EVT.REGISTER', handleServiceStatus);

    this.discover(30000); // clear cache and do discovery in background
  }

  private handleServiceStatus(data: RegisterMicroserviceRequest): void {
    this.saveService(data.info);
  }

  private saveService(service: MicroserviceInfo): void {
    const idx = this.services.findIndex((svc) => svc.id === service.id);

    debug.monitor.info(`Found ${idx >= 0 ? '' : 'new '}microservice ${service.name}.${service.id}`);

    if (idx >= 0) {
      this.services[idx] = {
        ...this.services[idx],
        lastFoundAt: new Date(),
        ...service,
      };
    }
    else
      this.services.push({
        firstFoundAt: new Date(),
        lastFoundAt: new Date(),
        ...service,
      });

    this.emit('info', service);
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

    try {
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
    catch (err) {
      if (typeof (err) === 'object' && err && 'code' in err && err.code === 503)
        return; // NATS 'no responders available' error

      throw err;
    }
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
