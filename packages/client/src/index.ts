import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';

/** Same-origin, generated HTTP contract. No handwritten request/response assertions. */
export const api = createClient<paths>();
export type { paths } from './schema.d.ts';
