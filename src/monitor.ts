import EventEmitter from 'events';

import { Broker } from './broker.js';
import { debug } from './debug.js';
import {
  Message, MicroserviceInfo, MicroserviceRegistration, MicroserviceRegistrationSubject,
  Request, Response,
} from './types/index.js';
import { wrapMethod, wrapThread } from './utils.js';

export type MonitorDiscoveryOptions = {
  doNotClear: boolean;
};

type ServerPingOptions = {
  // no options yet
};

type ServerPingResponse = {
  server: {
    name: string,
    host: string;
    id: string,
    ver: string,
    // jetstream: boolean,
    // flags: number,
    // seq: number,
    // time: string,
  };
};

type ServerConnzOptions = {
  // no options yet
  auth: boolean;
};

type ServerConnzItem = {
  cid: number;
  ip: string;
  start: string;
  account: string;
  authorized_user: string;
};

type ServerConnz = {
  data: {
    connections: ServerConnzItem[];
  };
};

type UserConnectEvent = {
  id?: string;
  server: {
    name: string;
    host: string;
    id: string;
    ver: string;
  };
  client: {
    start: string;
    host: string;
    id: number;
    acc?: string;
    user?: string;
  };
};

type UserDisconnectEvent = UserConnectEvent;

export type DiscoveredMicroservice = MicroserviceInfo & {
  firstFoundAt: Date;
  lastFoundAt: Date;
  connection: UserConnectEvent | undefined;
};

export type MonitorOptions = {
  discoveryTimeout: number,
};

export class Monitor {

  private readonly options: MonitorOptions;

  public readonly services: DiscoveredMicroservice[] = [];
  private discoveryInterval: NodeJS.Timer | undefined;
  private readonly connections: Record<string, UserConnectEvent> = {};
  private readonly ee = new EventEmitter();

  constructor(
    private readonly broker: Broker,
    private readonly systemBroker?: Broker,
    options: Partial<MonitorOptions> = {},
  ) {
    this.options = {
      discoveryTimeout: 5000,
      ...options,
    };

    const handleServiceRegistration = wrapMethod(
      this.broker,
      wrapThread('monitor', this.handleServiceRegistration.bind(this)),
      {
        method: 'handleServiceStatus',
      },
    );
    broker.on(MicroserviceRegistrationSubject, handleServiceRegistration);

    if (systemBroker) {
      systemBroker.on('$SYS.ACCOUNT.*.CONNECT', this.handleAccountConnect.bind(this));
      systemBroker.on('$SYS.ACCOUNT.*.DISCONNECT', this.handleAccountDisconnect.bind(this));
    }
    else {
      debug.monitor.error('Connection established/dropped monitoring disabled: no system broker');
    }

    this.discoverConnections();
    this.discover(this.options.discoveryTimeout);
  }

  private async discoverConnections(): Promise<void> {
    if (!this.systemBroker) {
      debug.monitor.error('Failed to discover current connections: no system broker');
      return;
    }

    for await (const { data: server } of this.systemBroker.requestMany<
      ServerPingOptions,
      ServerPingResponse
    >(
      '$SYS.REQ.SERVER.PING',
      {},
      {
        timeout: 3000,
      },
    )) {
      debug.monitor.info(`Found server ${server.server.id}`);
      const { data: connz } = await this.systemBroker.request<ServerConnzOptions, ServerConnz>(
        `$SYS.REQ.SERVER.${server.server.id}.CONNZ`,
        { auth: true },
      );

      if (!connz) {
        debug.monitor.error(`Server ${server.server.id} did not response CONNZ request`);
        return;
      }

      debug.monitor.info(`Server ${server.server.id} connections: ${connz.data.connections.map((c) => c.cid)}`);

      for (const connection of connz.data.connections) {
        this.connections[connection.cid] = {
          client: {
            id: connection.cid,
            host: connection.ip,
            start: connection.start,
            acc: connection.account,
            user: connection.authorized_user,
          },
          server: {
            name: server.server.name,
            id: server.server.id,
            host: server.server.host,
            ver: server.server.ver,
          },
        };
      }

      for (const service of this.services) {
        const clientId = this.getServiceClientId(service);
        if (clientId) {
          const conn = this.connections[clientId];
          if (conn) {
            service.connection = conn;
            debug.monitor.info(`Updated microservice ${service.name}.${service.id} to client ${clientId}'s connection`);
            this.emit('added', service);
          }
        }
      }
    }
  }

