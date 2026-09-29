// Generated from docs/openapi.json. Run npm run contracts:generate.
export interface paths {
    "/api/v1/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List provided models */
        get: operations["listModels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/models/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a model and its editor schema */
        get: operations["getModel"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/models/{id}/reference.stl": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect the original supplied STL */
        get: operations["getReferenceStl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/part-families": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the parts library’s families */
        get: operations["listPartFamilies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/part-families/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a family with all its parts and their sources */
        get: operations["getPartFamily"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/parts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one part, its family and its sources */
        get: operations["getPart"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/renders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reuse a cached STL or enqueue generation
         * @description Returns 200 for a completed cached render or 202 for queued/running work. All fields are required. Poll the returned ID; retry explicitly after failure. No user designs are saved.
         */
        post: operations["createRender"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/renders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Poll a render job
         * @description 410 means this temporary render is expired or no longer available. Resubmit current settings to regenerate it.
         */
        get: operations["getRender"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/renders/{id}/stl": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * View or download the generated STL
         * @description Preview and download return identical bytes. Use download=true for attachment disposition. Attribution is recorded in the catalogue and STL header.
         */
        get: operations["getRenderStl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/renders/{id}/zip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * View or download the generated ZIP of STL parts
         * @description Only used by multi-part assembly models. Preview and download return identical bytes. Use download=true for attachment disposition. Attribution is recorded in the catalogue and in each STL header.
         */
        get: operations["getRenderZip"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listModels: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        version: string;
                        title: string;
                        description: string;
                        attribution: string;
                        license: string;
                        licenseUrl: string;
                        /** @description Model-specific orientation or printing guidance. */
                        printNotes: string;
                        /** @description The shape of the generated file: one STL, or a ZIP of one STL per part. */
                        artifactFormat: "stl" | "zip";
                        /** @description Whether this model exposes adjustable parameters yet. */
                        customizable: boolean;
                    }[];
                };
            };
        };
    };
    getModel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        version: string;
                        title: string;
                        description: string;
                        attribution: string;
                        license: string;
                        licenseUrl: string;
                        /** @description Model-specific orientation or printing guidance. */
                        printNotes: string;
                        /** @description The shape of the generated file: one STL, or a ZIP of one STL per part. */
                        artifactFormat: "stl" | "zip";
                        /** @description Whether this model exposes adjustable parameters yet. */
                        customizable: boolean;
                        controls: {
                            key: string;
                            label: string;
                            description: string;
                            /** @description An `svg` control takes an SVG file, which the editor turns into a logo string (packages/contracts/src/svgLogo.ts); its value is that string, empty for none. */
                            kind: "number" | "boolean" | "enum" | "text" | "svg";
                            group: "basic" | "advanced";
                            unit: "mm" | null;
                            default: number | boolean | string;
                            minimum: number | null;
                            /** @description Upper bound of a number; for a text control, the most characters allowed. */
                            maximum: number | null;
                            step: number | null;
                            enabledWhen: string | null;
                            /** @description Show this control only while another (enum) control has one of these values, or, given several such conditions, while all of them hold; its value still applies (it only matters in those modes). Null to always show it. */
                            visibleWhen: {
                                /** @description The key of an enum control of the same model. */
                                control: string;
                                values: string[];
                            } | {
                                /** @description The key of an enum control of the same model. */
                                control: string;
                                values: string[];
                            }[] | null;
                            /** @description The allowed values of an enum control, in display order; null for other kinds. */
                            options: {
                                value: string;
                                label: string;
                                description: string;
                            }[] | null;
                            /** @description Named sub-ranges of a number control, in order, from minimum (included) to maximum (excluded, except for the last): the editor names the one the value is in. Null for none. */
                            bands: {
                                minimum: number;
                                maximum: number;
                                label: string;
                            }[] | null;
                            /** @description For a number control, the sub-range recommended for each value of other (enum) controls, one entry per control: the editor highlights the range that suits all their current values on the slider, and names the controls a value is outside of. Advice only; values outside it stay valid. Null for none. */
                            recommended: {
                                /** @description The key of an enum control of the same model. */
                                control: string;
                                ranges: {
                                    value: string;
                                    minimum: number;
                                    maximum: number;
                                }[];
                            }[] | null;
                            /** @description For an enum control whose options are real-world parts: the parts-library family they link to. The editor links the selected option to the library. Null for none. */
                            part: {
                                /** @description The id of a parts-library family. */
                                family: string;
                                /** @description Null: each option value is the id of a part of the family. Otherwise each option value is a value of this attribute of the family (e.g. `thread` = `M3`), which stands for every part that has it. */
                                attribute: string | null;
                                /** @description For part-id options: offer only the parts whose attribute equals the current value of another (enum) control, e.g. the screws of the chosen thread. The editor lists only those, and moves the choice to the first of them when the other control changes; while the control is shown, any other part is invalid. Null to offer every option. */
                                filter: {
                                    /** @description The key of an enum control of the same model. */
                                    control: string;
                                    /** @description An attribute of the family, e.g. `thread`. */
                                    attribute: string;
                                } | null;
                            } | null;
                        }[];
                        defaults: {
                            [key: string]: number | boolean | string;
                        };
                        /** @description JSON Schema for this model’s parameter object. */
                        parameterSchema: {
                            [key: string]: unknown;
                        };
                        /** @description Absent when this model has no small, permanent original file. */
                        referenceUrl?: string;
                        /** @description Present only for multi-part assembly models, in render/ZIP order. */
                        parts?: {
                            id: string;
                            title: string;
                        }[];
                        assembly?: {
                            /** @description Assembled pose per part id. */
                            poses: {
                                [key: string]: {
                                    /** @description Translation in mm, applied after the rotation. */
                                    position: number[];
                                    /** @description Rotation in degrees about the part’s own origin, applied about X, then Y, then Z. */
                                    rotation?: number[];
                                };
                            };
                            steps: {
                                /** @description Short caption, e.g. “Close the mini box”. */
                                title: string;
                                /** @description The part ids that move together in this step. */
                                parts: string[];
                                /** @description Offset in mm at which the parts start this step; they end it at their assembled pose. */
                                from: number[];
                            }[];
                            /** @description Height in mm of the exploded layout above the print bed. */
                            lift: number;
                            /** @description Real-world objects shown in the preview for comparison, e.g. a lighter in its bay. They are parts-library entries. Not printed and not in the ZIP. */
                            references?: {
                                /** @description Its key in `poses` and `steps`. */
                                id: string;
                                /** @description The id of the parts-library entry it is. */
                                part: string;
                                /** @description What it is: the part’s title, e.g. “BIC Mini lighter (J25)”. */
                                title: string;
                            }[];
                        };
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getReferenceStl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description STL bytes; coordinates are in millimetres. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "model/stl": string;
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listPartFamilies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        description: string;
                        /** @description Facets of the family, in display order. */
                        attributes: {
                            key: string;
                            label: string;
                        }[];
                        /** @description The dimensions of the family, in display order. */
                        dimensions: {
                            key: string;
                            label: string;
                            /** @description The letter used in the standard’s drawing, e.g. “dk”. */
                            symbol: string;
                            /** @description Whether every part of the family has it. */
                            required: boolean;
                        }[];
                        /** @description How many parts the family has. */
                        count: number;
                    }[];
                };
            };
        };
    };
    getPartFamily: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        family: {
                            id: string;
                            title: string;
                            description: string;
                            /** @description Facets of the family, in display order. */
                            attributes: {
                                key: string;
                                label: string;
                            }[];
                            /** @description The dimensions of the family, in display order. */
                            dimensions: {
                                key: string;
                                label: string;
                                /** @description The letter used in the standard’s drawing, e.g. “dk”. */
                                symbol: string;
                                /** @description Whether every part of the family has it. */
                                required: boolean;
                            }[];
                        };
                        parts: {
                            id: string;
                            family: string;
                            /** @description A plain name, e.g. “Socket head cap screw M3 × 10”. */
                            title: string;
                            /** @description How it is ordered: the standard designation or the manufacturer’s article number. */
                            designation: string;
                            /** @description Other designations of the same part, e.g. the DIN standard an ISO standard replaced. */
                            aliases: string[];
                            /** @description What exactly this item is, in one or two sentences, so that it can be told apart from its neighbours. */
                            description: string;
                            /** @description The id of the source that defines it, for a standard part. */
                            standard: string | null;
                            /** @description The product, for a part that is not defined by a standard. */
                            product: {
                                manufacturer: string;
                                sku: string;
                                url: string;
                            } | null;
                            /** @description Facets the library filters by (see the family’s `attributes`). */
                            attributes: {
                                [key: string]: string;
                            };
                            /** @description Keyed by the family’s dimension keys. */
                            dimensions: {
                                [key: string]: {
                                    /** @description Nominal value in mm. */
                                    value: number;
                                    /** @description Smallest allowed value in mm, when known. */
                                    min: number | null;
                                    /** @description Largest allowed value in mm, when known. */
                                    max: number | null;
                                    /** @description `standard`: from the part’s standard. `manufacturer`: from the maker’s data. `estimated`: no published figure; estimated (e.g. from photographs), as `source` explains. */
                                    basis: "standard" | "manufacturer" | "estimated";
                                    /** @description The id of the source it was read from. */
                                    source: string;
                                };
                            };
                            /** @description Ids of every source used for this part. */
                            sources: string[];
                            notes: string | null;
                            preview: {
                                /** @enum {string} */
                                kind: "procedural";
                            } | {
                                /** @enum {string} */
                                kind: "stl";
                                /** @description The STL, rendered from the SCAD file beside it (see `partAssetPath`). */
                                path: string;
                            };
                        }[];
                        sources: {
                            /** @description Stable id, referenced by parts and dimensions. */
                            id: string;
                            title: string;
                            /** @description Who publishes it, e.g. “ISO” or “supermagnete (Webcraft GmbH)”. */
                            publisher: string;
                            url: string | null;
                            /** @description `standard`: the standard that defines the part. `manufacturer`: the maker’s own data sheet or product page. `reference`: a published copy of a standard’s table, or other secondary data. */
                            kind: "standard" | "manufacturer" | "reference";
                            /** @description The date the values were read from it (ISO 8601), for web pages that can change. */
                            accessed: string;
                        }[];
                        /** @description Models that link to a part, by part id; parts no model links to are left out. */
                        usage: {
                            [key: string]: {
                                modelId: string;
                                modelTitle: string;
                                /** @description The model’s setting that links to the part, or “Assembly preview” for a reference object. */
                                via: string;
                            }[];
                        };
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getPart: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        part: {
                            id: string;
                            family: string;
                            /** @description A plain name, e.g. “Socket head cap screw M3 × 10”. */
                            title: string;
                            /** @description How it is ordered: the standard designation or the manufacturer’s article number. */
                            designation: string;
                            /** @description Other designations of the same part, e.g. the DIN standard an ISO standard replaced. */
                            aliases: string[];
                            /** @description What exactly this item is, in one or two sentences, so that it can be told apart from its neighbours. */
                            description: string;
                            /** @description The id of the source that defines it, for a standard part. */
                            standard: string | null;
                            /** @description The product, for a part that is not defined by a standard. */
                            product: {
                                manufacturer: string;
                                sku: string;
                                url: string;
                            } | null;
                            /** @description Facets the library filters by (see the family’s `attributes`). */
                            attributes: {
                                [key: string]: string;
                            };
                            /** @description Keyed by the family’s dimension keys. */
                            dimensions: {
                                [key: string]: {
                                    /** @description Nominal value in mm. */
                                    value: number;
                                    /** @description Smallest allowed value in mm, when known. */
                                    min: number | null;
                                    /** @description Largest allowed value in mm, when known. */
                                    max: number | null;
                                    /** @description `standard`: from the part’s standard. `manufacturer`: from the maker’s data. `estimated`: no published figure; estimated (e.g. from photographs), as `source` explains. */
                                    basis: "standard" | "manufacturer" | "estimated";
                                    /** @description The id of the source it was read from. */
                                    source: string;
                                };
                            };
                            /** @description Ids of every source used for this part. */
                            sources: string[];
                            notes: string | null;
                            preview: {
                                /** @enum {string} */
                                kind: "procedural";
                            } | {
                                /** @enum {string} */
                                kind: "stl";
                                /** @description The STL, rendered from the SCAD file beside it (see `partAssetPath`). */
                                path: string;
                            };
                        };
                        family: {
                            id: string;
                            title: string;
                            description: string;
                            /** @description Facets of the family, in display order. */
                            attributes: {
                                key: string;
                                label: string;
                            }[];
                            /** @description The dimensions of the family, in display order. */
                            dimensions: {
                                key: string;
                                label: string;
                                /** @description The letter used in the standard’s drawing, e.g. “dk”. */
                                symbol: string;
                                /** @description Whether every part of the family has it. */
                                required: boolean;
                            }[];
                        };
                        sources: {
                            /** @description Stable id, referenced by parts and dimensions. */
                            id: string;
                            title: string;
                            /** @description Who publishes it, e.g. “ISO” or “supermagnete (Webcraft GmbH)”. */
                            publisher: string;
                            url: string | null;
                            /** @description `standard`: the standard that defines the part. `manufacturer`: the maker’s own data sheet or product page. `reference`: a published copy of a standard’s table, or other secondary data. */
                            kind: "standard" | "manufacturer" | "reference";
                            /** @description The date the values were read from it (ISO 8601), for web pages that can change. */
                            accessed: string;
                        }[];
                        usage: {
                            modelId: string;
                            modelTitle: string;
                            /** @description The model’s setting that links to the part, or “Assembly preview” for a reference object. */
                            via: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    createRender: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Complete, uncoerced settings for one model version. */
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    modelId: "fruit-fly-trap";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Fruit fly trap parameters. All fields are required; dimensions are in millimetres. */
                    parameters: {
                        /**
                         * Funnel diameter
                         * @description Outer diameter at the wide end, excluding the brim, in mm.
                         * @default 60
                         */
                        trapDiameter: number;
                        /**
                         * Funnel height
                         * @description Overall printed height in mm.
                         * @default 60
                         */
                        trapHeight: number;
                        /**
                         * Brim width
                         * @description Radial width extending outward on each side of the funnel, in mm.
                         * @default 10
                         */
                        brimWidth: number;
                        /**
                         * Central opening
                         * @description Inner diameter of the opening at the narrow end, in mm.
                         * @default 3.5
                         */
                        nozzleDiameter: number;
                        /**
                         * Ventilation slots
                         * @description Distribute small slots automatically over the funnel. Disable for a smooth wall.
                         * @default true
                         */
                        slotsEnabled: boolean;
                        /**
                         * Wall thickness
                         * @description Thickness of the funnel wall and brim in mm.
                         * @default 0.8
                         */
                        wallThickness: number;
                        /**
                         * Brim handles
                         * @description Add two opposing handles, sized with the brim.
                         * @default true
                         */
                        handles: boolean;
                        /**
                         * Slot height
                         * @description Vertical height of each ventilation slot in mm.
                         * @default 1.6
                         */
                        gapHeight: number;
                        /**
                         * Slot width
                         * @description Width of each ventilation slot in mm.
                         * @default 0.4
                         */
                        gapWidth: number;
                        /**
                         * Horizontal spacing
                         * @description Target spacing between slots around each layer, in mm.
                         * @default 1.6
                         */
                        gapDistanceHorizontal: number;
                        /**
                         * Vertical spacing
                         * @description Target spacing between slot layers, in mm.
                         * @default 1.6
                         */
                        gapDistanceVertical: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "moss-planter";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "2";
                    /** @description Moss planter parameters. Lengths are in millimetres. All fields are required. */
                    parameters: {
                        /**
                         * Tower diameter
                         * @description Outer diameter of the lattice segments and cover cap, in mm. Every part is scaled to it, so all parts fit together. The original design is 52 or 100.
                         * @default 52
                         */
                        towerDiameter: number;
                        /**
                         * Ground spike length
                         * @description Overall length of the ground spike in mm. At least 60 mm for a 52 mm tower, growing in proportion to the tower diameter (the original 52 mm spike is 124 mm).
                         * @default 124
                         */
                        spikeLength: number;
                        /**
                         * Short lattice rows
                         * @description Rows of diamonds in the short lattice segment. The height grows by about 17.5 mm per row (the original has 4).
                         * @default 4
                         */
                        shortRauteRows: number;
                        /**
                         * Tall lattice rows
                         * @description Rows of diamonds in the tall lattice segment. The height grows by about 17.5 mm per row (the original has 10).
                         * @default 10
                         */
                        tallRauteRows: number;
                        /**
                         * Lattice columns
                         * @description Struts around both lattice segments. 0 chooses automatically from the tower diameter (6 at 52 mm, 12 at 100 mm); otherwise 4 to 16.
                         * @default 0
                         */
                        rauteColumns: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "cigarette-case";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "8";
                    /** @description Cigarette case parameters. All fields are required. */
                    parameters: {
                        /**
                         * Case lid snap
                         * @description How the case lid holds on the case box: a plain close fit, a detent, a flexible clip, magnets or crush ribs. The other joints have their own settings.
                         * @default friction
                         * @enum {unknown}
                         */
                        snap: "friction" | "detent" | "clip" | "magnet" | "crush-ribs";
                        /**
                         * Magnets
                         * @description The round magnets the case lid snap is sized for, with magnets: two in the box and two in the lid. Each is a real product from the parts library; its pockets are cut to its greatest size.
                         * @default supermagnete-s-06-02-n
                         * @enum {unknown}
                         */
                        magnet: "supermagnete-s-04-02-n" | "supermagnete-s-05-02-n52n" | "supermagnete-s-06-02-n" | "supermagnete-s-08-02-n";
                        /**
                         * Mini box lid
                         * @description How the mini lid holds in the mini box: the original pads (a clearance fit), a detent or crush ribs.
                         * @default friction
                         * @enum {unknown}
                         */
                        miniLidSnap: "friction" | "detent" | "crush-ribs";
                        /**
                         * Holder in the box
                         * @description How the mini holder is held in the case box's round bay, which is open through the floor: a friction fit, a detent or crush ribs.
                         * @default friction
                         * @enum {unknown}
                         */
                        holderSnap: "friction" | "detent" | "crush-ribs";
                        /**
                         * Lighter in the box
                         * @description How the BIC Mini lighter is held in the round bay, above the holder: the fitted bay alone (a friction fit) or crush ribs.
                         * @default friction
                         * @enum {unknown}
                         */
                        lighterSnap: "friction" | "crush-ribs";
                        /**
                         * Mini box in the lid
                         * @description How the closed mini box is held in the case lid, so that it comes off with the lid: a friction fit, a detent or crush ribs.
                         * @default friction
                         * @enum {unknown}
                         */
                        miniBoxSnap: "friction" | "detent" | "crush-ribs";
                        /**
                         * Underside text
                         * @description Text on the underside of the large box, one line, up to 20 characters (letters, digits, spaces and punctuation, no accents). Leave empty for none.
                         * @default
                         */
                        engraveText: string;
                        /**
                         * Text font
                         * @description The font of the underside text. All are bold, so that the strokes print cleanly.
                         * @default sans
                         * @enum {unknown}
                         */
                        textFont: "sans" | "serif" | "mono" | "wide";
                        /**
                         * Text size
                         * @description Letter height of the underside text in mm (the height of a capital letter). Longer text needs a smaller size.
                         * @default 6
                         */
                        textSize: number;
                        /**
                         * Underside mark
                         * @description What goes on the underside of the large box: a line of text, or a logo from an SVG file.
                         * @default text
                         * @enum {unknown}
                         */
                        undersideMark: "text" | "logo";
                        /**
                         * Underside logo
                         * @description An SVG file whose filled shapes are engraved on the underside of the large box, mirrored so that they read correctly. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.
                         * @default
                         */
                        logo: string;
                        /**
                         * Logo size
                         * @description Height of the underside logo in mm. A wide logo is made smaller, so that it stays within the 34.5 mm free width.
                         * @default 12
                         */
                        logoSize: number;
                        /**
                         * Underside style
                         * @description The text or logo is engraved into the box, or carved and filled by a separate part for a second filament.
                         * @default engrave
                         * @enum {unknown}
                         */
                        textMode: "engrave" | "second-filament";
                        /**
                         * Clearance
                         * @description Gap per side between parts that fit together (lid on box, mini box in the lid, holder and lighter in the box), in mm. Larger is looser; raise it if your printer prints parts that are too tight.
                         * @default 0.2
                         */
                        clearance: number;
                        /**
                         * Detent engagement (case lid)
                         * @description How far the bump on the case box reaches past the case lid's wall, in mm, on top of the clearance. More clicks harder.
                         * @default 0.19
                         */
                        snapDetentEngage: number;
                        /**
                         * Crush-rib squeeze (case lid)
                         * @description How much the ribs on the case box are squeezed by the case lid, in mm, on top of the clearance. More holds tighter.
                         * @default 0.16
                         */
                        snapCrushSqueeze: number;
                        /**
                         * Detent engagement (mini box lid)
                         * @description How far the bumps on the mini lid reach past the mini box's wall, in mm, on top of the clearance. More clicks harder.
                         * @default 0.12
                         */
                        miniLidDetentEngage: number;
                        /**
                         * Crush-rib squeeze (mini box lid)
                         * @description How much the ribs on the mini lid are squeezed by the mini box, in mm, on top of the clearance. More holds tighter.
                         * @default 0.1
                         */
                        miniLidCrushSqueeze: number;
                        /**
                         * Detent engagement (holder in the box)
                         * @description How far the bumps on the holder reach past the bay wall, in mm, on top of the clearance. More holds harder, but a lighter must still push the holder out.
                         * @default 0.15
                         */
                        holderDetentEngage: number;
                        /**
                         * Crush-rib squeeze (holder in the box)
                         * @description How much the ribs on the holder are squeezed by the bay wall, in mm, on top of the clearance. More holds tighter, but a lighter must still push the holder out.
                         * @default 0.1
                         */
                        holderCrushSqueeze: number;
                        /**
                         * Crush-rib squeeze (lighter in the box)
                         * @description How much the ribs in the round bay are squeezed by the lighter, in mm, on top of the clearance. More holds tighter, but the lighter must still slide in, and push the holder out upside down.
                         * @default 0.1
                         */
                        lighterCrushSqueeze: number;
                        /**
                         * Detent engagement (mini box in the lid)
                         * @description How far the bumps in the case lid reach past the mini box's wall, in mm, on top of the clearance. More holds harder, but a finger must still pull the mini box out.
                         * @default 0.15
                         */
                        miniBoxDetentEngage: number;
                        /**
                         * Crush-rib squeeze (mini box in the lid)
                         * @description How much the ribs in the case lid are squeezed by the mini box, in mm, on top of the clearance. More holds tighter, but a finger must still pull the mini box out.
                         * @default 0.1
                         */
                        miniBoxCrushSqueeze: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "plank-connector";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Plank connector parameters. All fields are required; dimensions are in millimetres. */
                    parameters: {
                        /**
                         * Pocket width
                         * @description Wide side of each pocket in mm: the plank width plus clearance. The default fits a 50.20 mm plank with 0.02 mm to spare.
                         * @default 50.22
                         */
                        pocketWidth: number;
                        /**
                         * Pocket thickness
                         * @description Thin side of each pocket in mm: the plank thickness plus clearance. The default fits a 4.80 mm plank exactly.
                         * @default 4.8
                         */
                        pocketThickness: number;
                        /**
                         * Insertion depth
                         * @description How far each plank end goes into the connector, in mm.
                         * @default 20
                         */
                        insertionDepth: number;
                        /**
                         * Screw holes
                         * @description Optional through-holes across the wide faces, to screw or bolt each plank in place, sized for the chosen metric screw per DIN EN 20273. Drill the planks to match.
                         * @default none
                         * @enum {unknown}
                         */
                        screwHoles: "none" | "M2" | "M2.5" | "M3" | "M4" | "M5" | "M6" | "M8";
                        /**
                         * Hole fit
                         * @description The DIN EN 20273 series of the screw holes (when there are holes).
                         * @default medium
                         * @enum {unknown}
                         */
                        holeFit: "fine" | "medium" | "coarse";
                        /**
                         * Holes per plank
                         * @description Screw holes per plank end, spread evenly across the pocket width (when there are holes).
                         * @default 2
                         */
                        holesPerEnd: number;
                        /**
                         * Wall thickness
                         * @description Material around the pockets on every side, in mm.
                         * @default 2
                         */
                        wallThickness: number;
                        /**
                         * Centre stop
                         * @description Thickness of the solid stop between the two pockets, in mm. 0 makes an open sleeve that the planks can slide through.
                         * @default 2
                         */
                        stopThickness: number;
                        /**
                         * Entry chamfer
                         * @description Size of the 45° lead-in at each pocket opening, in mm, which eases the plank in. 0 for none.
                         * @default 0.5
                         */
                        entryChamfer: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "litter-shovel";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "3";
                    /** @description Litter shovel parameters. All fields are required; dimensions are in millimetres. */
                    parameters: {
                        /**
                         * Sieve texture
                         * @description The shape and arrangement of the gaps in the scoop’s walls: across the back, round the corners and along the sides.
                         * @default slots
                         * @enum {unknown}
                         */
                        sievePattern: "slots" | "staggered" | "round" | "hex";
                        /**
                         * Gap width
                         * @description Width of each gap in mm: the slot width, the hole diameter or the hexagon’s size across flats. Litter finer than this falls through.
                         * @default 7.2
                         */
                        gapWidth: number;
                        /**
                         * Slot sizing
                         * @description Size the slots by how many rows there are (they fill the sieve’s height) or by their length (slot textures only).
                         * @default rows
                         * @enum {unknown}
                         */
                        sieveSizing: "rows" | "length";
                        /**
                         * Slot rows
                         * @description How many rows of slots there are, one above the other (slot textures, sized by rows). The slots share the sieve’s height, as long as it lets them be, with a bar between rows.
                         * @default 1
                         */
                        sieveRows: number;
                        /**
                         * Slot length
                         * @description Length of each slot along the wall, in mm (slot textures, sized by length). At least the gap width; at most what the scoop’s length, the tip bevel and the margin leave room for.
                         * @default 25
                         */
                        gapLength: number;
                        /**
                         * Bar width
                         * @description Solid wall between neighbouring gaps, in mm. Wider bars make a stiffer sieve with less open area.
                         * @default 5.6
                         */
                        gapSpacing: number;
                        /**
                         * Sieve margin
                         * @description Solid border kept between the gaps and the wall’s edges (the solid band above the cap, the bevel under the tip, the side walls’ top and the front corners), in mm.
                         * @default 3.2
                         */
                        sieveMargin: number;
                        /**
                         * Wall thickness
                         * @description Thickness of the shell’s walls, in mm: the container’s and the scoop’s blade (the floor follows it, and the handle’s root and the screws’ seats keep their strength). Three to five lines of a 0.4 mm nozzle are 1.2 to 2.0 mm; thicker only adds weight and print time. It also caps the tip thickness.
                         * @default 1.6
                         */
                        wallThickness: number;
                        /**
                         * Tip thickness
                         * @description Thickness of the scoop’s straight scraping edge, in mm. Thinner scrapes cleaner; thicker is sturdier.
                         * @default 0.8
                         */
                        tipThickness: number;
                        /**
                         * Scoop length
                         * @description How far the scoop’s blade reaches, in mm: the height of its straight scraping edge over the cap. A longer scoop takes more litter in one go and has a taller sieve: longer slots, or more rows of gaps.
                         * @default 127
                         */
                        scoopLength: number;
                        /**
                         * Tip bevel length
                         * @description How far down from the scraping edge the scoop’s inner face is bevelled, in mm. The sieve stays below the bevel.
                         * @default 12
                         */
                        tipBevel: number;
                        /**
                         * Grip end
                         * @description Where the grip ends: open above the floor (the container’s grip tip needs slicer supports), or down on the floor (no supports).
                         * @default open
                         * @enum {unknown}
                         */
                        gripEnd: "open" | "floor";
                        /**
                         * Grip supports
                         * @description Thin fins that brace the container’s handle under its slope, side by side across the grip. More fins make it stiffer.
                         * @default 3
                         */
                        supportCount: number;
                        /**
                         * Dam width
                         * @description How far the dam under the container’s mouth, on the scraper side, reaches in from the back wall, in mm (0 for none). It falls inward at 45°: turned over to scoop, the clumps already inside collect behind it instead of falling out.
                         * @default 8
                         */
                        damWidth: number;
                        /**
                         * Support thickness
                         * @description Thickness of each fin under the container’s handle, in mm.
                         * @default 2
                         */
                        supportThickness: number;
                        /**
                         * Scoop on the container
                         * @description How the scoop’s sleeve holds in the container’s mouth: a close fit only, or a detent.
                         * @default detent
                         * @enum {unknown}
                         */
                        scoopSnap: "friction" | "detent";
                        /**
                         * Handle on the scoop
                         * @description How the handle’s ring holds on the base of the scoop’s blade: a close fit only, or a detent.
                         * @default detent
                         * @enum {unknown}
                         */
                        handleSnap: "friction" | "detent";
                        /**
                         * Handle reinforcement
                         * @description Whether two screws also fasten the handle to the scoop for good, beside the grip: into threaded inserts or nuts on the handle’s ring. On top of the snap setting.
                         * @default none
                         * @enum {unknown}
                         */
                        handleReinforcement: "none" | "threaded-insert" | "nut-bolt";
                        /**
                         * Screw thread
                         * @description The thread of the two screws and their inserts or nuts. A larger thread holds harder and needs larger bosses on the ring.
                         * @default M3
                         * @enum {unknown}
                         */
                        handleThread: "M2" | "M2.5" | "M3" | "M4";
                        /**
                         * Threaded inserts
                         * @description The heat-set inserts, a real product from the parts library: each boss’s hole and wall are sized from the maker’s recommendation.
                         * @default cnc-kitchen-m3x5-7
                         * @enum {unknown}
                         */
                        handleInsert: "cnc-kitchen-m2x3" | "cnc-kitchen-m2-5x4" | "cnc-kitchen-m3x5-7" | "cnc-kitchen-m3x3" | "cnc-kitchen-m3x5x4" | "cnc-kitchen-m4x8-1" | "cnc-kitchen-m4x4" | "ruthex-rx-m2x4" | "ruthex-rx-m3x5-7" | "ruthex-rx-m4x8-1";
                        /**
                         * Nuts
                         * @description The nuts, standard parts from the parts library: each boss’s pocket is cut to the nut’s greatest size.
                         * @default iso-4032-m3
                         * @enum {unknown}
                         */
                        handleNut: "iso-4032-m2" | "iso-4032-m2-5" | "iso-4032-m3" | "iso-4032-m4" | "iso-4035-m2" | "iso-4035-m2-5" | "iso-4035-m3" | "iso-4035-m4" | "iso-10511-m3" | "iso-10511-m4" | "din-562-m2" | "din-562-m2-5" | "din-562-m3" | "din-562-m4";
                        /**
                         * Screws
                         * @description The countersunk screws, standard parts from the parts library, driven from inside the scoop so that their heads sit flush. The bosses on the ring end where the screws do: a longer screw makes them deeper.
                         * @default iso-10642-m3x12
                         * @enum {unknown}
                         */
                        handleScrew: "iso-10642-m3x8" | "iso-10642-m3x10" | "iso-10642-m3x12" | "iso-10642-m3x16" | "iso-10642-m4x8" | "iso-10642-m4x10" | "iso-10642-m4x12" | "iso-10642-m4x16" | "iso-7046-m2x8" | "iso-7046-m2x10" | "iso-7046-m2x12" | "iso-7046-m2x16" | "iso-7046-m2-5x8" | "iso-7046-m2-5x10" | "iso-7046-m2-5x12" | "iso-7046-m2-5x16" | "iso-7046-m3x8" | "iso-7046-m3x10" | "iso-7046-m3x12" | "iso-7046-m3x16" | "iso-7046-m4x8" | "iso-7046-m4x10" | "iso-7046-m4x12" | "iso-7046-m4x16";
                        /**
                         * Clearance
                         * @description Gap per side between parts that fit together (the scoop’s sleeve in the container’s mouth, the handle’s ring on the scoop’s blade), in mm. Larger is looser; raise it if your printer prints parts that are too tight.
                         * @default 0.2
                         */
                        clearance: number;
                        /**
                         * Detent engagement (scoop on the container)
                         * @description How far the bumps on the scoop’s sleeve reach past the container’s mouth, in mm, on top of the clearance. More clicks harder.
                         * @default 0.15
                         */
                        scoopDetentEngage: number;
                        /**
                         * Detent engagement (handle on the scoop)
                         * @description How far the bumps on the scoop’s blade reach past the handle’s ring, in mm, on top of the clearance. More clicks harder.
                         * @default 0.15
                         */
                        handleDetentEngage: number;
                    };
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        modelId: string;
                        modelVersion: string;
                        /** @enum {unknown} */
                        status: "queued" | "running" | "succeeded" | "failed";
                        createdAt: number;
                        expiresAt: number;
                        slotCount: number | null;
                        artifact: {
                            /** @description The same bytes are used for preview and download. Add ?download=true for attachment disposition. */
                            url: string;
                            sha256: string;
                            bytes: number;
                            triangles: number;
                            /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                            dimensions?: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres, summed across parts for an assembly. */
                            volume: number;
                            /** @description Present only for a multi-part assembly’s ZIP artifact, in ZIP order. */
                            parts?: {
                                id: string;
                                title: string;
                                bytes: number;
                                triangles: number;
                                /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                                dimensions: {
                                    x: number;
                                    y: number;
                                    z: number;
                                };
                                /** @description Enclosed material volume in cubic millimetres. */
                                volume: number;
                            }[];
                        } | null;
                        error: {
                            /**
                             * @description Stable machine-readable error code.
                             * @example INVALID_PARAMETERS
                             */
                            code: string;
                            /** @description Actionable human-readable explanation. */
                            message: string;
                            issues: {
                                field: string;
                                message: string;
                            }[];
                        } | null;
                    };
                };
            };
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        modelId: string;
                        modelVersion: string;
                        /** @enum {unknown} */
                        status: "queued" | "running" | "succeeded" | "failed";
                        createdAt: number;
                        expiresAt: number;
                        slotCount: number | null;
                        artifact: {
                            /** @description The same bytes are used for preview and download. Add ?download=true for attachment disposition. */
                            url: string;
                            sha256: string;
                            bytes: number;
                            triangles: number;
                            /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                            dimensions?: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres, summed across parts for an assembly. */
                            volume: number;
                            /** @description Present only for a multi-part assembly’s ZIP artifact, in ZIP order. */
                            parts?: {
                                id: string;
                                title: string;
                                bytes: number;
                                triangles: number;
                                /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                                dimensions: {
                                    x: number;
                                    y: number;
                                    z: number;
                                };
                                /** @description Enclosed material volume in cubic millimetres. */
                                volume: number;
                            }[];
                        } | null;
                        error: {
                            /**
                             * @description Stable machine-readable error code.
                             * @example INVALID_PARAMETERS
                             */
                            code: string;
                            /** @description Actionable human-readable explanation. */
                            message: string;
                            issues: {
                                field: string;
                                message: string;
                            }[];
                        } | null;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getRender: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        modelId: string;
                        modelVersion: string;
                        /** @enum {unknown} */
                        status: "queued" | "running" | "succeeded" | "failed";
                        createdAt: number;
                        expiresAt: number;
                        slotCount: number | null;
                        artifact: {
                            /** @description The same bytes are used for preview and download. Add ?download=true for attachment disposition. */
                            url: string;
                            sha256: string;
                            bytes: number;
                            triangles: number;
                            /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                            dimensions?: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres, summed across parts for an assembly. */
                            volume: number;
                            /** @description Present only for a multi-part assembly’s ZIP artifact, in ZIP order. */
                            parts?: {
                                id: string;
                                title: string;
                                bytes: number;
                                triangles: number;
                                /** @description Axis-aligned dimensions in millimetres, including brim and handles. */
                                dimensions: {
                                    x: number;
                                    y: number;
                                    z: number;
                                };
                                /** @description Enclosed material volume in cubic millimetres. */
                                volume: number;
                            }[];
                        } | null;
                        error: {
                            /**
                             * @description Stable machine-readable error code.
                             * @example INVALID_PARAMETERS
                             */
                            code: string;
                            /** @description Actionable human-readable explanation. */
                            message: string;
                            issues: {
                                field: string;
                                message: string;
                            }[];
                        } | null;
                    };
                };
            };
            /** @description Default Response */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getRenderStl: {
        parameters: {
            query?: {
                download?: "true";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description STL bytes; coordinates are in millimetres. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "model/stl": string;
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getRenderZip: {
        parameters: {
            query?: {
                download?: "true";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ZIP archive containing this model’s STL parts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/zip": string;
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Stable machine-readable error code.
                         * @example INVALID_PARAMETERS
                         */
                        code: string;
                        /** @description Actionable human-readable explanation. */
                        message: string;
                        issues: {
                            field: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
}
