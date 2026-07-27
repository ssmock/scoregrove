/** Registers `node-resolver.mjs` before the CLI loads; see that file for why. */
import { register } from 'node:module';

register('./node-resolver.mjs', import.meta.url);
