import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, esp32C3SuperminiCase as model, RenderRequestSchema, scadDefines, validateParameters } from './index.ts';

describe('ESP32-C3 SuperMini original case', () => {
  it('renders a two-part ZIP with fixed geometry and rejects resizing', () => {
    expect(artifactFormat(model)).toBe('zip');
    expect(model.parts.map(part => part.id)).toEqual(['bottom', 'top']);
    expect(model.controls).toEqual([]);
    expect(validateParameters(model, {})).toEqual([]);
    expect(validateParameters(model, { scale: 2 })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: {} })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: { scale: 2 } })).toBe(false);
    for (const part of model.parts) expect(scadDefines(model, part, {})).toEqual([]);
  });

  it('reassembles the roof-down lid in its source position and slides from the USB end', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(model.assembly.poses.bottom.position).toEqual([0, 0, 0]);
    expect(model.assembly.poses.top).toEqual({ position: [0.2, 0, 7.56], rotation: [180, 0, 0] });
    expect(model.assembly.steps[0]).toMatchObject({ parts: ['top'], from: [30, 0, 0] });
  });

  it('retains original attribution and license for the catalogue and downloads', () => {
    expect(model.attribution).toBe('Vinors3DLab (MakerWorld)');
    expect(model.attributionLinks[0]?.url).toContain('makerworld.com/de/models/3419196');
    expect(model.license).toBe('CC BY-NC-ND 4.0');
    expect(model.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc-nd/4.0/');
  });
});
