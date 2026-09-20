import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import {
  DownloadQuerySchema, ErrorSchema, IdParamsSchema, ModelDetailSchema, ModelSummarySchema,
  RenderRequestSchema, RenderSchema, findModel, validateParameters,
} from '@canfactory/contracts';
import { AppError, publicRender, type Store } from '@canfactory/server';

/** Build routes without side effects; omitting storage supports offline OpenAPI generation. */
export async function createApp(storage?: Store, logging = false) {
  const app = Fastify({
    logger: logging, bodyLimit: 32_768,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false, useDefaults: false, multipleOfPrecision: 8 } },
  }).withTypeProvider<TypeBoxTypeProvider>();
  const store = () => {
    if (!storage) throw new AppError(503, 'NOT_READY', 'The catalogue is not ready.');
    return storage;
  };
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'CanFactory API', version: '1.0.0', description: 'Local parametric STL generation. Dimensions are millimetres. Generated jobs and files expire one hour after creation; there are no saved user designs.' },
      servers: [{ url: '/' }],
      tags: [{ name: 'Models', description: 'Provided, versioned model catalogue.' }, { name: 'Renders', description: 'Temporary render jobs and their STL artifacts.' }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode === 429) reply.header('Retry-After', '5');
      return reply.code(error.statusCode).send(error.toJSON());
    }
    if (error instanceof Error && 'validation' in error) {
      return reply.code(422).send({ code: 'INVALID_PARAMETERS', message: 'Check the submitted settings against the model schema.', issues: [] });
    }
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ code: 'INVALID_REQUEST', message: error.message, issues: [] });
    }
    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'The request could not be completed. Please try again.', issues: [] });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND', message: 'This endpoint does not exist.', issues: [] }));

  app.get('/api/health', { schema: { hide: true } }, () => ({ ready: true, workerReady: store().workerReady() }));
  app.get('/api/openapi.json', { schema: { hide: true } }, () => app.swagger());

  app.get('/api/v1/models', {
    schema: { operationId: 'listModels', tags: ['Models'], summary: 'List provided models', response: { 200: Type.Array(ModelSummarySchema) } },
  }, () => store().listModels());

  app.get('/api/v1/models/:id', {
    schema: { operationId: 'getModel', tags: ['Models'], summary: 'Get a model and its editor schema', params: IdParamsSchema, response: { 200: ModelDetailSchema, 404: ErrorSchema } },
  }, request => {
    const model = store().getModel(request.params.id);
    if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    return model.detail;
  });

  app.get('/api/v1/models/:id/reference.stl', {
    schema: { operationId: 'getReferenceStl', tags: ['Models'], summary: 'Inspect the original supplied STL', params: IdParamsSchema,
      response: { 200: Type.Unknown({ type: 'string', format: 'binary', description: 'Original STL bytes.' }), 404: ErrorSchema } },
  }, (request, reply) => {
    const model = store().getModel(request.params.id);
    if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    return reply.type('model/stl').header('Content-Disposition', `inline; filename="${model.id}-reference.stl"`)
      .send(createReadStream(join(store().artifacts.catalogDir, model.referenceName)));
  });

  app.post('/api/v1/renders', {
    preValidation(request) {
      const body: unknown = request.body;
      if (body !== null && typeof body === 'object' && 'modelId' in body && typeof body.modelId === 'string') {
        const model = findModel(body.modelId);
        if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
        if ('modelVersion' in body && typeof body.modelVersion === 'string' && body.modelVersion !== model.version)
          throw new AppError(409, 'MODEL_VERSION_CONFLICT', 'This model has changed. Reload the catalogue to use its current settings.');
        if ('parameters' in body) {
          const issues = validateParameters(model, body.parameters);
          if (issues.length) throw new AppError(422, 'INVALID_PARAMETERS', 'Some settings need adjustment.', issues);
        }
      }
      return Promise.resolve();
    },
    schema: {
      operationId: 'createRender', tags: ['Renders'], summary: 'Reuse a cached STL or enqueue generation',
      description: 'Returns 200 for a completed cached render or 202 for queued/running work. All fields are required. Poll the returned ID; retry explicitly after failure. No user designs are saved.',
      body: RenderRequestSchema,
      response: { 200: RenderSchema, 202: RenderSchema, 404: ErrorSchema, 409: ErrorSchema, 422: ErrorSchema, 429: ErrorSchema },
    },
  }, (request, reply) => {
    const model = findModel(request.body.modelId);
    if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    const job = store().enqueue(model, request.body.parameters);
    reply.code(job.status === 'succeeded' ? 200 : 202).header('Cache-Control', 'no-store');
    return publicRender(job);
  });

  app.get('/api/v1/renders/:id', {
    schema: { operationId: 'getRender', tags: ['Renders'], summary: 'Poll a render job', params: IdParamsSchema,
      description: '410 means this temporary render is expired or no longer available. Resubmit current settings to regenerate it.',
      response: { 200: RenderSchema, 410: ErrorSchema } },
  }, (request, reply) => {
    const job = store().getJob(request.params.id);
    if (!job || job.expiresAt <= store().now()) throw new AppError(410, 'RENDER_EXPIRED', 'This render is no longer available. Generate it again.');
    reply.header('Cache-Control', 'no-store');
    return publicRender(job);
  });

  app.get('/api/v1/renders/:id/stl', {
    schema: {
      operationId: 'getRenderStl', tags: ['Renders'], summary: 'View or download the generated STL',
      description: 'Preview and download return identical bytes. Use download=true for attachment disposition. Attribution is recorded in the catalogue and STL header.',
      params: IdParamsSchema, querystring: DownloadQuerySchema,
      response: { 200: Type.Unknown({ type: 'string', format: 'binary', description: 'Validated binary STL, measured in mm.' }), 409: ErrorSchema, 410: ErrorSchema },
    },
  }, (request, reply) => {
    const job = store().getJob(request.params.id);
    if (!job || job.expiresAt <= store().now()) throw new AppError(410, 'RENDER_EXPIRED', 'This render has expired. Generate it again.');
    if (job.status !== 'succeeded' || !job.artifact) throw new AppError(409, 'RENDER_NOT_READY', 'Wait for a successful render before downloading.');
    const path = store().artifacts.path(job.id);
    if (!existsSync(path)) throw new AppError(410, 'RENDER_EXPIRED', 'The generated file is no longer available. Generate it again.');
    const disposition = request.query.download === 'true' ? 'attachment' : 'inline';
    return reply.type('model/stl').header('Content-Length', job.artifact.bytes)
      .header('Content-Disposition', `${disposition}; filename="${job.modelId}-${job.id.slice(0, 8)}.stl"`)
      .header('Cache-Control', 'no-store').header('ETag', `"${job.artifact.sha256}"`)
      .send(createReadStream(path));
  });
  return app;
}
