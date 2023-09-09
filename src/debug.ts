import debugThreadsNs from 'debug-threads-ns';

type Debug = debugThreadsNs.ExtendedDebug & {
  broker: debugThreadsNs.ExtendedDebug;
  monitor: debugThreadsNs.ExtendedDebug;
  ms: debugThreadsNs.ExtendedDebug & {
    thread: debugThreadsNs.ExtendedDebug;
  }
}

export const debug: Debug = debugThreadsNs.default('nats-micro');
