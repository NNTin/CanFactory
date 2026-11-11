import { createHash } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import {
  AFFILIATE_ACCOUNTS, artifactFormat, DownloadQuerySchema, ErrorSchema, IdParamsSchema, MarketInfoSchema, OffersQuerySchema, OffersSchema,
  RenderRequestSchema, RenderSchema, enabledNetworks, findModel, findPart, marketOfCountry, matchOffers, offers, parseOfferParts, validateParameters,
  PART_SOURCES, PartLayoutSchema, PartResponseSchema, partFamilies, partLayoutData, partResponse, parts,
  type AffiliateAccounts, type AwinLive, type Offer, type Render,
} from '@canfactory/contracts';
import { AppError, type ArtifactFormat, type PostgresStorage, type RenderJob } from '@canfactory/server';

export interface AppOptions {
  /** The affiliate accounts links carry (default: packages/contracts/src/parts/affiliateAccounts.ts). */
  accounts?: AffiliateAccounts;
  /** The clock Awin prices are judged by (default: now). */
  now?: () => number;
  /** The curated offers (default: packages/contracts/src/parts/offers.ts). */
  catalogue?: readonly Offer[];
}

/** Sanitized public view of a job; internal paths, parameters, and leases stay private. */
function publicRender(job: RenderJob): Render {
  const model = findModel(job.modelId);
  const suffix = model && artifactFormat(model) === 'zip' ? 'zip' : 'stl';
  return {
    id: job.id, modelId: job.modelId, modelVersion: job.modelVersion, status: job.status,
    createdAt: job.createdAt, expiresAt: job.expiresAt, slotCount: job.slotCount,
    artifact: job.status === 'succeeded' && job.artifact ? { ...job.artifact, url: `/api/v1/renders/${job.id}/${suffix}` } : null,
    error: job.error,
  };
}

let partsDigest: string | undefined;
/**
 * The version of the bundled parts library: a digest of its families, parts, sources and layouts, computed once. Every parts
 * response carries it as its ETag, so a cache revalidates exactly when a deploy changes the contracts' parts data.
 */
export function partsVersion(): string {
  partsDigest ??= createHash('sha256').update(JSON.stringify({ partFamilies, parts, sources: PART_SOURCES, layouts: parts.map(partLayoutData) })).digest('hex').slice(0, 24);
  return partsDigest;
}

