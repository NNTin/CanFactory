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
                            kind: "number" | "boolean" | "enum" | "text";
                            group: "basic" | "advanced";
                            unit: "mm" | null;
                            default: number | boolean | string;
                            minimum: number | null;
                            /** @description Upper bound of a number; for a text control, the most characters allowed. */
                            maximum: number | null;
                            step: number | null;
                            enabledWhen: string | null;
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
                    modelVersion: "5";
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
                         * Text style
                         * @description Engraved into the box, or carved and filled by a separate part for a second filament.
                         * @default engrave
                         * @enum {unknown}
                         */
                        textMode: "engrave" | "second-filament";
                        /**
                         * Clearance
                         * @description Gap per side between parts that fit together (lid on box, mini box in the lid, holder in the box), in mm. Larger is looser; raise it if your printer prints parts that are too tight.
                         * @default 0.2
                         */
                        clearance: number;
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
