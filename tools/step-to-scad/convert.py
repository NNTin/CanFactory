#!/usr/bin/env python3
"""Inspect STEP solids or convert one to self-contained, fixed-geometry OpenSCAD."""
import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import struct
import sys


def positive(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError('must be finite and positive')
    return number


def describe(solid, index):
    b = solid.BoundingBox()
    return dict(index=index, valid=solid.isValid(), volume=solid.Volume(),
                min=[b.xmin, b.ymin, b.zmin], max=[b.xmax, b.ymax, b.zmax],
                size=[b.xlen, b.ylen, b.zlen],
                faces=dict(Counter(f.geomType() for f in solid.Faces())))


def convert(solid, args):
    # OCCT duplicates vertices across BRep faces. Weld after rounding, without decimation.
    rotated = solid
    for axis, angle in zip([(1, 0, 0), (0, 1, 0), (0, 0, 1)], args.rotate):
        rotated = rotated.rotate((0, 0, 0), axis, angle)
    b = rotated.BoundingBox()
    shift = [-(b.xmin + b.xmax) / 2, -(b.ymin + b.ymax) / 2, -b.zmin]
    vertices, triangles = rotated.tessellate(args.tolerance, args.angular_tolerance)
    points, ids, vertex_ids = [], {}, []
    for vertex in vertices:
        point = tuple(round(v + s, 6) + 0.0 for v, s in zip(vertex.toTuple(), shift))
        if point not in ids:
            ids[point] = len(points)
            points.append(point)
        vertex_ids.append(ids[point])
    faces = [tuple(vertex_ids[i] for i in face) for face in triangles]
    edges, signed_volume = Counter(), 0.0
    for a, b, c in faces:
        p, q, r = points[a], points[b], points[c]
        cross = ((q[1]-p[1])*(r[2]-p[2])-(q[2]-p[2])*(r[1]-p[1]),
                 (q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]),
                 (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))
        if sum(v*v for v in cross) < 1e-20:
            raise ValueError('Tessellation has a degenerate triangle; adjust tolerance.')
        signed_volume += sum(p[i]*cross[i] for i in range(3))/6
        edges.update([(a, b), (b, c), (c, a)])
    if any(count != 1 or edges[(b, a)] != 1 for (a, b), count in edges.items()):
        raise ValueError('Tessellation is not a closed, consistently wound manifold.')
    if signed_volume <= 0:
        raise ValueError('Tessellation has nonpositive volume.')
    error = abs(signed_volume / solid.Volume() - 1)
    if error > args.volume_error:
        raise ValueError(f'Tessellation volume error {error:.6%} exceeds limit.')
    header = ['Technical STEP format conversion; fixed geometry, millimetres.',
              f'Source: {args.source.name}; solid {args.solid}',
              f'SHA-256: {sha256(args.source.read_bytes()).hexdigest()}',
              f'Creator: {args.creator}', f'Original: {args.source_url}',
              f'License: {args.license}; {args.license_url}',
              'See ATTRIBUTION.md. No design changes; rigid print placement only.']
    if any('\n' in line or '\r' in line for line in header):
        raise ValueError('Attribution fields must be single-line text.')
    # OpenSCAD faces are clockwise when seen from outside, opposite to OCCT/STL.
    scad = '\n'.join('// ' + line for line in header) + '\npolyhedron(\n  points = ' + json.dumps(points, separators=(',', ':')) + ',\n  faces = ' + json.dumps([(a, c, b) for a, b, c in faces], separators=(',', ':')) + ',\n  convexity = 10\n);\n'
    if len(scad.encode()) > args.max_bytes:
        raise ValueError('SCAD exceeds --max-bytes; inspect tessellation settings first.')
    # All checks precede writes. The binary STL is this exact mesh, for independent rendering checks.
    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(scad)
    stl_path = output.with_suffix('.stl')
    if args.stl:
        with stl_path.open('wb') as f:
            f.write(f'{args.creator} | {args.license} | STEP conversion'.encode('ascii', 'replace')[:80].ljust(80, b'\0'))
            f.write(struct.pack('<I', len(faces)))
            for face in faces:
                f.write(struct.pack('<12fH', 0, 0, 0, *(v for i in face for v in points[i]), 0))
    report = dict(source=describe(solid, args.solid), sourceSha256=sha256(args.source.read_bytes()).hexdigest(),
                  cadqueryVersion=__import__('cadquery').__version__, tolerance=args.tolerance,
                  angularTolerance=args.angular_tolerance, printRotation=args.rotate, printTranslation=shift,
                  points=len(points), triangles=len(faces), meshVolume=signed_volume,
                  volumeRelativeError=error, scadBytes=len(scad.encode()),
                  inversePlacement='source = inverse(rotation) * (print - printTranslation)')
    output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['inspect', 'convert'])
    parser.add_argument('source', type=Path)
    parser.add_argument('--solid', type=int, default=0, help='zero-based index from inspect')
    parser.add_argument('-o', '--output', type=Path)
    parser.add_argument('--rotate', type=float, nargs=3, default=[0, 0, 0], metavar=('X', 'Y', 'Z'), help='rigid print rotation in degrees, applied X then Y then Z')
    parser.add_argument('--tolerance', type=positive, default=0.01, help='OCCT linear tessellation deflection (mm)')
    parser.add_argument('--angular-tolerance', type=positive, default=0.1, help='OCCT angular deflection (radians)')
    parser.add_argument('--volume-error', type=positive, default=0.002, help='maximum relative mesh/CAD volume error')
    parser.add_argument('--max-bytes', type=int, default=500_000)
    parser.add_argument('--stl', action='store_true', help='also write the tessellated reference STL')
    for field in ['creator', 'source-url', 'license', 'license-url']:
        parser.add_argument('--' + field)
    args = parser.parse_args()
    if args.command == 'convert':
        if not all([args.output, args.creator, args.source_url, args.license, args.license_url]):
            parser.error('convert requires -o, --creator, --source-url, --license and --license-url')
        if args.output.suffix != '.scad' or args.source.resolve() == args.output.resolve():
            parser.error('output must be a separate .scad file')
        if not all(math.isfinite(v) for v in args.rotate) or args.max_bytes <= 0:
            parser.error('rotation must be finite and --max-bytes positive')
    try:
        import cadquery as cq
    except ImportError:
        parser.exit(2, 'Install tools: uv venv .data/step-tools --python 3.12 && uv pip install --python .data/step-tools/bin/python -r tools/step-to-scad/requirements.txt\n')
    solids = cq.importers.importStep(str(args.source)).solids().vals()
    if not solids:
        parser.error('STEP contains no solids')
    if args.command == 'inspect':
        print(json.dumps([describe(s, i) for i, s in enumerate(solids)], indent=2))
        return
    if not 0 <= args.solid < len(solids):
        parser.error(f'--solid must be between 0 and {len(solids)-1}')
    solid = solids[args.solid]
    if not solid.isValid() or solid.Volume() <= 0:
        parser.error('selected solid is invalid or has nonpositive volume')
    print(json.dumps(convert(solid, args), indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        sys.exit(str(error))
