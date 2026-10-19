import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, esp32C3SuperminiCase as model, RenderRequestSchema, scadDefines, validateParameters, modelBom, ESP32_CASE_LEDS, ESP32_CASE_BOARD, ESP32_CASE_HEADER, ESP32_CASE, ESP32_CASE_GROUND, devBoardLayout, findPart, dimensionOf } from './index.ts';

describe('ESP32-C3 SuperMini LED case', () => {
  it('enables LED openings by default, supports disabling them, and rejects unknown settings', () => {
    expect(artifactFormat(model)).toBe('zip');
    expect(model.parts.map(part => part.id)).toEqual(['bottom', 'top']);
    expect(model.defaults).toEqual({ ledHoles: true });
    expect(model.controls[0]).toMatchObject({ key: 'ledHoles', kind: 'boolean', default: true });
    const bottom = model.parts[0], top = model.parts[1];
    if (!bottom || !top) throw new Error('Missing case parts');
    for (const ledHoles of [true, false]) {
      expect(validateParameters(model, { ledHoles })).toEqual([]);
      expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '2', parameters: { ledHoles } })).toBe(true);
      expect(scadDefines(model, top, { ledHoles })).toContainEqual(['LED_HOLES', String(ledHoles)]);
      expect(scadDefines(model, bottom, { ledHoles })).toEqual([]);
    }
    expect(validateParameters(model, { ledHoles: 'true' })).not.toEqual([]);
    expect(validateParameters(model, { ledHoles: true, scale: 2 })).not.toEqual([]);
  });

  it('keeps both LED axes aligned with the installed library board in the flipped lid frame', () => {
    const board = findPart(ESP32_CASE_BOARD);
    if (!board) throw new Error('Missing board');
    const leds = devBoardLayout(board)?.components.filter(component => component.kind === 'led');
    expect(leds).toHaveLength(2);
    ESP32_CASE_LEDS.forEach((hole, index) => {
      const led = leds?.[index]; if (!led) throw new Error('Missing LED');
      expect(hole.print[0] + ESP32_CASE.lidCentre[0]).toBeCloseTo(ESP32_CASE.pcbX - led.y, 8);
      expect(ESP32_CASE.lidCentre[1] - hole.print[1]).toBeCloseTo(led.x, 8);
    });
  });

  it('shows one existing board and two sourced headers, grounded, with spacers outside the floor', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(modelBom(model, model.defaults)).toEqual([{ partId: ESP32_CASE_BOARD, quantity: 1 }, { partId: ESP32_CASE_HEADER, quantity: 2 }]);
    expect(model.assembly.steps.map(step => step.parts)).toEqual([['header-1', 'header-2'], ['top']]);
    const header = findPart(ESP32_CASE_HEADER); if (!header) throw new Error('Missing header');
    const pose = model.assembly.poses['header-1']; if (!pose) throw new Error('Missing pose');
    const tips = (pose.position[2] ?? 0) - dimensionOf(header, 'H');
    const bodyTop = (pose.position[2] ?? 0) - dimensionOf(header, 'tail');
    expect(tips).toBeCloseTo(0, 8);
    expect(bodyTop).toBeLessThan(ESP32_CASE.floorBottom + ESP32_CASE_GROUND);
    // Short tails enter the actual pin holes, rather than a cosmetically resized board.
    const board = findPart(ESP32_CASE_BOARD); if (!board) throw new Error('Missing board');
    expect((pose.position[2] ?? 0) - ESP32_CASE_GROUND).toBeGreaterThan(dimensionOf(board, 't'));
  });

  it('credits the author’s remix-permitting release and names the LED modification', () => {
    expect(model.attribution).toContain('Vinors3DLab');
    expect(model.attribution).toContain('LED openings by CanFactory');
    expect(model.license).toBe('CC BY-NC-SA 4.0');
    expect(model.attributionLinks.map(link => link.url).some(url => url.includes('makeronline.com'))).toBe(true);
  });
});
