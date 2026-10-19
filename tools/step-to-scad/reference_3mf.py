#!/usr/bin/env python3
"""Extract an independent reference STL from a single, untransformed millimetre 3MF.

Deliberately refuses assemblies, transforms and other units instead of silently
losing placement. --flip-x applies a rigid 180-degree print orientation.
"""
import argparse
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
from zipfile import ZipFile


def extract(source, output, flip_x=False):
    with ZipFile(source) as archive:
        root = ET.fromstring(archive.read('3D/3dmodel.model'))
    ns = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
    objects = root.findall('m:resources/m:object', ns)
    items = root.findall('m:build/m:item', ns)
    if (root.get('unit', 'millimeter') != 'millimeter' or len(objects) != 1 or len(items) != 1
            or items[0].get('objectid') != objects[0].get('id') or items[0].get('transform')
            or objects[0].find('m:components', ns) is not None):
        raise ValueError('Expected one directly built, untransformed millimetre mesh.')
    mesh = objects[0].find('m:mesh', ns)
    if mesh is None:
        raise ValueError('No direct mesh found.')
    points = [tuple(float(v.attrib[k]) for k in ('x', 'y', 'z')) for v in mesh.findall('m:vertices/m:vertex', ns)]
    faces = [tuple(int(t.attrib[k]) for k in ('v1', 'v2', 'v3')) for t in mesh.findall('m:triangles/m:triangle', ns)]
    if not points or not faces or any(i < 0 or i >= len(points) for f in faces for i in f):
        raise ValueError('Empty mesh or invalid indices.')
    if flip_x:
        points = [(x, -y, -z) for x, y, z in points]
    # Rigid placement preserves winding. Reference is never part of the runtime model.
    data = bytearray(b'3MF reference extraction; retain source attribution'.ljust(80, b'\0'))
    data.extend(struct.pack('<I', len(faces)))
    for face in faces:
        data.extend(struct.pack('<12fH', 0, 0, 0, *(v for i in face for v in points[i]), 0))
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_bytes(data)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--flip-x', action='store_true')
    args = parser.parse_args()
    extract(args.source, args.output, args.flip_x)
