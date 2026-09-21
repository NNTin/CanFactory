# Adding a model

1. Create `models/<model-id>/` containing original reference assets, attribution,
   and a self-contained editable SCAD generator. Preserve the original source
   and STL unchanged. The generator must produce one connected closed solid,
   with units interpreted as millimetres.
2. Define a TypeBox parameter object with `additionalProperties: false`. Document
   each property’s title, meaning, units, default, and numeric bounds/steps. The
   current generic editor supports numeric fields and boolean switches.
3. Add a `ModelDefinition` with stable ID, explicit version, display metadata,
   reference/source paths, control grouping, defaults, SCAD variable mapping,
   dependent validation, and derived metadata. Variable names must use uppercase
   letters/underscores. Validate all finite ranges and bound geometry complexity.
4. Register the definition in `models` and its typed request branch in
   `RenderRequestSchema`. Keep request schemas in an explicit TypeBox tuple so
   static inference retains the discriminated union. The React editor, API
   routes, and worker need no model-specific changes.
5. Add contract and real-render cases, including extremes and invalid
   combinations. Verify closed edges, winding, connectedness, positive volume,
   expected dimensions, and a preview matching the downloaded STL.
6. Run `npm run contracts:generate`, `npm run check`, `npm run test:renderer`, and
   browser tests. Rebuild Compose to include the model in the catalogue.

Bump the model version when parameter meanings or defaults change. Browser
preferences are isolated by version and stale API requests receive a conflict.
Source/schema/mapping changes also alter the cache fingerprint. The current
fingerprint assumes a self-contained generator: if adding includes, libraries,
or imported geometry, extend fingerprinting to cover every dependency first.

Do not accept arbitrary uploaded SCAD or construct shell commands from parameter
values. Provided models are trusted repository code; users supply only values
validated against the registered schema.
