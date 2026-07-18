export type Counter = {
  value: number;
};

export function createCounter(initial = 0): Counter {
  return { value: initial };
}

export function increment(counter: Counter, by = 1): Counter {
  return { value: counter.value + by };
}

export function decrement(counter: Counter, by = 1): Counter {
  return { value: counter.value - by };
}
