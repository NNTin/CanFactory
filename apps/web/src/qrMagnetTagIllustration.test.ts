import { describe, expect, it } from 'vitest';
import { tagFrame } from './QrMagnetTagIllustration.tsx';

describe('QR magnet tag card', () => {
  it('rests on the finished tag', () => {
    expect(tagFrame(null)).toEqual({ centre: 1, code: 1, stage: 'Tag' });
  });

  it('shows the border, brings the centre in, lets the code appear, then lifts the centre out', () => {
    expect(tagFrame(0)).toEqual({ centre: 0, code: 0, stage: 'Border' });
    const coming = tagFrame(0.26);
    expect(coming.stage).toBe('Centre in');
    expect(coming.centre).toBeGreaterThan(0); expect(coming.centre).toBeLessThan(1); expect(coming.code).toBe(0);
    const code = tagFrame(0.57);
    expect(code).toMatchObject({ centre: 1, stage: 'Code' });
    expect(code.code).toBeGreaterThan(0); expect(code.code).toBeLessThan(1);
    expect(tagFrame(0.8)).toEqual({ ...tagFrame(null) });
    expect(tagFrame(0.999)).toEqual({ centre: 0, code: 0, stage: 'Lift out' });
  });
});
