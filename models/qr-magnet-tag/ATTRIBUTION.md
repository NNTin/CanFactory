# Magnetic QR code tag

This model is an **original CanFactory design**. It is not derived from any third-party
model: `generator.scad` was written directly in OpenSCAD for this application, so there
is no `reference/` folder with an original STL or source to preserve.

The model source and the geometry generated from it are licensed under
**Creative Commons Attribution 4.0 International** (CC BY 4.0).

License: <https://creativecommons.org/licenses/by/4.0/>

## Third-party code and marks

- The QR code is encoded by [uqr](https://github.com/unjs/uqr) (MIT), a port of Project
  Nayuki's QR Code generator library (MIT). It runs in the contract (packages/contracts),
  not in the SCAD file, which only receives the resulting module rectangles.
- The block structure of the error correction (codewords per block, number of blocks)
  follows ISO/IEC 18004, table 9; only those figures are used, the standard itself is not
  reproduced.
- "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
- A logo you load is your own; the tag only carries its outline.

These model terms do not establish a license for unrelated application code.
