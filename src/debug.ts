import createDebugger, { ExtendedDebug } from 'debug-threads-ns';

type Debug = ExtendedDebug & {
  broker: ExtendedDebug;
  ms: ExtendedDebug & {
    thread: ExtendedDebug;
  }
}

export const debug: Debug = createDebugger('nats-micro');
