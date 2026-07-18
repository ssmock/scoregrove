import express from 'express';
import type { Counter } from '@scoregrove/domain/Counter';
import { createCounter, increment, decrement } from '@scoregrove/domain/Counter';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

let counter: Counter = createCounter();

app.get('/api/counter', (_req, res) => {
  res.json(counter);
});

app.post('/api/counter/increment', (_req, res) => {
  counter = increment(counter);
  res.json(counter);
});

app.post('/api/counter/decrement', (_req, res) => {
  counter = decrement(counter);
  res.json(counter);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
