import { expect, it, vi } from 'vitest';
import { RENDERER_IMAGE, repositoryRoot } from './config.ts';
import { dockerRunner, nativeRunner, openScadArgs, TOOL_LIMITS } from './openscad.ts';

const calls: { file: string; args: string[]; options: Record<string, unknown> }[] = [];
const failure: { current: (Error & { code?: number; killed?: boolean }) | null } = { current: null };
vi.mock('node:child_process', async original => ({
  ...await original<typeof import('node:child_process')>(),
  execFile: (file: string, args: string[], options: Record<string, unknown>, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    calls.push({ file, args, options });
    callback(failure.current, '', `ERROR in ${repositoryRoot}/models/x.scad`);
  },
}));

const signal = new AbortController().signal;
const fonts = `${repositoryRoot}/models/fonts`;
const args = openScadArgs('/scratch/job/part.stl', [['SIZE', '20'], ['TEXT', '"Hi"']], `${repositoryRoot}/models/x.scad`);

it('builds one OpenSCAD command line and rejects unsafe variable names', () => {
  expect(args).toEqual(['--backend', 'Manifold', '--export-format', 'binstl', '-o', '/scratch/job/part.stl', '-D', 'SIZE=20', '-D', 'TEXT="Hi"', `${repositoryRoot}/models/x.scad`]);
  expect(() => openScadArgs('out.stl', [['A;B', '1']], 'in.scad')).toThrow(/Invalid OpenSCAD variable name/);
});

it('runs the pinned image as the worker would, with the repository at /app and the data directory at /data', async () => {
  calls.length = 0;
  await dockerRunner('/scratch')(args, signal, fonts);
  expect(calls[0]?.file).toBe('docker');
  expect(calls[0]?.args).toEqual(['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '2g',
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '--env', 'OPENSCAD_FONT_PATH=/app/models/fonts', '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', 'type=bind,src=/scratch,dst=/data',
    RENDERER_IMAGE, 'timeout', '120', 'openscad', '--backend', 'Manifold', '--export-format', 'binstl', '-o', '/data/job/part.stl', '-D', 'SIZE=20', '-D', 'TEXT="Hi"', '/app/models/x.scad']);
  calls.length = 0;
  await dockerRunner('/scratch', TOOL_LIMITS)(args, signal, fonts);
  expect(calls[0]?.args).toContain('4g');
  expect(calls[0]?.args.slice(calls[0].args.indexOf(RENDERER_IMAGE) + 1, calls[0].args.indexOf('openscad'))).toEqual(['timeout', '600']);
});

it('classifies a timeout and a failed render, without paths', async () => {
  failure.current = Object.assign(new Error('exit'), { code: 124 });
  await expect(dockerRunner('/scratch')(args, signal, fonts)).rejects.toMatchObject({ code: 'RENDER_TIMEOUT', retryable: true });
  failure.current = Object.assign(new Error('killed'), { killed: true });
  await expect(nativeRunner()(args, signal, fonts)).rejects.toMatchObject({ code: 'RENDER_TIMEOUT', message: expect.stringContaining('120-second') as string });
  failure.current = Object.assign(new Error('exit'), { code: 1 });
  const rejection = nativeRunner('openscad', TOOL_LIMITS)(args, signal, fonts);
  await expect(rejection).rejects.toMatchObject({ code: 'OPENSCAD_FAILED', retryable: false });
  await expect(rejection).rejects.not.toMatchObject({ detail: expect.stringContaining(repositoryRoot) as string });
  failure.current = null;
});
