import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, esp32C3SuperminiCase as model, RenderRequestSchema, scadDefines, validateParameters, modelBom, partUsage, ESP32_CASE_LEDS, ESP32_CASE_BOARD, ESP32_CASE_HEADER, ESP32_CASE, ESP32_CASE_HEADER_OPENINGS, ESP32_CASE_HEADER_DEFINES, devBoardLayout, findPart, dimensionOf, resolveAssembly } from './index.ts';

describe('ESP32-C3 SuperMini LED case', () => {
  it('defaults to LED and insulator openings, supports all four combinations, and rejects unknown settings', () => {
    expect(artifactFormat(model)).toBe('zip');
    expect(model.parts.map(part => part.id)).toEqual(['bottom', 'top']);
    expect(model.defaults).toEqual({ ledHoles: true, flushHeaders: true });
    expect(model.controls[0]).toMatchObject({ key: 'ledHoles', kind: 'boolean', default: true });
    expect(model.controls[1]).toMatchObject({ key: 'flushHeaders', kind: 'boolean', default: true });
    const bottom = model.parts[0], top = model.parts[1];
    if (!bottom || !top) throw new Error('Missing case parts');
    for (const ledHoles of [true, false]) for (const flushHeaders of [true, false]) {
      const parameters = { ledHoles, flushHeaders };
      expect(validateParameters(model, parameters)).toEqual([]);
      expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '3', parameters })).toBe(true);
      expect(scadDefines(model, top, parameters)).toContainEqual(['LED_HOLES', String(ledHoles)]);
      expect(scadDefines(model, bottom, parameters)).toContainEqual(['FLUSH_HEADERS', String(flushHeaders)]);
    }
    expect(validateParameters(model, { ...model.defaults, ledHoles: 'true' })).not.toEqual([]);
    expect(validateParameters(model, { ...model.defaults, flushHeaders: 'true' })).not.toEqual([]);
    expect(validateParameters(model, { ...model.defaults, scale: 2 })).not.toEqual([]);
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

  it('aligns grounded headers with the board and openings in both seating modes', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(modelBom(model, model.defaults)).toEqual([{ partId: ESP32_CASE_BOARD, quantity: 1 }, { partId: ESP32_CASE_HEADER, quantity: 2 }]);
    expect(model.assembly.steps.map(step => step.parts)).toEqual([['header-1', 'header-2'], ['top']]);
    const header = findPart(ESP32_CASE_HEADER); if (!header) throw new Error('Missing header');
    expect(partUsage(header)).toEqual([{ modelId: model.id, modelTitle: model.title, via: 'Assembly preview', kind: 'model' }]);
    const board = findPart(ESP32_CASE_BOARD); if (!board) throw new Error('Missing board');
    expect(ESP32_CASE_HEADER_DEFINES.HEADER_LENGTH).toBeCloseTo(dimensionOf(header, 'L', 'max') + 0.4, 8);
    expect(ESP32_CASE_HEADER_DEFINES.HEADER_WIDTH).toBeCloseTo(dimensionOf(header, 'W', 'max') + 0.4, 8);
    for (const flushHeaders of [true, false]) {
      const assembly = resolveAssembly(model, model.assembly, { ...model.defaults, flushHeaders });
      if (!assembly) throw new Error('Missing assembly');
      expect(Value.Check(AssemblySchema, assembly)).toBe(true);
      const boardZ = assembly.poses['board']?.position[2] ?? NaN;
      const floorZ = assembly.poses['bottom']?.position[2] ?? NaN;
      for (const [index, opening] of ESP32_CASE_HEADER_OPENINGS.entries()) {
        const pose = assembly.poses[`header-${index + 1}`]; if (!pose) throw new Error('Missing pose');
        const z = pose.position[2] ?? NaN;
        expect(z - dimensionOf(header, 'H')).toBeCloseTo(0, 8);
        expect(pose.position[0]).toBeCloseTo(opening.x, 8);
        expect(pose.position[1]).toBeCloseTo(opening.y, 8);
        const bodyTop = z - dimensionOf(header, 'tail');
        if (flushHeaders) {
          expect(bodyTop).toBeCloseTo(boardZ, 8);
          expect(floorZ - (bodyTop - dimensionOf(header, 'h'))).toBeCloseTo(0.84, 8);
        } else {
          expect(floorZ - bodyTop).toBeCloseTo(0.1, 8);
        }
        expect(z - boardZ).toBeGreaterThan(dimensionOf(board, 't'));
        expect(floorZ - boardZ).toBeCloseTo(ESP32_CASE.floorBottom, 8);
      }
    }
  });

  it('credits the author’s remix-permitting release and names the LED modification', () => {
    expect(model.attribution).toContain('Vinors3DLab');
    expect(model.attribution).toContain('LED and pin-header openings by CanFactory');
    expect(model.license).toBe('CC BY-NC-SA 4.0');
    expect(model.attributionLinks.map(link => link.url).some(url => url.includes('makeronline.com'))).toBe(true);
  });
});
