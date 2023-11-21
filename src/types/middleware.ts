import { Handler } from './broker.js';

export type Middleware<T, R> = Handler<T, R>;