/** Sets the parts library's caching headers; true when the request's If-None-Match already has this version (answer 304). */
function cachedPart(request: FastifyRequest, reply: FastifyReply): boolean {
  const etag = `"parts-${partsVersion()}"`;
  reply.header('ETag', etag).header('Cache-Control', 'public, max-age=300');
  const match = request.headers['if-none-match'];
  return typeof match === 'string' && match.split(',').some(tag => ['*', etag].includes(tag.trim().replace(/^W\//, '')));
}

/** Build routes without side effects; omitting storage supports offline OpenAPI generation. */
export async function createApp(storage?: PostgresStorage, logging = false, options: AppOptions = {}) {
  const accounts = options.accounts ?? AFFILIATE_ACCOUNTS;
  const catalogue = options.catalogue ?? offers;
  const app = Fastify({
    // Room for a document parameter: a wire-guide design is at most WIRE_GUIDE_GEOMETRY.maxBytes (200 kB) as JSON.
    logger: logging, bodyLimit: 262_144,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false, useDefaults: false, multipleOfPrecision: 8 } },
  }).withTypeProvider<TypeBoxTypeProvider>();
  const store = () => {
    if (!storage) throw new AppError(503, 'NOT_READY', 'The catalogue is not ready.');
    return storage;
  };
  const stlResponse = { description: 'STL bytes; coordinates are in millimetres.', content: { 'model/stl': { schema: Type.Unknown({ type: 'string', format: 'binary' }) } } };
  const zipResponse = { description: 'ZIP archive containing this model’s STL parts.', content: { 'application/zip': { schema: Type.Unknown({ type: 'string', format: 'binary' }) } } };
  /** Shared by the STL and ZIP render-artifact routes: same expiry/readiness/ETag/disposition logic, different format. */
  async function serveArtifact(reply: FastifyReply, id: string, download: string | undefined, format: ArtifactFormat, contentType: string) {
    const job = await store().getJob(id);
    if (!job || job.expiresAt <= await store().now()) throw new AppError(410, 'RENDER_EXPIRED', 'This render has expired. Generate it again.');
    if (job.status !== 'succeeded' || !job.artifact) throw new AppError(409, 'RENDER_NOT_READY', 'Wait for a successful render before downloading.');
    const disposition = download === 'true' ? 'attachment' : 'inline';
    return reply.type(contentType).header('Content-Length', job.artifact.bytes)
      .header('Content-Disposition', `${disposition}; filename="${job.modelId}-${job.id.slice(0, 8)}.${format}"`)
      .header('Cache-Control', 'no-store').header('ETag', `"${job.artifact.sha256}"`)
      .send(await store().readArtifact(job));
  }
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'CanFactory API', version: '1.0.0', description: 'Local parametric STL generation. Dimensions are millimetres. Generated jobs and files expire one hour after creation; there are no saved user designs.' },
      servers: [{ url: '/' }],
      tags: [{ name: 'Models', description: 'Files of the provided models. The catalogue itself (models and parts) is bundled into the web app from @canfactory/contracts.' }, { name: 'Parts', description: 'The bundled parts library, read-only, for callers that cannot import @canfactory/contracts (KiPrint): a part, and the layout of a prototype or development board. Cacheable: the ETag is the parts library’s version.' }, { name: 'Renders', description: 'Temporary render jobs and their STL artifacts.' }, { name: 'Offers', description: 'Where to buy the parts: affiliate links of Amazon and Awin advertisers, by market.' }],
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

  app.get('/api/health', { schema: { hide: true } }, async () => ({ ready: true, workerReady: await store().workerReady() }));
  app.get('/api/openapi.json', { schema: { hide: true } }, () => app.swagger());

  app.get('/api/v1/models/:id/reference.stl', {
    schema: { operationId: 'getReferenceStl', tags: ['Models'], summary: 'Inspect the original supplied STL', params: IdParamsSchema,
      response: { 200: stlResponse, 404: ErrorSchema } },
  }, async (request, reply) => {
    const model = await store().getModel(request.params.id);
    if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    if (!model.referenceName) throw new AppError(404, 'REFERENCE_NOT_AVAILABLE', 'This model has no downloadable reference file.');
    return reply.type('model/stl').header('Content-Disposition', `inline; filename="${model.id}-reference.stl"`)
      .send(await store().readReference(model));
  });

  // The parts library, read-only (contracts): for KiPrint, which builds its projects on a board's grid server-side.
  const notModified = { description: 'Not modified: the If-None-Match ETag is the current parts library version.', type: 'null' } as const;
  /** A 304 has no body (the handlers return null for it). */
  const onSend = (_request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise.resolve(reply.statusCode === 304 ? '' : payload);
  app.get('/api/v1/parts/:id', {
    onSend,
    schema: { operationId: 'getPart', tags: ['Parts'], summary: 'A part of the library, with its family and its sources',
      description: 'Dimensions are millimetres with their basis and source. `layout` is the URL of the board layout for prototype and development boards, null otherwise.',
      params: IdParamsSchema, response: { 200: PartResponseSchema, 304: notModified, 404: ErrorSchema } },
  }, (request, reply) => {
    const part = findPart(request.params.id); const body = part && partResponse(part);
    if (!body) throw new AppError(404, 'PART_NOT_FOUND', `${request.params.id} is not in the library.`);
    if (cachedPart(request, reply)) { reply.code(304); return null; }
    return body;
  });

  app.get('/api/v1/parts/:id/layout', {
    onSend,
    schema: { operationId: 'getPartLayout', tags: ['Parts'], summary: 'The layout of a prototype or development board',
      description: 'Prototype boards (`kind: prototype-board`): the outline, the hole grid (pitch, columns × rows, the first hole’s offset), the printed labels, drill and pad diameters, every drilled hole with its label and net, the copper traces and the nets they connect, and the mounting holes. Development boards (`kind: dev-board`): pins, USB-C receptacle, components, antenna. `frame` describes the coordinate frame (mm).',
      params: IdParamsSchema, response: { 200: PartLayoutSchema, 304: notModified, 404: ErrorSchema } },
  }, (request, reply) => {
    const part = findPart(request.params.id);
    if (!part) throw new AppError(404, 'PART_NOT_FOUND', `${request.params.id} is not in the library.`);
    const layout = partLayoutData(part);
    if (!layout) throw new AppError(404, 'LAYOUT_NOT_AVAILABLE', `${part.id} is a ${part.family}; only prototype and development boards have a layout.`);
    if (cachedPart(request, reply)) { reply.code(304); return null; }
    return layout;
  });

  // Offers: curated listings of the parts (contracts), with the Awin feed rows the offers service stored (see docs/affiliate-offers.md).
  app.get('/api/v1/market', {
    schema: { operationId: 'getMarket', tags: ['Offers'], summary: 'The visitor’s market (by country) and the networks that link in each market',
      description: 'DE, AT and CH shop in the DE market (amazon.de); every other or unknown country in the US market (amazon.com). The country is Cloudflare’s CF-IPCountry header; it is not stored.',
      response: { 200: MarketInfoSchema } },
  }, (request, reply) => {
    const header = request.headers['cf-ipcountry'];
    const country = typeof header === 'string' && /^[A-Za-z]{2}$/.test(header) && !['XX', 'T1'].includes(header.toUpperCase()) ? header.toUpperCase() : null;
    reply.header('Cache-Control', 'private, no-store').header('Vary', 'CF-IPCountry');
    return { market: marketOfCountry(country), country, source: country ? 'geo' as const : 'default' as const,
      networks: { DE: enabledNetworks('DE', accounts), US: enabledNetworks('US', accounts) } };
  });

  app.get('/api/v1/offers', {
    schema: { operationId: 'getOffers', tags: ['Offers'], summary: 'Where to buy parts: ranked affiliate offers per part, and the buy list grouped by shop',
      description: 'Curated offers of the market’s networks with an account, best first, in packs that cover each quantity; a search of the market’s Amazon for a part with none. Amazon offers never carry a price; an Awin offer carries its feed’s price for 72 hours after Awin imported the feed.',
      querystring: OffersQuerySchema, response: { 200: OffersSchema, 404: ErrorSchema } },
  }, async (request, reply) => {
    const requirements = parseOfferParts(request.query.parts);
    const unknown = requirements.find(requirement => !findPart(requirement.partId));
    if (unknown) throw new AppError(404, 'PART_NOT_FOUND', `${unknown.partId} is not in the library.`);
    const { market } = request.query;
    const wanted = new Set(requirements.map(requirement => requirement.partId));
    const keys = accounts.awin.publisherId === null ? [] : catalogue.flatMap(offer => offer.network === 'awin' && offer.market === market && offer.covers.some(cover => wanted.has(cover.partId))
      ? [{ advertiserId: offer.advertiserId, merchantProductId: offer.merchantProductId, market }] : []);
    const live: AwinLive[] = keys.length > 0 ? await store().awinOffers(keys) : [];
    reply.header('Cache-Control', 'public, max-age=300');
    return matchOffers(requirements, market, { accounts, live, catalogue, now: options.now?.() ?? Date.now(), findPart });
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
  }, async (request, reply) => {
    const model = findModel(request.body.modelId);
    if (!model) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    // Each RenderRequestSchema branch's parameters shape is already validated above; the union collapses to
    // ParameterValues once discriminated by modelId, which enqueue() re-normalizes generically.
    const job = await store().enqueue(model, request.body.parameters);
    reply.code(job.status === 'succeeded' ? 200 : 202).header('Cache-Control', 'no-store');
    return publicRender(job);
  });

  app.get('/api/v1/renders/:id', {
    schema: { operationId: 'getRender', tags: ['Renders'], summary: 'Poll a render job', params: IdParamsSchema,
      description: '410 means this temporary render is expired or no longer available. Resubmit current settings to regenerate it.',
      response: { 200: RenderSchema, 410: ErrorSchema } },
  }, async (request, reply) => {
    const job = await store().getJob(request.params.id);
    if (!job || job.expiresAt <= await store().now()) throw new AppError(410, 'RENDER_EXPIRED', 'This render is no longer available. Generate it again.');
    reply.header('Cache-Control', 'no-store');
    return publicRender(job);
  });

  app.get('/api/v1/renders/:id/stl', {
    schema: {
      operationId: 'getRenderStl', tags: ['Renders'], summary: 'View or download the generated STL',
      description: 'Preview and download return identical bytes. Use download=true for attachment disposition. Attribution is recorded in the catalogue and STL header.',
      params: IdParamsSchema, querystring: DownloadQuerySchema,
      response: { 200: stlResponse, 409: ErrorSchema, 410: ErrorSchema },
    },
  }, (request, reply) => serveArtifact(reply, request.params.id, request.query.download, 'stl', 'model/stl'));

  app.get('/api/v1/renders/:id/zip', {
    schema: {
      operationId: 'getRenderZip', tags: ['Renders'], summary: 'View or download the generated ZIP of STL parts',
      description: 'Only used by multi-part assembly models. Preview and download return identical bytes. Use download=true for attachment disposition. Attribution is recorded in the catalogue and in each STL header.',
      params: IdParamsSchema, querystring: DownloadQuerySchema,
      response: { 200: zipResponse, 409: ErrorSchema, 410: ErrorSchema },
    },
  }, (request, reply) => serveArtifact(reply, request.params.id, request.query.download, 'zip', 'application/zip'));
  return app;
}
