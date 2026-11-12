import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The policy's directives by name. */
const directives = (policy: string) => new Map(policy.split(';').map(part => part.trim()).filter(Boolean).map(part => {
  const [name = '', ...values] = part.split(/\s+/);
  return [name, values.join(' ')];
}));

// The chart (production and preview) and the Compose image each set the policy; only the assistant's edge in connect-src differs.
const nginxConf = readFileSync('docker/nginx.conf', 'utf8');
const nginx = nginxConf.match(/ \$content_security_policy \{\s*default "([^"]+)";/)?.[1] ?? '';
const chartTemplate = readFileSync('charts/canfactory/templates/web-config.yaml', 'utf8');
const chart = chartTemplate.match(/\$csp := printf "([^"]+)"/)?.[1] ?? '';
const nginxWorker = nginxConf.match(/\$worker_content_security_policy \{\s*default "([^"]+)";/)?.[1] ?? '';
const chartWorker = chartTemplate.match(/\$workerCsp := "([^"]+)"/)?.[1] ?? '';

describe('the Content Security Policy (#152)', () => {
  it('is the same in the chart and in the Compose image, apart from the edge', () => {
    const [compose, released] = [directives(nginx), directives(chart)];
    expect(compose.get('connect-src')).toBe("'self' https://api.dev.tiny.nntin.xyz https://api.github.com");
    expect(released.get('connect-src')).toBe('%s');
    compose.delete('connect-src'); released.delete('connect-src');
    expect(Object.fromEntries(compose)).toEqual(Object.fromEntries(released));
  });

  it('runs only same-origin scripts, wasm, and same-origin workers', () => {
    const policy = directives(nginx);
    expect(policy.get('script-src')).toBe("'self' 'wasm-unsafe-eval'");
    expect(policy.get('worker-src')).toBe("'self'");
    expect(policy.get('object-src')).toBe("'none'");
    expect(policy.get('default-src')).toBe("'self'");
  });

  it('allows eval only in the physics worker (MuJoCo’s Emscripten bindings), the same in both', () => {
    expect(nginxWorker).not.toBe('');
    expect(chartWorker).toBe(nginxWorker);
    expect(directives(nginxWorker).get('script-src')).toBe("'self' 'unsafe-eval' 'wasm-unsafe-eval'");
    expect(nginx).not.toContain("'unsafe-eval'");
    expect(chart).not.toContain("'unsafe-eval'");
  });
});
