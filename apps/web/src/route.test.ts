import { describe, expect, it } from 'vitest';
import { formatHash, parseHash, partLink, type Route } from './route.ts';

describe('hash routes', () => {
  it('round-trips every page through the hash', () => {
    const routes: Route[] = [
      { view: 'concepts', concept: 'catio', subassembly: null }, { view: 'concepts', concept: 'catio', subassembly: 'window-insert' },
      { view: 'models', model: null }, { view: 'models', model: 'plank-connector' },
      { view: 'parts', family: null, part: null, filters: {} }, { view: 'parts', family: 'screw', part: null, filters: { thread: 'M3', q: 'din 912' } },
      { view: 'parts', family: 'magnet', part: 'supermagnete-s-06-02-n', filters: {} },
      { view: 'buy-list' }, { view: 'disclosure' }, { view: 'privacy' },
    ];
    for (const route of routes) expect(parseHash(formatHash(route))).toEqual(route);
    expect(formatHash({ view: 'parts', family: 'screw', part: null, filters: { thread: 'M2.5', head: '' } })).toBe('#/parts/screw?thread=M2.5');
  });

  it('opens the default page for an empty or unknown hash', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#/somewhere')).toBeNull();
    expect(parseHash('#/concepts/catio/unknown')).toBeNull();
    expect(parseHash('#/buy-list/extra')).toBeNull();
    expect(formatHash({ view: 'buy-list' })).toBe('#/buy-list');
    expect(formatHash({ view: 'concepts', concept: 'catio', subassembly: 'window-insert' })).toBe('#/concepts/catio/window-insert');
  });

  it('links a part-linked option to its part, or to every part with that attribute value', () => {
    expect(partLink({ family: 'screw', attribute: 'thread' }, 'M3')).toBe('#/parts/screw?thread=M3');
    expect(partLink({ family: 'magnet', attribute: null }, 'supermagnete-s-06-02-n')).toBe('#/parts/magnet/supermagnete-s-06-02-n');
  });
});
