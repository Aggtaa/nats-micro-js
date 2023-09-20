type BucketEvent<R> =
  {
    value: R;
  }
  | {
    done: true;
  }

export function eventBucket<R>() {
  const queue: BucketEvent<R>[] = [];

  // eslint-disable-next-line no-use-before-define
  const iterate = bucket();

  let next: ((item: BucketEvent<R>) => void) | undefined;

  async function* bucket() {
    while (true) {
      yield new Promise<BucketEvent<R>>((res) => {
        if (queue.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          res(queue.shift()!);
        }
        else
          next = res;
      });
    }
  }

  return {
    ...iterate,
    close() {
      this.pushEvent({ done: true });
    },
    push(value: R) {
      this.pushEvent({ value });
    },
    pushEvent(item: BucketEvent<R>) {
      if (next) {
        next(item);
        next = undefined;
        return;
      }

      queue.push(item);
    },
  };
}
