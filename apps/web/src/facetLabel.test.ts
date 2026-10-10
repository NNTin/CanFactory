import { describe, expect, it } from 'vitest';
import { facetLabel } from './facetLabel.ts';

describe('facetLabel', () => {
  it('reads a slug as words but keeps the hyphens of names', () => {
    expect(['socket-cap', 'hex-nyloc', 'countersunk-pot'].map(facetLabel)).toEqual(['socket cap', 'hex nyloc', 'countersunk pot']);
    expect(['ESP32-C3', 'USB-C', 'ISO 7046-1', 'D-ring', 'Simpson Strong-Tie', 'on-metal sticker'].map(facetLabel))
      .toEqual(['ESP32-C3', 'USB-C', 'ISO 7046-1', 'D-ring', 'Simpson Strong-Tie', 'on-metal sticker']);
  });
});
