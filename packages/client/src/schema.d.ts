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
                        controls: {
                            key: string;
                            label: string;
                            description: string;
                            kind: "number" | "boolean";
                            group: "basic" | "advanced";
                            unit: "mm" | null;
                            default: number | boolean;
                            minimum: number | null;
                            maximum: number | null;
                            step: number | null;
                            enabledWhen: string | null;
                        }[];
                        defaults: {
                            [key: string]: number | boolean;
                        };
                        /** @description JSON Schema for this model’s parameter object. */
                        parameterSchema: {
                            [key: string]: unknown;
                        };
                        referenceUrl: string;
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
                            dimensions: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres. */
                            volume: number;
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
                            dimensions: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres. */
                            volume: number;
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
                            dimensions: {
                                x: number;
                                y: number;
                                z: number;
                            };
                            /** @description Enclosed material volume in cubic millimetres. */
                            volume: number;
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
}
