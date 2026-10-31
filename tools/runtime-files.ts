// Copies what the api and worker images run from into a directory (the Dockerfile's app layer):
// the server-side source and the model files the registry renders, seeds and fingerprints.
// Docs, tests and unregistered meshes/CAD originals stay out; node_modules is a separate, rarely changing layer.
import { cpSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { models, modelSourcePaths } from '@canfactory/contracts';
import { repositoryRoot } from '@canfactory/server';

const destination = process.argv[2];
if (!destination) throw new Error('Usage: runtime-files.ts <destination>');

const registered = new Set(models.flatMap(model => [...modelSourcePaths(model), ...model.assetPaths ?? [], ...model.referencePath ? [model.referencePath] : []]));
const heavy = /\.(stl|3mf|step|stp|fcstd|png|jpe?g)$/i;
const include = ['package.json', 'tsconfig.json', 'apps/api', 'apps/worker', 'packages', 'tools', 'parts', 'models'];

for (const entry of include) {
  cpSync(resolve(repositoryRoot, entry), resolve(destination, entry), {
    recursive: true,
    filter: source => {
      const path = relative(repositoryRoot, source).split('\\').join('/');
      if (path.split('/').some(segment => segment === 'node_modules' || segment === 'dist')) return false;
      return !(path.startsWith('models/') && heavy.test(path)) || registered.has(path);
    },
  });
}
for (const path of registered) cpSync(resolve(repositoryRoot, path), resolve(destination, path));