  private handleServiceRegistration(
    req: Request<MicroserviceRegistration>,
    res: Response<void>,
  ): void {
    if (req.data.state === 'down')
      this.removeService(req.data.info);
    else
      this.saveService(req.data.info);

    res.end();
  }

  private async handleAccountConnect(msg: Message<UserConnectEvent>): Promise<void> {
    const connection = msg.data;
    this.connections[connection.client.id] = msg.data;
  }

  private async handleAccountDisconnect(msg: Message<UserDisconnectEvent>): Promise<void> {
    const connection = msg.data;

    const clientId = connection.client.id;

    let count = 0;
    let idx = 0;
    while (idx < this.services.length) {
      const service = this.services[idx];

      if (this.getServiceConnectionInfo(service)?.client.id === clientId) {
        const removed = this.services.splice(idx, 1);
        this.emit('removed', removed[0]);
        count++;
      }
      else
        idx++;
    }

    debug.monitor.info(`Client ${clientId} disconnected, removing ${count} microservices`);

    delete (this.connections[connection.client.id]);

    this.emit('change', this.services);
  }

  private emit(event: 'added' | 'removed', service: MicroserviceInfo): void;
  private emit(event: 'change', services: MicroserviceInfo[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emit(event: string, ...args: any[]): void {
    this.ee.emit(event, ...args);
  }

  public on(event: 'added' | 'removed', listener: (service: MicroserviceInfo) => void): void;
  public on(event: 'change', listener: (services: MicroserviceInfo[]) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string, listener: (...args: any[]) => void): void {
    this.ee.on(event, listener);
  }

  private getServiceClientId(service: MicroserviceInfo): number | undefined {
    const clientId = Number(service.metadata['_nats.client.id']);
    return Number.isNaN(clientId) ? undefined : clientId;
  }

  private getServiceConnectionInfo(service: MicroserviceInfo): UserConnectEvent | undefined {
    const clientId = this.getServiceClientId(service);

    return clientId ? this.connections[clientId] : undefined;
  }

  private saveService(service: MicroserviceInfo): void {
    const idx = this.services.findIndex((svc) => svc.id === service.id);
    const clientId = this.getServiceClientId(service);
    const connection = this.getServiceConnectionInfo(service);

    debug.monitor.info(`${idx >= 0 ? 'Updated' : 'New'} microservice ${service.name}.${service.id} on client ${clientId}${connection ? '' : ' (unknown connection)'}`);

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
        connection: connection,
        ...service,
      });

    this.emit('added', service);
    this.emit('change', this.services);
  }

  private removeService(service: MicroserviceInfo): void {
    const idx = this.services.findIndex((svc) => svc.id === service.id);

    if (idx >= 0) {

      debug.monitor.info(`Removing microservice ${service.name}.${service.id}`);

      this.services.splice(idx, 1);

      this.emit('removed', service);
      this.emit('change', this.services);
    }
  }

  public async discover(
    timeout?: number,
    options?: Partial<MonitorDiscoveryOptions>,
  ): Promise<void> {

    const servicesIterator = this.broker.requestMany<string, MicroserviceInfo>(
      '$SRV.INFO',
      '',
      {
        limit: -1,
        timeout: timeout ?? this.options.discoveryTimeout,
      },
    );

    const services: MicroserviceInfo[] = [];
    for await (const service of servicesIterator) {
      services.push(service.data);
      this.saveService(service.data);
    }

    if (!options?.doNotClear) {

      const servicesToForget = this.services
        .filter((oldSvc) => !services.some((newSvc) => newSvc.id === oldSvc.id));

      if (servicesToForget.length > 0) {
        debug.monitor.info(`Removing microservices ${servicesToForget.map((svc) => `${svc.name}.${svc.id}`)} that have not responded during discovery`);
        for (const serviceToForger of servicesToForget)
          this.removeService(serviceToForger);
      }
    }
  }

  public startPeriodicDiscovery(
    interval: number,
    discoveryTimeout?: number,
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
