import { Handler } from './broker.js';

export type PreMiddleware<T, R> = Handler<T, R, boolean>;
export type PostMiddleware<T, R> = Handler<T, R, void>;

export type PreMiddlewares<T, R> = {
  pre: PreMiddleware<T, R>[];
};

export type PostMiddlewares<T, R> = {
  post: PostMiddleware<T, R>[];
};

export type Middlewares<T, R> =
  (PreMiddlewares<T, R> & PostMiddlewares<T, R>) | PreMiddlewares<T, R> | PostMiddlewares<T, R>;
