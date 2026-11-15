import { describe, expect, it } from 'vitest';
import { assistantPolicy, POLICY_VERSION } from './policy.ts';

const instructions = (toolIds: string[]) => assistantPolicy.instructions?.({ boundary: 'synthesis', toolIds }) ?? '';
const canfactoryTools = ['canfactory_search_parts', 'canfactory_get_part', 'canfactory_set_model_parameters', 'canfactory_query_prototype_board', 'canfactory_validate_wire_guide_design',
  'canfactory_open_wire_guide_design'];

describe('the assistant policy', () => {
  it('is versioned for the KiPrint workflow', () => {
    expect(POLICY_VERSION).toBeGreaterThanOrEqual(6);
  });

  it('keeps conditional KiPrint guidance when next.4 supplies only app ids to policy', () => {
    const text = instructions(canfactoryTools);
    expect(text).toContain('When KiPrint functions are in the available tool list');
    expect(text).toContain('mcp_kiprint_create_project');
    expect(text).toContain('Never claim to have called an unavailable function');
  });

  it.each(['planning', 'decision', 'synthesis'] as const)('requires first-turn board research at the %s boundary', boundary => {
    const text = assistantPolicy.instructions?.({ boundary, toolIds: canfactoryTools }) ?? '';
    expect(text).toContain('start this turn by calling canfactory_search_parts');
    expect(text).toContain('Include these calls in the execution plan');
    expect(text).toContain('assume 5 V, about 1 Hz, one LED');
    expect(text).toContain('look up that board and proceed in the first turn');
    expect(text).toContain('Never claim you cannot verify copper connectivity without trying this tool');
  });

  it('omits app-tool commands when the reader disabled those tools', () => {
    const text = instructions([]);
    expect(text).not.toContain('start this turn by calling canfactory_search_parts');
    expect(text).not.toContain('Use canfactory_query_prototype_board');
  });

  it('walks KiPrint’s workflow in order: create, place, wire, check, fix, plan, validate, open in the editor, export', () => {
    const text = instructions(canfactoryTools);
    const steps = ['mcp_kiprint_create_project', 'mcp_kiprint_add_components', 'mcp_kiprint_add_wires', 'mcp_kiprint_check_project',
      'mcp_kiprint_remove_items', 'mcp_kiprint_plan_guide', 'always check it with canfactory_validate_wire_guide_design', 'open it with canfactory_open_wire_guide_design', 'mcp_kiprint_export_project'];
    const positions = steps.map(step => text.lastIndexOf(step));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).toMatch(/never patch KiPrint’s design by hand/);
    expect(text).toMatch(/Never make up, shorten or alter a download link/);
  });
});
