-- The web app reads models from the bundled @canfactory/contracts (#95): no endpoint serves the seeded model detail any more,
-- and new seeds leave it NULL. model_revisions keeps what renders and reference files need: the source fingerprint and the
-- reference object. Backward compatible: a previous release still selects the column during a rolling upgrade.
-- A later migration may drop it once no release before #95 runs.
ALTER TABLE model_revisions ALTER COLUMN detail DROP NOT NULL;
