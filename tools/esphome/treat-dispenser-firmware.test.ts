import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The treat dispenser's firmware logic (models/treat-dispenser/esphome/treat_dispenser.h, which the ESPHome configuration includes)
 * built for the host and run against a simulated motor and flash: queue, interlocks, power cuts during a cycle, calibration.
 */
describe('treat dispenser firmware logic', () => {
  it('passes its host test', () => {
    const dir = mkdtempSync(join(tmpdir(), 'treat-firmware-'));
    try {
      const binary = join(dir, 'test');
      execFileSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-o', binary, 'models/treat-dispenser/esphome/treat_dispenser_test.cpp']);
      const output = execFileSync(binary, { encoding: 'utf8' });
      expect(output).toMatch(/^\d+ checks, 0 failures$/m);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);
});
