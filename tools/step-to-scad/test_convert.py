"""Run with .data/step-tools/bin/python -m unittest discover -s tools/step-to-scad."""
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

import cadquery as cq

SCRIPT = Path(__file__).with_name('convert.py')


class ConversionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'two.step'
        # Two physically separate solids: conversion must select, not fuse them.
        shape = cq.Compound.makeCompound([
            cq.Workplane().box(10, 8, 6).val().translate((14, 23, 9)),
            cq.Workplane().box(2, 3, 4).val().translate((40, 0, 0)),
        ])
        cq.exporters.export(shape, str(self.source))

    def run_tool(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)

    def convert(self, *extra):
        return self.run_tool('convert', self.source, '-o', self.root / 'part.scad',
                             '--creator', 'Fixture', '--source-url', 'https://example.com/model',
                             '--license', 'CC0', '--license-url', 'https://creativecommons.org/publicdomain/zero/1.0/',
                             '--stl', *extra)

    def test_inspect_separates_solids(self):
        result = self.run_tool('inspect', self.source)
        self.assertEqual(result.returncode, 0, result.stderr)
        solids = json.loads(result.stdout)
        for solid, volume in zip(solids, [480, 24]):
            self.assertAlmostEqual(solid['volume'], volume)
        self.assertTrue(all(s['valid'] for s in solids))

    def test_selection_grounding_and_inverse_rigid_transform(self):
        result = self.convert('--solid', '1', '--rotate', '180', '0', '0')
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertAlmostEqual(report['meshVolume'], 24)
        self.assertEqual(report['printTranslation'], [-40, 0, 2])
        data = (self.root / 'part.stl').read_bytes()
        count, = struct.unpack_from('<I', data, 80)
        coords = [struct.unpack_from('<9f', data, 84 + 50 * i + 12) for i in range(count)]
        points = [tuple(face[i:i+3]) for face in coords for i in (0, 3, 6)]
        self.assertEqual([min(p[i] for p in points) for i in range(3)], [-1, -1.5, 0])
        self.assertEqual([max(p[i] for p in points) for i in range(3)], [1, 1.5, 4])
        # Recovered source point: inverse Rx(180) after undoing print translation.
        recovered = [(p[0]+40, -p[1], 2-p[2]) for p in points]
        self.assertEqual([min(p[i] for p in recovered) for i in range(3)], [39, -1.5, -2])
        self.assertIn('Fixture', (self.root / 'part.scad').read_text())

    def test_rejects_missing_solid_without_writing(self):
        self.assertNotEqual(self.convert('--solid', '9').returncode, 0)
        self.assertFalse((self.root / 'part.scad').exists())

    def test_rejects_invalid_tolerance_and_rotation(self):
        for args in [('--tolerance', 'nan'), ('--tolerance', '-1'), ('--rotate', 'inf', '0', '0')]:
            self.assertNotEqual(self.convert(*args).returncode, 0)
        self.assertFalse((self.root / 'part.scad').exists())

    def test_refuses_oversized_output_without_writing(self):
        result = self.convert('--max-bytes', '50')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('max-bytes', result.stderr)
        self.assertFalse((self.root / 'part.scad').exists())

    def test_requires_provenance(self):
        result = self.run_tool('convert', self.source, '-o', self.root / 'part.scad')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'part.scad').exists())


if __name__ == '__main__':
    unittest.main()
