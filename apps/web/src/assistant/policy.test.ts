import { describe, expect, it } from 'vitest';
import { assistantPolicy, KIPRINT_CREATE, POLICY_VERSION } from './policy.ts';

const instructions = (toolIds: string[]) => assistantPolicy.instructions?.({ boundary: 'synthesis', toolIds }) ?? '';
const canfactoryTools = ['canfactory_get_part', 'canfactory_set_model_parameters', 'canfactory_query_prototype_board', 'canfactory_validate_wire_guide_design',
  'canfactory_open_wire_guide_design'];

describe('the assistant policy', () => {
  it('is versioned for the KiPrint workflow', () => {
    expect(POLICY_VERSION).toBeGreaterThanOrEqual(5);
  });

  it('describes KiPrint only when its tools registered', () => {
    expect(instructions(canfactoryTools)).not.toContain('mcp:kiprint:');
    expect(instructions([...canfactoryTools, KIPRINT_CREATE])).toContain('mcp:kiprint:create_project');
  });

  it('walks KiPrint’s workflow in order: create, place, wire, check, fix, plan, validate, open in the editor, export', () => {
    const text = instructions([...canfactoryTools, KIPRINT_CREATE]);
    const steps = ['mcp:kiprint:create_project', 'mcp:kiprint:add_components', 'mcp:kiprint:add_wires', 'mcp:kiprint:check_project',
      'mcp:kiprint:remove_items', 'mcp:kiprint:plan_guide', 'canfactory_validate_wire_guide_design and, once it is valid', 'open it with canfactory_open_wire_guide_design', 'mcp:kiprint:export_project'];
    const positions = steps.map(step => text.lastIndexOf(step));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).toMatch(/never patch KiPrint’s design by hand/);
    expect(text).toMatch(/Never make up, shorten or alter a download link/);
  });
});
