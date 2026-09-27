import { describe, expect, it } from 'vitest';
import { formatHash, parseHash, partLink, type Route } from './route.ts';

describe('hash routes', () => {
  it('round-trips every page through the hash', () => {
    const routes: Route[] = [
      { view: 'models', model: null }, { view: 'models', model: 'plank-connector' },
      { view: 'parts', family: null, part: null, filters: {} }, { view: 'parts', family: 'screw', part: null, filters: { thread: 'M3', q: 'din 912' } },
      { view: 'parts', family: 'magnet', part: 'supermagnete-s-06-02-n', filters: {} },
    ];
    for (const route of routes) expect(parseHash(formatHash(route))).toEqual(route);
    expect(formatHash({ view: 'parts', family: 'screw', part: null, filters: { thread: 'M2.5', head: '' } })).toBe('#/parts/screw?thread=M2.5');
  });

  it('opens the default page for an empty or unknown hash', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#/somewhere')).toBeNull();
  });

  it('links a part-linked option to its part, or to every part with that attribute value', () => {
    expect(partLink({ family: 'screw', attribute: 'thread' }, 'M3')).toBe('#/parts/screw?thread=M3');
    expect(partLink({ family: 'magnet', attribute: null }, 'supermagnete-s-06-02-n')).toBe('#/parts/magnet/supermagnete-s-06-02-n');
  });
});
