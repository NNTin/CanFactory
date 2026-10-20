import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
from zipfile import ZipFile

SPEC = importlib.util.spec_from_file_location('reference_3mf', Path(__file__).with_name('reference_3mf.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReferenceExtractionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def source(self, unit='millimeter', transform=''):
        source = self.root / 'source.3mf'
        with ZipFile(source, 'w') as archive:
            archive.writestr('3D/3dmodel.model', f'''<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="{unit}">
            <resources><object id="1"><mesh><vertices><vertex x="1" y="2" z="3"/><vertex x="4" y="5" z="6"/><vertex x="7" y="8" z="9"/></vertices>
            <triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1" {transform}/></build></model>''')
        return source

    def test_rigid_flip_preserves_triangle_order(self):
        output = self.root / 'ref.stl'
        MODULE.extract(self.source(), output, True)
        data = output.read_bytes()
        self.assertEqual(struct.unpack_from('<I', data, 80), (1,))
        self.assertEqual(struct.unpack_from('<9f', data, 96), (1, -2, -3, 4, -5, -6, 7, -8, -9))

    def test_refuses_units_and_transforms_it_cannot_preserve(self):
        for options in [{'unit': 'inch'}, {'transform': 'transform="1 0 0 0 1 0 0 0 1 10 0 0"'}]:
            source = self.source(**options)
            with self.assertRaises(ValueError):
                MODULE.extract(source, self.root / 'ref.stl')
        self.assertFalse((self.root / 'ref.stl').exists())

    def test_preserves_the_original(self):
        source = self.source()
        before = source.read_bytes()
        with self.assertRaises(ValueError):
            MODULE.extract(source, source)
        self.assertEqual(source.read_bytes(), before)
