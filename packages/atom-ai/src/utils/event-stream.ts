// EventStream is the small primitive used across the runtime for streamed work
// that yields incremental events and also resolves one final result value.
export class EventStream<TEvent, TResult> implements AsyncIterable<TEvent> {
  private readonly queue: TEvent[] = [];
  private readonly waiters: Array<(result: IteratorResult<TEvent>) => void> = [];
  private finished = false;
  private resultPromise: Promise<TResult>;
  private resolveResult!: (value: TResult) => void;
  private rejectResult!: (reason?: unknown) => void;

  constructor() {
    this.resultPromise = new Promise<TResult>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
  }

  push(event: TEvent): void {
    if (this.finished) {
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: event, done: false });
      return;
    }

    this.queue.push(event);
  }

  end(result: TResult): void {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.resolveResult(result);

    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ value: undefined as TEvent, done: true });
    }
  }

  fail(error: unknown): void {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.rejectResult(error);

    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ value: undefined as TEvent, done: true });
    }
  }

  async result(): Promise<TResult> {
    return await this.resultPromise;
  }

  [Symbol.asyncIterator](): AsyncIterator<TEvent> {
    return {
      next: async () => {
        if (this.queue.length > 0) {
          const value = this.queue.shift() as TEvent;
          return { value, done: false };
        }

        if (this.finished) {
          return { value: undefined as TEvent, done: true };
        }

        return await new Promise<IteratorResult<TEvent>>((resolve) => {
          this.waiters.push(resolve);
        });
      }
    };
  }
}
