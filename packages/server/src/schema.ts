import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ApiError, ModelDetail, ParameterValues, RenderStatus } from '@canfactory/contracts';
import type { MeshInfo } from './mesh.ts';

export const catalog = sqliteTable('models', {
  id: text('id').primaryKey(), version: text('version').notNull(),
  detail: text('detail', { mode: 'json' }).$type<ModelDetail>().notNull(),
  sourceHash: text('source_hash').notNull(), referenceName: text('reference_name').notNull(),
});

export const jobs = sqliteTable('render_jobs', {
  id: text('id').primaryKey(), cacheKey: text('cache_key').notNull().unique(),
  modelId: text('model_id').notNull(), modelVersion: text('model_version').notNull(),
  sourceHash: text('source_hash').notNull(), rendererFingerprint: text('renderer_fingerprint').notNull(),
  parameters: text('parameters', { mode: 'json' }).$type<ParameterValues>().notNull(),
  status: text('status').$type<RenderStatus>().notNull(),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  leaseToken: text('lease_token'), leaseUntil: integer('lease_until'),
  slotCount: integer('slot_count'),
  artifact: text('artifact', { mode: 'json' }).$type<MeshInfo>(),
  error: text('error', { mode: 'json' }).$type<ApiError>(),
});

export const workers = sqliteTable('workers', { id: text('id').primaryKey(), heartbeatAt: integer('heartbeat_at').notNull() });
export type RenderJob = typeof jobs.$inferSelect;
