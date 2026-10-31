// Generated from docs/openapi.json. Run npm run contracts:generate.
export interface paths {
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
    "/api/v1/market": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The visitor’s market (by country) and the networks that link in each market
         * @description DE, AT and CH shop in the DE market (amazon.de); every other or unknown country in the US market (amazon.com). The country is Cloudflare’s CF-IPCountry header; it is not stored.
         */
        get: operations["getMarket"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/offers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Where to buy parts: ranked affiliate offers per part, and the buy list grouped by shop
         * @description Curated offers of the market’s networks with an account, best first, in packs that cover each quantity; a search of the market’s Amazon for a part with none. Amazon offers never carry a price; an Awin offer carries its feed’s price for 72 hours after Awin imported the feed.
         */
        get: operations["getOffers"];
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
                    };
                };
            };
        };
    };
    getMarket: {
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
                        /** @description `DE`: amazon.de and German Awin advertisers. `US`: amazon.com and US Awin advertisers. */
                        market: "DE" | "US";
                        /** @description The visitor’s country as Cloudflare saw it (CF-IPCountry), or null when unknown. */
                        country: string | null;
                        /** @description `geo`: from the country. `default`: no country, so the US market. */
                        source: "geo" | "default";
                        /** @description Which networks link, per market. With none, the site shows no affiliate links. */
                        networks: {
                            DE: {
                                amazon: boolean;
                                awin: boolean;
                            };
                            US: {
                                amazon: boolean;
                                awin: boolean;
                            };
                        };
                    };
                };
            };
        };
    };
    getOffers: {
        parameters: {
            query: {
                /** @description `DE`: amazon.de and German Awin advertisers. `US`: amazon.com and US Awin advertisers. */
                market: "DE" | "US";
                /** @description The parts and how many of each (default 1), e.g. `ruthex-rx-m3x5-7:4,iso-4762-m3x10:8`. */
                parts: string;
            };
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
                        /** @description `DE`: amazon.de and German Awin advertisers. `US`: amazon.com and US Awin advertisers. */
                        market: "DE" | "US";
                        networks: {
                            amazon: boolean;
                            awin: boolean;
                        };
                        /** @description One per requested part, in request order. */
                        matches: {
                            partId: string;
                            quantity: number;
                            /** @description Best first. Empty when no network is enabled for the market. */
                            offers: {
                                /** @description The curated offer, or null for a search link. */
                                offerId: string | null;
                                /** @description `curated`: a checked listing. `search`: a search of the market’s Amazon, for a part with no curated offer. */
                                kind: "curated" | "search";
                                network: "amazon" | "awin";
                                /** @description The shop as shown to visitors, e.g. “amazon.de”. */
                                shop: string;
                                /** @description Groups the buy list by shop: `amazon-DE`, `amazon-US` or `awin-<advertiserId>`. */
                                shopKey: string;
                                title: string;
                                /** @description The affiliate link. Shown with rel="sponsored". */
                                url: string;
                                asin: string | null;
                                covers: {
                                    partId: string;
                                    quantity: number;
                                }[];
                                /** @description Packs needed for the requested quantity of the part (1 for a search). */
                                packs: number;
                                sameAsProduct: boolean;
                                /** @description Awin only, from the advertiser’s feed. Amazon offers never carry a price. */
                                price: {
                                    amount: number;
                                    currency: string;
                                    /** @description Shipping, when the feed gives it. */
                                    deliveryCost: number | null;
                                    /** @description When the advertiser’s feed was imported (ISO 8601); prices older than 72 hours are not given. */
                                    asOf: string;
                                } | null;
                                inStock: boolean | null;
                            }[];
                        }[];
                        /** @description The buy list: the best offer of every part, grouped by shop. */
                        shops: {
                            shopKey: string;
                            shop: string;
                            network: "amazon" | "awin";
                            lines: {
                                offer: {
                                    /** @description The curated offer, or null for a search link. */
                                    offerId: string | null;
                                    /** @description `curated`: a checked listing. `search`: a search of the market’s Amazon, for a part with no curated offer. */
                                    kind: "curated" | "search";
                                    network: "amazon" | "awin";
                                    /** @description The shop as shown to visitors, e.g. “amazon.de”. */
                                    shop: string;
                                    /** @description Groups the buy list by shop: `amazon-DE`, `amazon-US` or `awin-<advertiserId>`. */
                                    shopKey: string;
                                    title: string;
                                    /** @description The affiliate link. Shown with rel="sponsored". */
                                    url: string;
                                    asin: string | null;
                                    covers: {
                                        partId: string;
                                        quantity: number;
                                    }[];
                                    /** @description Packs needed for the requested quantity of the part (1 for a search). */
                                    packs: number;
                                    sameAsProduct: boolean;
                                    /** @description Awin only, from the advertiser’s feed. Amazon offers never carry a price. */
                                    price: {
                                        amount: number;
                                        currency: string;
                                        /** @description Shipping, when the feed gives it. */
                                        deliveryCost: number | null;
                                        /** @description When the advertiser’s feed was imported (ISO 8601); prices older than 72 hours are not given. */
                                        asOf: string;
                                    } | null;
                                    inStock: boolean | null;
                                };
                                /** @description Packs to buy: enough of every part the pack covers. */
                                packs: number;
                                /** @description The requested parts this line buys. */
                                partIds: string[];
                            }[];
                            /** @description One link that puts every line in the basket, where the shop supports it. */
                            cartUrl: string | null;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        magnet: "supermagnete-s-04-02-n" | "supermagnete-s-05-01-n" | "supermagnete-s-05-02-n52n" | "supermagnete-s-06-01-n" | "supermagnete-s-06-02-n" | "supermagnete-s-08-01-n" | "supermagnete-s-08-02-n";
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
                         * Handle shape
                         * @description The grip’s shape: a flat sheet, a curved sheet, a round tube or a rectangular bar. The round and rectangular bars are thicker, so the container and the handle grow to make room for them.
                         * @default sheet
                         * @enum {unknown}
                         */
                        handleShape: "sheet" | "curved" | "round" | "rectangular";
                        /**
                         * Grip bulge
                         * @description How far the curved grip’s middle bulges towards the palm past its long edges, in mm; the sheet is bowed across its width along its whole run. 0 is as flat as the flat sheet.
                         * @default 3
                         */
                        gripBulge: number;
                        /**
                         * Grip size
                         * @description The round tube’s diameter, or the rectangular bar’s depth, in mm. The rectangular bar is always 26 mm wide. The flat sheet is 6 mm thick; a thinner bar than the default is easier to close a hand round.
                         * @default 14
                         */
                        gripSize: number;
                        /**
                         * Grip supports
                         * @description Thin fins that brace the container’s handle under its slope, side by side across the grip. More fins make it stiffer. The round and rectangular bars are solid and need none.
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
                } | {
                    /** @enum {string} */
                    modelId: "ai-rubber-duck";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    parameters: {
                        /**
                         * Version
                         * @description Choose the brand face and round or sculpted head from the concept gallery.
                         * @default claude-v1-round
                         * @enum {unknown}
                         */
                        variant: "claude-v1-round" | "claude-v2-sculpted" | "codex-v1-round" | "codex-v2-sculpted" | "anthropic-v1-round" | "anthropic-v2-sculpted" | "openai-v1-round" | "openai-v2-sculpted";
                        /**
                         * Body length
                         * @description Length from breast to tail in mm. All pieces are generated to fit at this size.
                         * @default 90
                         */
                        bodyLength: number;
                        /**
                         * Joint clearance
                         * @description Gap per side around the peg core in mm. Smaller values grip more tightly; the small crush ribs hold the pieces together.
                         * @default 0.2
                         */
                        clearance: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "toggle-latch";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Toggle latch parameters. All fields are required; the screw fields are parts-library ids or attribute values. */
                    parameters: {
                        /**
                         * Screws
                         * @description What the base and the catch are screwed on with: two screws each.
                         * @default wood
                         * @enum {unknown}
                         */
                        screwKind: "wood" | "machine";
                        /**
                         * Wood screw diameter
                         * @description The wood screws’ diameter; the screws below are those of this diameter.
                         * @default 4 mm
                         * @enum {unknown}
                         */
                        woodScrewDiameter: "3 mm" | "3.5 mm" | "4 mm" | "4.5 mm" | "5 mm";
                        /**
                         * Wood screw
                         * @description The wood screw the holes and countersinks are sized for. Its length does not change the latch; choose one that bites far enough into the timber.
                         * @default din-7997-4x25
                         * @enum {unknown}
                         */
                        woodScrew: "din-7997-3x12" | "din-7997-3x16" | "din-7997-3x20" | "din-7997-3x25" | "din-7997-3x30" | "din-7997-3-5x16" | "din-7997-3-5x20" | "din-7997-3-5x25" | "din-7997-3-5x30" | "din-7997-3-5x35" | "din-7997-3-5x40" | "din-7997-4x20" | "din-7997-4x25" | "din-7997-4x30" | "din-7997-4x35" | "din-7997-4x40" | "din-7997-4x45" | "din-7997-4x50" | "din-7997-4-5x25" | "din-7997-4-5x30" | "din-7997-4-5x35" | "din-7997-4-5x40" | "din-7997-4-5x45" | "din-7997-4-5x50" | "din-7997-4-5x60" | "din-7997-5x30" | "din-7997-5x35" | "din-7997-5x40" | "din-7997-5x50" | "din-7997-5x60" | "din-7997-5x70" | "din-7997-5x80";
                        /**
                         * Thread
                         * @description The machine screws’ thread; the screws below are those of this thread.
                         * @default M4
                         * @enum {unknown}
                         */
                        screwThread: "M2" | "M2.5" | "M3" | "M4" | "M5";
                        /**
                         * Machine screw
                         * @description The machine screw the holes are sized for: a countersunk head gets a countersink, any other head sits on the plate. Its length does not change the latch.
                         * @default iso-10642-m4x12
                         * @enum {unknown}
                         */
                        machineScrew: "iso-4762-m2x8" | "iso-4762-m2x10" | "iso-4762-m2x12" | "iso-4762-m2x16" | "iso-4762-m2x20" | "iso-4762-m2-5x8" | "iso-4762-m2-5x10" | "iso-4762-m2-5x12" | "iso-4762-m2-5x16" | "iso-4762-m2-5x20" | "iso-4762-m2-5x25" | "iso-4762-m3x8" | "iso-4762-m3x10" | "iso-4762-m3x12" | "iso-4762-m3x14" | "iso-4762-m3x16" | "iso-4762-m3x20" | "iso-4762-m3x25" | "iso-4762-m3x30" | "iso-4762-m4x8" | "iso-4762-m4x10" | "iso-4762-m4x12" | "iso-4762-m4x16" | "iso-4762-m4x20" | "iso-4762-m4x25" | "iso-4762-m4x30" | "iso-4762-m4x35" | "iso-4762-m4x40" | "iso-7380-m3x8" | "iso-7380-m3x10" | "iso-7380-m3x12" | "iso-7380-m3x16" | "iso-7380-m4x8" | "iso-7380-m4x10" | "iso-7380-m4x12" | "iso-7380-m4x16" | "iso-7380-m4x20" | "iso-10642-m3x8" | "iso-10642-m3x10" | "iso-10642-m3x12" | "iso-10642-m3x16" | "iso-10642-m3x20" | "iso-10642-m3x25" | "iso-10642-m3x30" | "iso-10642-m4x8" | "iso-10642-m4x10" | "iso-10642-m4x12" | "iso-10642-m4x16" | "iso-10642-m4x20" | "iso-10642-m4x25" | "iso-10642-m4x30" | "iso-10642-m4x40" | "iso-10642-m5x8" | "iso-10642-m5x10" | "iso-10642-m5x12" | "iso-10642-m5x16" | "iso-10642-m5x20" | "iso-10642-m5x25" | "iso-10642-m5x30" | "iso-10642-m5x40" | "iso-10642-m5x50" | "iso-4017-m2x8" | "iso-4017-m2x10" | "iso-4017-m2x12" | "iso-4017-m2-5x8" | "iso-4017-m2-5x10" | "iso-4017-m2-5x12" | "iso-4017-m2-5x16" | "iso-4017-m3x8" | "iso-4017-m3x10" | "iso-4017-m3x12" | "iso-4017-m3x16" | "iso-4017-m3x20" | "iso-4017-m3x25" | "iso-4017-m3x30" | "iso-4017-m4x8" | "iso-4017-m4x10" | "iso-4017-m4x12" | "iso-4017-m4x16" | "iso-4017-m4x20" | "iso-4017-m4x25" | "iso-4017-m4x30" | "iso-4017-m4x40" | "iso-7045-m2x8" | "iso-7045-m2x10" | "iso-7045-m2x12" | "iso-7045-m2x16" | "iso-7045-m2-5x8" | "iso-7045-m2-5x10" | "iso-7045-m2-5x12" | "iso-7045-m2-5x16" | "iso-7045-m2-5x20" | "iso-7045-m3x8" | "iso-7045-m3x10" | "iso-7045-m3x12" | "iso-7045-m3x16" | "iso-7045-m3x20" | "iso-7045-m3x25" | "iso-7045-m3x30" | "iso-7045-m4x8" | "iso-7045-m4x10" | "iso-7045-m4x12" | "iso-7045-m4x16" | "iso-7045-m4x20" | "iso-7045-m4x25" | "iso-7045-m4x30" | "iso-7045-m4x40" | "iso-7046-m2x8" | "iso-7046-m2x10" | "iso-7046-m2x12" | "iso-7046-m2x16" | "iso-7046-m2x20" | "iso-7046-m2-5x8" | "iso-7046-m2-5x10" | "iso-7046-m2-5x12" | "iso-7046-m2-5x16" | "iso-7046-m2-5x20" | "iso-7046-m2-5x25" | "iso-7046-m3x8" | "iso-7046-m3x10" | "iso-7046-m3x12" | "iso-7046-m3x16" | "iso-7046-m3x20" | "iso-7046-m3x25" | "iso-7046-m3x30" | "iso-7046-m4x8" | "iso-7046-m4x10" | "iso-7046-m4x12" | "iso-7046-m4x16" | "iso-7046-m4x20" | "iso-7046-m4x25" | "iso-7046-m4x30" | "iso-7046-m4x40" | "iso-7046-m5x8" | "iso-7046-m5x10" | "iso-7046-m5x12" | "iso-7046-m5x16" | "iso-7046-m5x20" | "iso-7046-m5x25" | "iso-7046-m5x30" | "iso-7046-m5x40" | "iso-7046-m5x50";
                        /**
                         * Hole fit
                         * @description How much play the screws have in their holes: the DIN EN 20273 series for machine screws, and the same allowances (0.3 / 0.5 / 0.8 mm) over a wood screw’s diameter.
                         * @default medium
                         * @enum {unknown}
                         */
                        holeFit: "fine" | "medium" | "coarse";
                        /**
                         * Loose pivots
                         * @description Print the original’s high-tolerance lever: a 5.14 mm pivot hole instead of 4.99 mm on the base’s 4.4 mm pins, and 4.41 mm link pins instead of 4.64 mm in the link’s 5 mm holes. For printers whose holes come out tight.
                         * @default false
                         */
                        highTolerance: boolean;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "outside-corner-toggle-latch";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Outside-corner toggle latch parameters, for two equal-thickness wooden planks. All fields are required; dimensions in mm. */
                    parameters: {
                        /**
                         * Plank thickness
                         * @description Thickness of each of the two equal-thickness planks in a 90° butt joint, in mm. Moves the screw row beyond the joint and checks that the screw tips stay inside the wood.
                         * @default 18
                         */
                        plankThickness: number;
                        /**
                         * Screw setback
                         * @description Screw-centre distance beyond the butt joint, in mm. The mounting feet grow with this distance. Pre-drill for your timber; this layout allowance is not a structural edge-distance specification.
                         * @default 18
                         */
                        edgeDistance: number;
                        /**
                         * Wood screw diameter
                         * @description The wood screws’ diameter; the screws below are those of this diameter.
                         * @default 4 mm
                         * @enum {unknown}
                         */
                        woodScrewDiameter: "3 mm" | "3.5 mm" | "4 mm" | "4.5 mm" | "5 mm";
                        /**
                         * Wood screw
                         * @description Four countersunk DIN 7997 wood screws, two per plank, driven normal to its broad face. Length includes the head; the 4 mm printed feet leave the remaining length in the wood.
                         * @default din-7997-4x20
                         * @enum {unknown}
                         */
                        woodScrew: "din-7997-3x12" | "din-7997-3x16" | "din-7997-3x20" | "din-7997-3x25" | "din-7997-3x30" | "din-7997-3-5x16" | "din-7997-3-5x20" | "din-7997-3-5x25" | "din-7997-3-5x30" | "din-7997-3-5x35" | "din-7997-3-5x40" | "din-7997-4x20" | "din-7997-4x25" | "din-7997-4x30" | "din-7997-4x35" | "din-7997-4x40" | "din-7997-4-5x25" | "din-7997-4-5x30" | "din-7997-4-5x35" | "din-7997-4-5x40" | "din-7997-5x30" | "din-7997-5x35" | "din-7997-5x40";
                        /**
                         * Hole fit
                         * @description How much play the screws have in their holes: the DIN EN 20273 series for machine screws, and the same allowances (0.3 / 0.5 / 0.8 mm) over a wood screw’s diameter.
                         * @default medium
                         * @enum {unknown}
                         */
                        holeFit: "fine" | "medium" | "coarse";
                        /**
                         * Loose pivots
                         * @description Print the original’s high-tolerance lever: a 5.14 mm pivot hole instead of 4.99 mm on the base’s 4.4 mm pins, and 4.41 mm link pins instead of 4.64 mm in the link’s 5 mm holes. For printers whose holes come out tight.
                         * @default false
                         */
                        highTolerance: boolean;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "pressure-pad";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Pressure pad parameters. All fields are required; dimensions are in millimetres; the nut and screw are parts-library ids. */
                    parameters: {
                        /**
                         * Pad
                         * @description What the pad holds: a nut that turns freely in it (a thrust pad for a clamp) or a screw head locked in it (a foot).
                         * @default foot
                         * @enum {unknown}
                         */
                        padType: "thrust" | "foot";
                        /**
                         * Diameter
                         * @description Outside diameter of the pad in mm. A larger pad presses more gently.
                         * @default 32
                         */
                        diameter: number;
                        /**
                         * Height
                         * @description From the pad’s back, against the insert nut or the timber, to its sole, in mm.
                         * @default 24.5
                         */
                        height: number;
                        /**
                         * Sole
                         * @description The pad’s pressing face.
                         * @default grooved
                         * @enum {unknown}
                         */
                        surface: "flat" | "grooved" | "domed";
                        /**
                         * Relief
                         * @description Depth of the grooves, or height of the dome, in mm.
                         * @default 1
                         */
                        relief: number;
                        /**
                         * Extenders
                         * @description Printed sleeves that make the leg longer than one screw: each joins two screws end to end, a nut locked in one end and the next screw’s head in the other. Hollow between them, so the screw below runs on into it as far as the height needs, then a lock nut holds it. 0 for the pad alone.
                         * @default 1
                         */
                        extenders: number;
                        /**
                         * Extender length
                         * @description Each extender’s length, end to end, in mm. The longer, the more the height can be set at each joint.
                         * @default 40
                         */
                        extenderLength: number;
                        /**
                         * Thread
                         * @description The screw’s thread; the nuts and screws below are those of this thread.
                         * @default M8
                         * @enum {unknown}
                         */
                        thread: "M4" | "M5" | "M6" | "M8";
                        /**
                         * Nut
                         * @description The nut the thrust pad’s chamber is sized for, run onto the screw’s tip; the nut locked in each extender, and the lock nut jammed against it.
                         * @default iso-10511-m8
                         * @enum {unknown}
                         */
                        nut: "iso-10511-m4" | "iso-10511-m5" | "iso-10511-m6" | "iso-10511-m8" | "iso-4032-m4" | "iso-4032-m5" | "iso-4032-m6" | "iso-4032-m8";
                        /**
                         * Screw
                         * @description The hexagon head screw the foot’s and the extenders’ head pockets are sized for. Its length does not change the printed parts; it sets the leg’s length in the assembly.
                         * @default iso-4017-m8x50
                         * @enum {unknown}
                         */
                        screw: "iso-4017-m4x8" | "iso-4017-m4x10" | "iso-4017-m4x12" | "iso-4017-m4x16" | "iso-4017-m4x20" | "iso-4017-m4x25" | "iso-4017-m4x30" | "iso-4017-m4x40" | "iso-4017-m5x10" | "iso-4017-m5x12" | "iso-4017-m5x16" | "iso-4017-m5x20" | "iso-4017-m5x25" | "iso-4017-m5x30" | "iso-4017-m5x40" | "iso-4017-m5x50" | "iso-4017-m6x12" | "iso-4017-m6x16" | "iso-4017-m6x20" | "iso-4017-m6x25" | "iso-4017-m6x30" | "iso-4017-m6x40" | "iso-4017-m6x50" | "iso-4017-m6x60" | "iso-4017-m8x16" | "iso-4017-m8x20" | "iso-4017-m8x25" | "iso-4017-m8x30" | "iso-4017-m8x40" | "iso-4017-m8x50" | "iso-4017-m8x60" | "iso-4017-m8x80";
                        /**
                         * Fit
                         * @description Play round the nut or head, and round the screw’s shank, on each side, in mm.
                         * @default 0.4
                         */
                        fit: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "window-cat-guard";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Window cat guard parameters. All fields are required; dimensions are in millimetres; the joint fields are parts-library ids or attribute values. */
                    parameters: {
                        /**
                         * Height
                         * @description Height of the side panels: how high the side gap is that they close, from the panel’s tip at the bottom to the window’s top, in mm. Above the longest part they are split into segments.
                         * @default 550
                         */
                        height: number;
                        /**
                         * Gap at the top
                         * @description Width of the side gap at the top of the tilted window, frame to sash, in mm: the side panels’ top width and the top strip’s depth.
                         * @default 105
                         */
                        gap: number;
                        /**
                         * Width at the bottom
                         * @description Width of the side panels at their bottom, in mm. The gap tapers to nothing at the hinge; the panel stops where it is this wide.
                         * @default 10
                         */
                        tipWidth: number;
                        /**
                         * Window width
                         * @description Width of the window opening, in mm: from the left side panel’s outer face to the right one’s. The top strip spans it between the side panels’ bosses.
                         * @default 900
                         */
                        width: number;
                        /**
                         * Longest part
                         * @description A side panel or the top strip longer than this is split into equal segments that dovetail together, so that every part fits your print bed, in mm.
                         * @default 210
                         */
                        maxPartLength: number;
                        /**
                         * Top strip
                         * @description A strip across the gap at the top of the window, its pins plugged into bosses on the side panels: the guard becomes one frame that stands in the window. Off: two side panels on their own, without bosses.
                         * @default true
                         */
                        topStrip: boolean;
                        /**
                         * Segment joints
                         * @description What holds the segments of a panel together. The dovetails keep them side by side but lift out the way they went in; a splice bar screwed over every joint holds them for good.
                         * @default nut-bolt
                         * @enum {unknown}
                         */
                        segmentJoints: "nut-bolt" | "threaded-insert" | "glue";
                        /**
                         * Screw thread
                         * @description The thread of the splice bars’ screws and their nuts or inserts.
                         * @default M3
                         * @enum {unknown}
                         */
                        jointThread: "M2" | "M2.5" | "M3" | "M4";
                        /**
                         * Threaded inserts
                         * @description The heat-set inserts, a real product from the parts library: each hole is sized from the maker’s recommendation, from the spine’s top.
                         * @default cnc-kitchen-m3x5-7
                         * @enum {unknown}
                         */
                        jointInsert: "cnc-kitchen-m2x3" | "cnc-kitchen-m2-5x4" | "cnc-kitchen-m3x5-7" | "cnc-kitchen-m3x3" | "cnc-kitchen-m3x5x4" | "cnc-kitchen-m4x8-1" | "cnc-kitchen-m4x4" | "ruthex-rx-m2x4" | "ruthex-rx-m3x5-7" | "ruthex-rx-m4x8-1";
                        /**
                         * Nuts
                         * @description The nuts, standard parts from the parts library: each pocket, from the plate’s back, is cut to the nut’s greatest size and sits where the screw ends.
                         * @default iso-4032-m3
                         * @enum {unknown}
                         */
                        jointNut: "iso-4032-m2" | "iso-4032-m2-5" | "iso-4032-m3" | "iso-4032-m4" | "iso-4035-m2" | "iso-4035-m2-5" | "iso-4035-m3" | "iso-4035-m4" | "iso-10511-m3" | "iso-10511-m4" | "din-562-m2" | "din-562-m2-5" | "din-562-m3";
                        /**
                         * Screws
                         * @description The countersunk screws, standard parts from the parts library, two per splice bar: their heads sit flush in the bar. A screw must reach through its nut, or as deep as its insert, without coming out of the plate’s back.
                         * @default iso-10642-m3x10
                         * @enum {unknown}
                         */
                        jointScrew: "iso-10642-m3x8" | "iso-10642-m3x10" | "iso-10642-m3x12" | "iso-10642-m3x16" | "iso-10642-m3x20" | "iso-10642-m4x8" | "iso-10642-m4x10" | "iso-10642-m4x12" | "iso-10642-m4x16" | "iso-10642-m4x20" | "iso-7046-m2x5" | "iso-7046-m2x6" | "iso-7046-m2x8" | "iso-7046-m2x10" | "iso-7046-m2x12" | "iso-7046-m2x16" | "iso-7046-m2x20" | "iso-7046-m2-5x5" | "iso-7046-m2-5x6" | "iso-7046-m2-5x8" | "iso-7046-m2-5x10" | "iso-7046-m2-5x12" | "iso-7046-m2-5x16" | "iso-7046-m2-5x20" | "iso-7046-m3x5" | "iso-7046-m3x6" | "iso-7046-m3x8" | "iso-7046-m3x10" | "iso-7046-m3x12" | "iso-7046-m3x16" | "iso-7046-m3x20" | "iso-7046-m4x5" | "iso-7046-m4x6" | "iso-7046-m4x8" | "iso-7046-m4x10" | "iso-7046-m4x12" | "iso-7046-m4x16" | "iso-7046-m4x20";
                        /**
                         * Plate thickness
                         * @description Thickness of the honeycomb plates, in mm.
                         * @default 4
                         */
                        thickness: number;
                        /**
                         * Rib height
                         * @description How high the side panels’ spine and the strip’s ribs stand on the plate, in mm. They stiffen the panels and hold the joints flush.
                         * @default 5
                         */
                        ribHeight: number;
                        /**
                         * Honeycomb holes
                         * @description Size of the hexagonal holes, corner to corner, in mm (across flats: 0.87 ×). At most 40 mm, which a paw does not get through; 0 for solid plates.
                         * @default 30
                         */
                        cell: number;
                        /**
                         * Web
                         * @description Width of the bars between the holes, in mm.
                         * @default 4
                         */
                        web: number;
                        /**
                         * Border
                         * @description Solid border round every plate, in mm.
                         * @default 6
                         */
                        border: number;
                        /**
                         * Clearance
                         * @description Gap per side between parts that fit together, in mm: round each dovetail’s tab in its notch, between the segments’ ends, and round the strip’s pins in the side panels’ bosses. Smaller is tighter and wobbles less; raise it if your printer prints parts that are too tight to go together.
                         * @default 0.1
                         */
                        fit: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "qr-magnet-tag";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Magnetic QR code tag parameters. All fields are required; dimensions are in millimetres. */
                    parameters: {
                        /**
                         * QR code text
                         * @description What the code holds, e.g. a web address: up to 200 characters of printable ASCII (letters, digits, spaces and punctuation, no accents). The longer it is, the smaller the modules.
                         * @default https://example.com
                         */
                        qrText: string;
                        /**
                         * Error correction
                         * @description How much of the code may be damaged or covered and still scan. Higher makes a larger code (smaller modules). A logo needs Q or H.
                         * @default H
                         * @enum {unknown}
                         */
                        errorCorrection: "L" | "M" | "Q" | "H";
                        /**
                         * Shape
                         * @description The outline of the tile.
                         * @default square
                         * @enum {unknown}
                         */
                        shape: "square" | "round";
                        /**
                         * Size
                         * @description The tile’s outer width (square) or diameter (round), in mm.
                         * @default 60
                         */
                        size: number;
                        /**
                         * Corner radius
                         * @description Radius of the square tile’s outer corners, in mm. The seat’s corners follow it, less the border.
                         * @default 4
                         */
                        cornerRadius: number;
                        /**
                         * Border width
                         * @description The visible ring between the code’s centre piece and the tile’s outer edge, in mm.
                         * @default 6
                         */
                        borderWidth: number;
                        /**
                         * Quiet zone
                         * @description The light margin round the code on the centre piece, in modules. Scanners need at least one; four is the standard.
                         * @default 2
                         */
                        quietZone: number;
                        /**
                         * Logo
                         * @description An SVG file whose filled shapes stand in the middle of the code, raised in the dark filament on a light pad of whole modules. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.
                         * @default
                         */
                        logo: string;
                        /**
                         * Logo size (%)
                         * @description The logo’s width as a share of the code’s width, in %. Its pad may cost the code at most 60 % of the damage its error correction can repair (and cover at most 15 % of it at Q, 25 % at H), and never the corner patterns: the editor says how large it may be.
                         * @default 20
                         */
                        logoSize: number;
                        /**
                         * Base thickness
                         * @description The light base of the centre piece, in mm. Change to the dark filament at its top (rounded up to a layer).
                         * @default 1.6
                         */
                        baseThickness: number;
                        /**
                         * Relief height
                         * @description How high the dark modules and the logo stand on the base, in mm.
                         * @default 0.6
                         */
                        reliefHeight: number;
                        /**
                         * Layer height
                         * @description Your slicer’s layer height, in mm. Used to work out the filament-change height (and to check the relief has at least two dark layers), and with embedded magnets the pause height, which it puts on a layer boundary.
                         * @default 0.2
                         */
                        layerHeight: number;
                        /**
                         * Joint
                         * @description How the centre is held in the border.
                         * @default crush-ribs
                         * @enum {unknown}
                         */
                        joint: "crush-ribs" | "detent" | "twist-lock" | "magnets";
                        /**
                         * Fit
                         * @description Gap per side between the centre and the border’s seat, in mm. Larger is looser; raise it if your printer prints parts too tight.
                         * @default 0.2
                         */
                        fit: number;
                        /**
                         * Magnets
                         * @description The round magnets in the back of the border (and, with the magnet joint, in the seat and the centre). Each is a real product from the parts library; its pockets are cut to its greatest size.
                         * @default supermagnete-s-08-02-n
                         * @enum {unknown}
                         */
                        magnet: "supermagnete-s-04-02-n" | "supermagnete-s-05-01-n" | "supermagnete-s-05-02-n52n" | "supermagnete-s-06-01-n" | "supermagnete-s-06-02-n" | "supermagnete-s-06-03-n" | "supermagnete-s-08-01-n" | "supermagnete-s-08-02-n" | "supermagnete-s-08-03-n" | "supermagnete-s-10-01-n" | "supermagnete-s-10-02-n" | "supermagnete-s-10-03-n" | "supermagnete-s-12-02-n";
                        /**
                         * Magnet mounting
                         * @description Open pockets that the magnets are pressed or glued into after printing, or sealed cavities that they are dropped into when the print pauses.
                         * @default pockets
                         * @enum {unknown}
                         */
                        magnetMount: "pockets" | "embedded";
                        /**
                         * Magnets in the back
                         * @description How many magnets the back holds: two on one diagonal, or four in the corners. The magnet joint uses as many again, twice.
                         * @default 4
                         */
                        magnetCount: number;
                        /**
                         * Module style
                         * @description How the dark modules are drawn. The corner squares stay solid in every style. Styles other than squares need larger modules.
                         * @default square
                         * @enum {unknown}
                         */
                        moduleStyle: "square" | "rounded-blobs" | "rounded-squares" | "dots" | "connected-dots";
                        /**
                         * Nozzle
                         * @description Your printer’s nozzle diameter, in mm. A wider nozzle cannot print small modules or the gaps between them: the smallest module allowed grows with it.
                         * @default 0.4
                         * @enum {unknown}
                         */
                        nozzle: "0.2" | "0.25" | "0.4" | "0.5" | "0.6" | "0.8";
                        /**
                         * Bleed
                         * @description How much wider, per side, your printer prints the dark lines than the slicer plans them, in mm: squish, over-extrusion and the dark colour spreading into the light. It makes the light gaps between dark modules narrower, so a larger bleed needs larger modules. 0.1 mm suits a well-tuned printer; raise it if your prints come out bold.
                         * @default 0.1
                         */
                        bleed: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "printed-corner-bracket";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Printed corner bracket parameters. All fields are required; dimensions are in millimetres; the screw is a parts-library id. */
                    parameters: {
                        /**
                         * Leg A
                         * @description Length of one leg, over the outer corner, in mm: the one along the rail.
                         * @default 100
                         */
                        legA: number;
                        /**
                         * Leg B
                         * @description Length of the other leg, over the outer corner, in mm: the one along the stile.
                         * @default 100
                         */
                        legB: number;
                        /**
                         * Width
                         * @description Width of both legs in mm. On a 40 mm member, 20 mm keeps to its outer half.
                         * @default 20
                         */
                        width: number;
                        /**
                         * Thickness
                         * @description Plate thickness in mm: also how deep it is let into the timber to lie flush.
                         * @default 5
                         */
                        thickness: number;
                        /**
                         * Holes per leg
                         * @description Screw holes along each leg.
                         * @default 3
                         */
                        holesPerLeg: number;
                        /**
                         * Hole layout
                         * @description How each leg’s holes lie across it: staggered either side of its middle line, so that the screws do not line up along the timber’s grain, or in a straight line on it.
                         * @default staggered
                         * @enum {unknown}
                         */
                        holeLayout: "staggered" | "straight";
                        /**
                         * Hole spacing
                         * @description Distance between neighbouring holes on a leg, in mm.
                         * @default 20
                         */
                        holeSpacing: number;
                        /**
                         * First hole
                         * @description Distance from the outer corner, along each leg, to its first hole, in mm. Past the member the other leg lies on, every screw holds the member its leg runs along.
                         * @default 50
                         */
                        firstHole: number;
                        /**
                         * Wood screw diameter
                         * @description The wood screws’ diameter; the screws below are those of this diameter.
                         * @default 4 mm
                         * @enum {unknown}
                         */
                        woodScrewDiameter: "3 mm" | "3.5 mm" | "4 mm" | "4.5 mm" | "5 mm" | "6 mm";
                        /**
                         * Wood screw
                         * @description The countersunk wood screw the holes and countersinks are sized for. Its length does not change the bracket; choose one that bites far enough into the timber.
                         * @default din-7997-4x35
                         * @enum {unknown}
                         */
                        woodScrew: "din-7997-3x12" | "din-7997-3x16" | "din-7997-3x20" | "din-7997-3x25" | "din-7997-3x30" | "din-7997-3-5x16" | "din-7997-3-5x20" | "din-7997-3-5x25" | "din-7997-3-5x30" | "din-7997-3-5x35" | "din-7997-3-5x40" | "din-7997-4x20" | "din-7997-4x25" | "din-7997-4x30" | "din-7997-4x35" | "din-7997-4x40" | "din-7997-4x45" | "din-7997-4x50" | "din-7997-4-5x25" | "din-7997-4-5x30" | "din-7997-4-5x35" | "din-7997-4-5x40" | "din-7997-4-5x45" | "din-7997-4-5x50" | "din-7997-4-5x60" | "din-7997-5x30" | "din-7997-5x35" | "din-7997-5x40" | "din-7997-5x50" | "din-7997-5x60" | "din-7997-5x70" | "din-7997-5x80" | "din-7997-6x40" | "din-7997-6x50" | "din-7997-6x60" | "din-7997-6x70" | "din-7997-6x80" | "din-7997-6x90" | "din-7997-6x100";
                        /**
                         * Hole fit
                         * @description How much play the screws have in their holes: 0.3 / 0.5 / 0.8 mm over the screw’s diameter, DIN EN 20273’s allowances for M4 and M5.
                         * @default medium
                         * @enum {unknown}
                         */
                        holeFit: "fine" | "medium" | "coarse";
                    };
                } | {
                    /** @enum {string} */
                    modelId: "printed-screen-hook";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Printed screen hook parameters. All fields are required; dimensions are in millimetres; the screw is a parts-library id. */
                    parameters: {
                        /**
                         * Frame lip thickness
                         * @description Open the window and measure the fixed frame’s outermost leg, from its outer face to the seal on its back, in mm. The barb reaches behind it.
                         * @default 15.5
                         */
                        frameLip: number;
                        /**
                         * Seal gap
                         * @description From the lip’s back to the closed sash’s face, where the outer seal is, in mm. The barb lies in it, centred, so the sash still closes.
                         * @default 3.5
                         */
                        sealGap: number;
                        /**
                         * Reach behind the lip
                         * @description How far both barbs reach behind the lip once the frame hangs, in mm. The long barb is made longer by what the frame is lifted to hang it.
                         * @default 6
                         */
                        engage: number;
                        /**
                         * Width
                         * @description Width of the strip in mm.
                         * @default 10
                         */
                        width: number;
                        /**
                         * Leg length
                         * @description From the turn’s outer face to the end of the screwed leg, in mm.
                         * @default 40
                         */
                        legLength: number;
                        /**
                         * Leg thickness
                         * @description Of the screwed leg, in mm: it takes the countersunk heads.
                         * @default 4
                         */
                        legThickness: number;
                        /**
                         * Turn thickness
                         * @description Of the turn into the window, in mm.
                         * @default 4
                         */
                        turnThickness: number;
                        /**
                         * Barb thickness
                         * @description Of the barb in the seal gap, in mm: at most the gap less 0.5 mm each side.
                         * @default 2
                         */
                        barbThickness: number;
                        /**
                         * Clearance
                         * @description How far the short hooks’ turns stand off the sill lip’s tip once the frame stands on its feet, in mm, and the long ones’ off the head lip while it is lifted.
                         * @default 1
                         */
                        clearance: number;
                        /**
                         * Screws per hook
                         * @description One screw, just past the turn: eased, the hook turns on it, to set it square to the lip while fitting, or to swing a long hook’s barb down clear of the head lip without unscrewing it. Two hold it square on the stile and cannot turn.
                         * @default 1
                         */
                        screwCount: number;
                        /**
                         * Wood screw diameter
                         * @description The wood screws’ diameter; the screws below are those of this diameter.
                         * @default 3 mm
                         * @enum {unknown}
                         */
                        woodScrewDiameter: "3 mm" | "3.5 mm" | "4 mm" | "4.5 mm" | "5 mm" | "6 mm";
                        /**
                         * Wood screw
                         * @description The countersunk wood screw the leg’s holes are sized for. Its length does not change the hook.
                         * @default din-7997-3x20
                         * @enum {unknown}
                         */
                        woodScrew: "din-7997-3x12" | "din-7997-3x16" | "din-7997-3x20" | "din-7997-3x25" | "din-7997-3x30" | "din-7997-3-5x16" | "din-7997-3-5x20" | "din-7997-3-5x25" | "din-7997-3-5x30" | "din-7997-3-5x35" | "din-7997-3-5x40" | "din-7997-4x20" | "din-7997-4x25" | "din-7997-4x30" | "din-7997-4x35" | "din-7997-4x40" | "din-7997-4x45" | "din-7997-4x50" | "din-7997-4-5x25" | "din-7997-4-5x30" | "din-7997-4-5x35" | "din-7997-4-5x40" | "din-7997-4-5x45" | "din-7997-4-5x50" | "din-7997-4-5x60" | "din-7997-5x30" | "din-7997-5x35" | "din-7997-5x40" | "din-7997-5x50" | "din-7997-5x60" | "din-7997-5x70" | "din-7997-5x80" | "din-7997-6x40" | "din-7997-6x50" | "din-7997-6x60" | "din-7997-6x70" | "din-7997-6x80" | "din-7997-6x90" | "din-7997-6x100";
                        /**
                         * Hole fit
                         * @description How much play the screws have in their holes: 0.3 / 0.5 / 0.8 mm over the screw’s diameter, DIN EN 20273’s allowances for M4 and M5.
                         * @default medium
                         * @enum {unknown}
                         */
                        holeFit: "fine" | "medium" | "coarse";
                    };
                } | {
                    /** @enum {string} */
                    modelId: "spring-ball-detent";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Spring ball detent parameters. All fields are required; dimensions are in millimetres; the ball, spring and set screw are parts-library ids. */
                    parameters: {
                        /**
                         * Body
                         * @description A threaded body that screws into a tapped hole, or a plain one.
                         * @default threaded
                         * @enum {unknown}
                         */
                        body: "threaded" | "plain";
                        /**
                         * Thread
                         * @description The body’s metric thread (ISO 261 coarse pitch), printed on the outside: it screws into a tapped hole of that size.
                         * @default M10
                         * @enum {unknown}
                         */
                        thread: "M6" | "M8" | "M10" | "M12";
                        /**
                         * Body diameter
                         * @description The plain body’s outside diameter, in mm.
                         * @default 10
                         */
                        bodyDiameter: number;
                        /**
                         * Ball
                         * @description The steel ball from the parts library. Its bore is its largest diameter plus the clearance.
                         * @default steel-ball-4-5-g100
                         * @enum {unknown}
                         */
                        ball: "steel-ball-2-5-g100" | "steel-ball-3-g100" | "steel-ball-3-5-g100" | "steel-ball-4-g100" | "steel-ball-4-5-g100" | "steel-ball-5-g100" | "steel-ball-6-g100";
                        /**
                         * Spring
                         * @description The compression spring from the parts library: it must fit the ball’s bore, and its inner diameter must be small enough for the ball to sit on it.
                         * @default gutekunst-d-107
                         * @enum {unknown}
                         */
                        spring: "gutekunst-d-024" | "gutekunst-d-027" | "gutekunst-d-039" | "gutekunst-d-040" | "gutekunst-d-054" | "gutekunst-d-055" | "gutekunst-d-077" | "gutekunst-d-078" | "gutekunst-d-082" | "gutekunst-d-083" | "gutekunst-d-088" | "gutekunst-d-102" | "gutekunst-d-107" | "gutekunst-d-108" | "gutekunst-d-134" | "gutekunst-d-139";
                        /**
                         * Protrusion
                         * @description How far the ball stands out of the nose, in mm. The nose’s lip must still reach over the ball, so a larger ball can stand out further.
                         * @default 0.8
                         */
                        protrusion: number;
                        /**
                         * Travel
                         * @description How far the ball can be pushed in, in mm: at least the protrusion, so that it goes in flush, and no further than the spring allows before it goes solid.
                         * @default 1
                         */
                        travel: number;
                        /**
                         * Retention
                         * @description What keeps the ball and the spring in: a cap or a set screw closing the back, or the spring itself, put in through an opening in the side.
                         * @default press-cap
                         * @enum {unknown}
                         */
                        retention: "press-cap" | "set-screw" | "side-opening";
                        /**
                         * Set screw
                         * @description The flat-point set screw that closes the back and sets the preload. The ball and spring go in through its tap hole.
                         * @default iso-4026-m6x6
                         * @enum {unknown}
                         */
                        setScrew: "iso-4026-m3x3" | "iso-4026-m3x4" | "iso-4026-m3x5" | "iso-4026-m3x6" | "iso-4026-m3x8" | "iso-4026-m3x10" | "iso-4026-m4x4" | "iso-4026-m4x5" | "iso-4026-m4x6" | "iso-4026-m4x8" | "iso-4026-m4x10" | "iso-4026-m4x12" | "iso-4026-m5x5" | "iso-4026-m5x6" | "iso-4026-m5x8" | "iso-4026-m5x10" | "iso-4026-m5x12" | "iso-4026-m6x6" | "iso-4026-m6x8" | "iso-4026-m6x10" | "iso-4026-m6x12" | "iso-4026-m6x16" | "iso-4026-m8x8" | "iso-4026-m8x10" | "iso-4026-m8x12" | "iso-4026-m8x16";
                        /**
                         * Body length
                         * @description From the back face to the nose, in mm, without the ball.
                         * @default 22
                         */
                        bodyLength: number;
                        /**
                         * Tool feature
                         * @description What turns the body: a slot or a hex socket in its back, or none for a plain body.
                         * @default slot
                         * @enum {unknown}
                         */
                        toolFeature: "slot" | "hex" | "none";
                        /**
                         * Clearance
                         * @description Play of the ball in its bore, over its largest diameter, in mm.
                         * @default 0.3
                         */
                        clearance: number;
                        /**
                         * Thread play
                         * @description How much smaller than the nominal the printed thread’s major diameter is, in mm, so that it turns in a tapped hole.
                         * @default 0.2
                         */
                        threadPlay: number;
                        /**
                         * Cap interference
                         * @description How far the press cap’s crush ribs stand out over the bore, across its diameter, in mm.
                         * @default 0.2
                         */
                        capInterference: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "cat-collar-tag";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Cat collar tag parameters. All fields are required; dimensions are in millimetres; the parts are parts-library ids. */
                    parameters: {
                        /**
                         * Attachment
                         * @description How the tag goes on the collar.
                         * @default hanging
                         * @enum {unknown}
                         */
                        attachment: "hanging" | "slide-on" | "clip" | "sleeve";
                        /**
                         * Shape
                         * @description The tag’s outline.
                         * @default round
                         * @enum {unknown}
                         */
                        shape: "round" | "rounded-rectangle" | "bone" | "heart" | "fish";
                        /**
                         * Width
                         * @description The tag’s width (a round tag’s diameter), in mm, without a hanging tag’s bail.
                         * @default 30
                         */
                        width: number;
                        /**
                         * Height
                         * @description The tag’s height, in mm, without a hanging tag’s bail. A round tag is as high as it is wide.
                         * @default 22
                         */
                        height: number;
                        /**
                         * Thickness
                         * @description The tag’s thickness, in mm, without an embossed mark. Embedded magnets or an NFC tag need a minimum, which the editor names.
                         * @default 2.4
                         */
                        thickness: number;
                        /**
                         * Edge rounding
                         * @description How far the front and back edges are rounded, in mm: a soft edge against the cat. At most half the thickness.
                         * @default 0.6
                         */
                        edgeRadius: number;
                        /**
                         * Front
                         * @description What the front carries: text, a logo or nothing.
                         * @default text
                         * @enum {unknown}
                         */
                        frontMark: "none" | "text" | "logo";
                        /**
                         * Front text, line 1
                         * @description The front’s first line, e.g. the cat’s name. Up to 16 characters of printable ASCII (letters, digits, spaces and punctuation, no accents).
                         * @default Luna
                         */
                        frontLine1: string;
                        /**
                         * Front text, line 2
                         * @description An optional second line on the front. Up to 16 characters of printable ASCII (letters, digits, spaces and punctuation, no accents).
                         * @default
                         */
                        frontLine2: string;
                        /**
                         * Front font
                         * @description The front text’s font. All are bold, so that the strokes print cleanly.
                         * @default sans
                         * @enum {unknown}
                         */
                        frontFont: "sans" | "serif" | "mono" | "wide";
                        /**
                         * Front text size
                         * @description Letter height of the front text in mm (the height of a capital). Longer text needs a smaller size.
                         * @default 5.5
                         */
                        frontTextSize: number;
                        /**
                         * Front logo
                         * @description An SVG file whose filled shapes go on the front. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.
                         * @default
                         */
                        frontLogo: string;
                        /**
                         * Front logo size
                         * @description Height of the front logo in mm; a wide logo is made smaller to fit the free width.
                         * @default 10
                         */
                        frontLogoSize: number;
                        /**
                         * Front style
                         * @description Whether the front’s text or logo is carved in or raised.
                         * @default engrave
                         * @enum {unknown}
                         */
                        frontStyle: "engrave" | "emboss";
                        /**
                         * Back
                         * @description What the back carries: text, a logo or nothing. The back lies on the print bed, so its mark is engraved, mirrored to read when the tag is turned over.
                         * @default text
                         * @enum {unknown}
                         */
                        backMark: "none" | "text" | "logo";
                        /**
                         * Back text, line 1
                         * @description The back’s first line. Up to 16 characters of printable ASCII (letters, digits, spaces and punctuation, no accents).
                         * @default If found:
                         */
                        backLine1: string;
                        /**
                         * Back text, line 2
                         * @description The back’s second line, e.g. a phone number. Up to 16 characters of printable ASCII (letters, digits, spaces and punctuation, no accents).
                         * @default 555 0100
                         */
                        backLine2: string;
                        /**
                         * Back font
                         * @description The back text’s font.
                         * @default sans
                         * @enum {unknown}
                         */
                        backFont: "sans" | "serif" | "mono" | "wide";
                        /**
                         * Back text size
                         * @description Letter height of the back text in mm.
                         * @default 3
                         */
                        backTextSize: number;
                        /**
                         * Back logo
                         * @description An SVG file whose filled shapes are engraved in the back. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.
                         * @default
                         */
                        backLogo: string;
                        /**
                         * Back logo size
                         * @description Height of the back logo in mm; a wide logo is made smaller to fit the free width.
                         * @default 10
                         */
                        backLogoSize: number;
                        /**
                         * NFC tag
                         * @description An NFC tag that a phone reads (e.g. a web page with your phone number): none, in a pocket in the back, or embedded at a print pause.
                         * @default none
                         * @enum {unknown}
                         */
                        nfc: "none" | "pocket" | "embedded";
                        /**
                         * NFC tag product
                         * @description The NFC tag, a real product from the parts library; its pocket or cavity is cut to its size.
                         * @default gototags-bgrduhnvrl
                         * @enum {unknown}
                         */
                        nfcTag: "gototags-bgrduhnvrl" | "gototags-gml7cqg3v7" | "gototags-hg5w9byet8" | "gototags-fjz3am6fjz" | "gototags-bzkx3zlhxx" | "core-electronics-ce08496";
                        /**
                         * Magnets
                         * @description Disc magnets, to stick the tag to a fridge or a board when the cat is not wearing it: none, in pockets in the back, or embedded at a print pause. Only one of the NFC tag and the magnets can be embedded.
                         * @default none
                         * @enum {unknown}
                         */
                        magnetMount: "none" | "pocket" | "embedded";
                        /**
                         * Magnet
                         * @description The disc magnet, a real product from the parts library; its pockets are cut to its greatest size.
                         * @default supermagnete-s-06-01-n
                         * @enum {unknown}
                         */
                        magnet: "supermagnete-s-04-02-n" | "supermagnete-s-05-01-n" | "supermagnete-s-05-02-n52n" | "supermagnete-s-06-01-n" | "supermagnete-s-06-02-n" | "supermagnete-s-08-01-n" | "supermagnete-s-08-02-n" | "supermagnete-s-10-01-n" | "supermagnete-s-10-02-n";
                        /**
                         * Magnet count
                         * @description One magnet (in the middle, or beside an NFC tag) or two (at the ends of the free area).
                         * @default 1
                         */
                        magnetCount: number;
                        /**
                         * Split ring
                         * @description The split ring that hangs the tag on the collar, a real product from the parts library. The bail’s hole is sized for its band, and the ring is checked to go round the bail and the D-ring.
                         * @default avco-kr-9335
                         * @enum {unknown}
                         */
                        splitRing: "avco-kr-90920" | "avco-kr-90930" | "avco-kr-92000" | "avco-kr-92100" | "avco-kr-92200" | "avco-kr-9335" | "avco-kr-9337" | "avco-kr-93400";
                        /**
                         * D-ring wire
                         * @description The thickness of the collar’s D-ring or O-ring wire, in mm, which the split ring must hold beside the bail. Makers do not publish it: measure yours.
                         * @default 2
                         */
                        dRingWire: number;
                        /**
                         * Bail wall
                         * @description The wall round the bail’s hole, in mm. Thicker is stronger.
                         * @default 2
                         */
                        bailWall: number;
                        /**
                         * Collar
                         * @description The collar the tag slides onto, a real product from the parts library: the slots are cut for its strap’s width and (estimated) thickness.
                         * @default trixie-4180
                         * @enum {unknown}
                         */
                        collar: "rogz-kiddycat-8mm" | "rogz-kiddycat-11mm" | "rogz-alleycat-11mm" | "coastal-safe-cat-fashion-3-8in" | "trixie-4180" | "lupinepet-original-designs-safety-cat-collar";
                        /**
                         * Slot fit
                         * @description Play of the slots over the strap’s thickness, in mm. Less holds the tag in place more firmly; more slides more easily.
                         * @default 0.3
                         */
                        slotFit: number;
                        /**
                         * End bar width
                         * @description The width of the bar outside each slot, in mm.
                         * @default 3
                         */
                        barWidth: number;
                        /**
                         * Sleeve style
                         * @description A closed sleeve the collar’s end is threaded through, or one that wraps round the strap and clicks shut.
                         * @default closed
                         * @enum {unknown}
                         */
                        sleeveStyle: "closed" | "wrap";
                        /**
                         * Clip or sleeve length
                         * @description How long the clip or sleeve is along the strap, in mm. The split ring goes round its tab, so a long one needs a large ring.
                         * @default 8
                         */
                        carrierLength: number;
                        /**
                         * Clip or sleeve wall
                         * @description The wall round the strap, in mm. Thinner flexes more easily onto the strap.
                         * @default 1.6
                         */
                        carrierWall: number;
                        /**
                         * Clip or sleeve fit
                         * @description Play round the strap per side, in mm: little for a clip, so that it stays put; more for a sleeve, so that it slides along.
                         * @default 0.2
                         */
                        carrierFit: number;
                        /**
                         * Lip depth
                         * @description How far a clip’s lips reach over the strap’s edges (a wrap sleeve’s flaps overlap by as much), in mm. More holds better; less snaps on more easily.
                         * @default 1.2
                         */
                        lipDepth: number;
                        /**
                         * Engraving depth
                         * @description How deep engraved text and logos are carved, in mm.
                         * @default 0.6
                         */
                        engraveDepth: number;
                        /**
                         * Emboss height
                         * @description How high an embossed front stands, in mm.
                         * @default 0.6
                         */
                        embossHeight: number;
                        /**
                         * Layer height
                         * @description Your slicer’s layer height, in mm: the print pause and the filament change are put on a layer boundary.
                         * @default 0.2
                         */
                        layerHeight: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "xiao-sense-camera-housing";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "4";
                    parameters: {
                        /**
                         * Camera board
                         * @description Sense stack without pin headers or an upgraded heatsink.
                         * @default seeed-xiao-esp32s3-sense
                         * @enum {unknown}
                         */
                        board: "seeed-xiao-esp32s3-sense";
                        /**
                         * Housing width
                         * @description Outside width in mm; leave room for the rear mounts.
                         * @default 48
                         */
                        width: number;
                        /**
                         * Housing length
                         * @description Outside length in mm. Heatsinks grow the housing in height, not length.
                         * @default 46
                         */
                        length: number;
                        /**
                         * Rear mounting
                         * @description Blind heat-set inserts or side-loaded captive nuts. The four lid fasteners remain M2 heat-set inserts.
                         * @default heat-set
                         * @enum {unknown}
                         */
                        mountRetention: "heat-set" | "nut";
                        /**
                         * Mounting nuts
                         * @description Slide two nuts into the tray pockets from inside before fitting the camera. Floor and roof capture the nuts; flats prevent rotation.
                         * @default iso-4032-m3
                         * @enum {unknown}
                         */
                        mountNut: "iso-4032-m3" | "iso-4032-m4" | "din-562-m3" | "din-562-m4";
                        /**
                         * Mounting inserts
                         * @description Two blind, rear-facing heat-set inserts for attaching the enclosure to your own bracket.
                         * @default ruthex-rx-m3x5-7
                         * @enum {unknown}
                         */
                        mountInsert: "ruthex-rx-m3x5-7" | "cnc-kitchen-m3x3" | "cnc-kitchen-m4x4" | "ruthex-rx-m4x8-1";
                        /**
                         * Mount spacing
                         * @description Centre distance of the two rear mounting fasteners, in mm.
                         * @default 34
                         */
                        mountSpacing: number;
                        /**
                         * Camera opening
                         * @description Through-hole diameter in mm. Measure your lens and check the field of view before printing.
                         * @default 12
                         */
                        cameraDiameter: number;
                        /**
                         * Camera alignment X
                         * @description Aperture offset from the nominal lens centre, across the board, in mm.
                         * @default 0
                         */
                        cameraOffsetX: number;
                        /**
                         * Camera alignment Y
                         * @description Aperture offset towards the USB end, in mm.
                         * @default 0
                         */
                        cameraOffsetY: number;
                        /**
                         * Antenna exit
                         * @description Split cable opening on the left side, in mm. Lay the pre-connected U.FL lead in before closing.
                         * @default 5
                         */
                        antennaDiameter: number;
                        /**
                         * Battery wire exit
                         * @description Split opening on the right side for wires to the underside BAT pads, in mm. Battery remains external.
                         * @default 4
                         */
                        batteryDiameter: number;
                        /**
                         * Charge LED window
                         * @description A 2.4 mm side sight hole towards the red charge LED; not a light pipe.
                         * @default true
                         */
                        chargeWindow: boolean;
                        /**
                         * Heatsink
                         * @description One adhesive heatsink on the backside thermal pad, away from the camera. Enabled by default. Automatically raises the board, USB and roof to leave space underneath.
                         * @default true
                         */
                        heatsinkEnabled: boolean;
                        /**
                         * Heatsink part
                         * @description Seeed’s XIAO-specific sink or a dimensionally suitable 10 mm alternative. Check electrical isolation and actual fit before bonding.
                         * @default seeed-xiao-aluminium-heatsink
                         * @enum {unknown}
                         */
                        heatsink: "seeed-xiao-aluminium-heatsink" | "same-sky-hsb02-101007";
                        /**
                         * Extra heatsink height
                         * @description Additional clearance above the selected sink height, in mm. Seeed’s unpublished height is estimated at 10 mm: measure yours and increase this allowance if taller.
                         * @default 0
                         */
                        heatsinkAllowance: number;
                        /**
                         * Thermal adhesive thickness
                         * @description Installed adhesive thickness in mm, excluding the sink. Use suitable electrically insulating thermal adhesive; check BAT pad clearance.
                         * @default 0.2
                         */
                        adhesiveThickness: number;
                        /**
                         * Ventilation
                         * @description Passive roof slots and lower side intakes. Keep these open for convection; temperature testing is still required. Indoor only, not waterproof.
                         * @default true
                         */
                        ventilation: boolean;
                        /**
                         * Wall thickness
                         * @description Shell and roof thickness, in mm.
                         * @default 2
                         */
                        wall: number;
                        /**
                         * Under-board clearance
                         * @description Minimum distance from floor to PCB underside. Automatically increased for heatsink height, adhesive and 2 mm fin clearance.
                         * @default 4
                         */
                        standoff: number;
                        /**
                         * Camera headroom
                         * @description Space from the published 15 mm stack envelope to the roof underside.
                         * @default 1.2
                         */
                        headroom: number;
                        /**
                         * Board clearance
                         * @description Lateral play per side in the PCB guides, in mm.
                         * @default 0.3
                         */
                        boardFit: number;
                        /**
                         * Lid seam clearance
                         * @description Gap per side at the alignment rabbet and below the tongue, and vertical gap between tray and hood, in mm. Larger is looser; the tongue locates the hood and the four screws secure it.
                         * @default 0.2
                         */
                        seamFit: number;
                        /**
                         * Alignment overlap
                         * @description Depth of the lid tongue below the tray rim, in mm. The open-sided groove is this deep plus seam clearance; tongue and remaining outer rim are each half the wall thickness.
                         * @default 1.2
                         */
                        seamDepth: number;
                        /**
                         * USB recess
                         * @description Additional distance of the socket behind the inner front wall, in mm. Total recess includes the wall.
                         * @default 2
                         */
                        usbRecess: number;
                        /**
                         * USB plug opening width
                         * @description Clear width for your USB-C cable moulding, in mm.
                         * @default 14
                         */
                        usbWidth: number;
                        /**
                         * USB plug opening height
                         * @description Clear height for your USB-C cable moulding, in mm.
                         * @default 8
                         */
                        usbHeight: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "magnetic-cat-toy";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    parameters: {
                        /**
                         * Toy width
                         * @description Body width, excluding the four external screw ears, in mm.
                         * @default 160
                         */
                        width: number;
                        /**
                         * Toy length
                         * @description Body length in mm.
                         * @default 140
                         */
                        length: number;
                        /**
                         * Grid magnets
                         * @description Sourced axial discs for whichever sockets you choose to populate; exposed and nominally flush until the field is fitted. Socket/rim height follows the selected thickness, with no unused height for thicker magnets.
                         * @default supermagnete-s-10-02-n
                         * @enum {unknown}
                         */
                        gridMagnet: "supermagnete-s-08-01-n" | "supermagnete-s-08-02-n" | "supermagnete-s-10-02-n" | "supermagnete-s-10-03-n" | "supermagnete-s-12-02-n";
                        /**
                         * Ball magnet
                         * @description Two matching sourced discs, one retained in each hollow half. Rear-loaded pockets put thin contacting printed floors between the magnets; small staggered push-out holes do not face each other. Install opposite facing poles; attraction seats each disc against its floor. Magnet thickness only changes the internal pocket, not ball diameter, shell or floor thickness.
                         * @default supermagnete-s-08-01-n
                         * @enum {unknown}
                         */
                        ballMagnet: "supermagnete-s-06-02-n" | "supermagnete-s-06-03-n" | "supermagnete-s-08-01-n" | "supermagnete-s-08-03-n" | "supermagnete-s-10-02-n";
                        /**
                         * Socket spacing
                         * @description Centre-to-centre pitch in both directions, in mm. The centred array fits as many sockets as possible with at least 20 mm from each centre to the outer edge. Choose magnet positions yourself, not a layout preset.
                         * @default 30
                         */
                        socketSpacing: number;
                        /**
                         * Playing field thickness
                         * @description Smooth solid planar sheet; thinner reduces the magnetic gap but may flex. Print solid, smooth face on the bed.
                         * @default 1.2
                         */
                        fieldThickness: number;
                        /**
                         * Ball diameter
                         * @description Outer spherical envelope in mm. Hollow perforated halves close magnetically and remain separable.
                         * @default 36
                         */
                        ballDiameter: number;
                        /**
                         * Ball shell thickness
                         * @description Hollow shell wall in mm. Seven radial grip holes per half; print walls solid.
                         * @default 2
                         */
                        ballShellThickness: number;
                        /**
                         * Ball grip hole diameter
                         * @description Diameter of the fourteen through-holes in mm, including one at each pole. Larger holes improve access and reduce mass; at least 1.2 mm of inner-shell web must remain.
                         * @default 8
                         */
                        ballGripHoleDiameter: number;
                        /**
                         * Ball magnet floor thickness
                         * @description Bearing floor between each magnet and the seam, in mm, with a small staggered push-out hole. The two flat floors touch with no intentional air gap, so face separation is twice this thickness. Solid layers, not sparse infill.
                         * @default 0.6
                         */
                        ballMagnetFloorThickness: number;
                        /**
                         * Ball magnet placement
                         * @description Centred balances the two magnet seats symmetrically about the sphere centre; eccentric shifts both seats radially for a deliberate wobble.
                         * @default centred
                         * @enum {unknown}
                         */
                        magnetPlacement: "centred" | "eccentric";
                        /**
                         * Eccentric offset
                         * @description Radial displacement of both ball magnets from the sphere centre in mm; only used in eccentric mode.
                         * @default 6
                         */
                        eccentricOffset: number;
                        /**
                         * Paw slot width
                         * @description Rounded elongated roof slots in mm. At most 60% of ball diameter; length alone does not retain a sphere.
                         * @default 18
                         */
                        slotWidth: number;
                        /**
                         * Joint clearance
                         * @description Gap per side around non-locking ball alignment pins and cover ear reliefs, following the existing clearance-fit convention.
                         * @default 0.2
                         */
                        clearance: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "esp32-c3-supermini-case";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "4";
                    parameters: {
                        /**
                         * Taller enclosure
                         * @description Add 0.84 mm beneath the PCB so seated pin-header insulators align with the exterior case bottom. Independent of Flush pin headers; disable for the shorter original enclosure.
                         * @default true
                         */
                        tallerEnclosure: boolean;
                        /**
                         * Flush pin headers
                         * @description Widen the base openings so the header insulators pass through the floor and seat against the PCB. Disable for the original narrow slots and external spacers.
                         * @default true
                         */
                        flushHeaders: boolean;
                        /**
                         * LED openings
                         * @description Two 2 mm holes above the red power and blue GPIO8 LEDs. Disable to retain the original closed lid.
                         * @default true
                         */
                        ledHoles: boolean;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "treat-dispenser";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "3";
                    parameters: {
                        /**
                         * Treat length
                         * @description Longest side of the treats, mm. Measure the largest of a bag; the rotor’s pockets are sized from it.
                         * @default 14
                         */
                        treatLength: number;
                        /**
                         * Treat width
                         * @description Middle side of the treats, mm.
                         * @default 9
                         */
                        treatWidth: number;
                        /**
                         * Treat thickness
                         * @description Thinnest side of the treats, mm (the rotor’s pocket reaches its axis whatever it is: the simulation’s treats are this thick).
                         * @default 5
                         */
                        treatThickness: number;
                        /**
                         * Treat corner radius
                         * @description Rounding of the treats’ edges and corners, mm (used by the simulation only).
                         * @default 1.5
                         */
                        treatCornerRadius: number;
                        /**
                         * Pocket clearance
                         * @description Play round a treat in a rotor pocket, mm. More takes bigger treats, and lets two thin ones in.
                         * @default 1
                         */
                        pocketClearance: number;
                        /**
                         * Bottle neck
                         * @description The thread of the bottle that screws into the top. Print the thread coupon first: real bottles vary.
                         * @default pco-1881
                         * @enum {unknown}
                         */
                        bottleNeck: "pco-1881" | "pco-1810";
                        /**
                         * Thread clearance
                         * @description Radial play of the body’s thread on the bottle’s, mm; tune it with the coupon.
                         * @default 0.3
                         */
                        threadClearance: number;
                        /**
                         * Flap magnets
                         * @description Embed two Ø8 × 1 mm N45 disc magnets (supermagnete S-08-01-N) that repel each other: one in the flap’s counterweight, one in the inner body above it. They add to the counterweight’s closing force, the more the further the flap opens. Both prints pause for you to drop a magnet in.
                         * @default false
                         */
                        flapMagnets: boolean;
                        /**
                         * Flap band
                         * @description An office rubber band by size number, stretched across the flap’s arm to hold it shut more firmly the further it opens: hooked into a pair of notches outside the inner body’s side walls (`Band notch`). None: the counterweight alone.
                         * @default none
                         * @enum {unknown}
                         */
                        flapBand: "none" | "12" | "14" | "16" | "30" | "31";
                        /**
                         * Band notch
                         * @description Which pair of notches the band is hooked into, 1 (innermost, softest) to 5 (outermost, firmest). Every band offered works in notch 4.
                         * @default 4
                         */
                        flapBandNotch: number;
                        /**
                         * Bottle diameter
                         * @description Largest diameter of the bottle, mm (0.5 l PET bottles are about 65 mm). Sets the base plate’s size so that a full bottle cannot easily tip the dispenser over.
                         * @default 65
                         */
                        bottleDiameter: number;
                    };
                } | {
                    /** @enum {string} */
                    modelId: "miter-box";
                    /**
                     * @description Version returned by the catalogue. Refresh the catalogue on a version conflict.
                     * @enum {string}
                     */
                    modelVersion: "1";
                    /** @description Adjustable miter box parameters. All fields are required; dimensions are in millimetres; the nuts and the screw are parts-library ids. */
                    parameters: {
                        /**
                         * Widest stock
                         * @description The widest stock the box takes, across the bed from the fence, in mm. Sets the bed’s depth and how far out the guide’s front post stands.
                         * @default 30
                         */
                        stockWidth: number;
                        /**
                         * Tallest stock
                         * @description The tallest stock the box takes, in mm: the fence is this high, the hold-downs clear it and the guide posts stand above it.
                         * @default 30
                         */
                        stockHeight: number;
                        /**
                         * Guide above the stock
                         * @description How far the saw slots reach above the tallest stock, in mm: the saw is guided over this height when it starts a cut. Keep the posts lower than your saw’s blade is deep under its back.
                         * @default 25
                         */
                        guideDepth: number;
                        /**
                         * Post length
                         * @description Each guide post’s length along the saw, in mm; the two posts are about 100 mm apart.
                         * @default 16
                         */
                        guideLength: number;
                        /**
                         * Saw kerf
                         * @description The width of your saw’s cut (across its set teeth), in mm. Measure a test cut: a Japanese pull saw cuts about 0.5 mm, a tenon saw about 1 mm, a mitre saw 1.2 to 1.5 mm.
                         * @default 1.2
                         */
                        bladeKerf: number;
                        /**
                         * Slot clearance
                         * @description Play each side of the saw in its slots, in mm. The slots are the kerf plus twice this wide.
                         * @default 0.15
                         */
                        slotClearance: number;
                        /**
                         * Thread
                         * @description The thread of every screw and nut; the nuts and the clamp screw below are those of this thread.
                         * @default M6
                         * @enum {unknown}
                         */
                        thread: "M5" | "M6";
                        /**
                         * Nut
                         * @description The regular hexagon nut: the hold-downs’ T-nuts, the angle lock’s nut and the base’s nuts.
                         * @default iso-4032-m6
                         * @enum {unknown}
                         */
                        nut: "iso-4032-m5" | "iso-4032-m6";
                        /**
                         * Pad nut
                         * @description The nylon-insert nut run onto each clamp screw’s tip, which turns freely in its thrust pad.
                         * @default iso-10511-m6
                         * @enum {unknown}
                         */
                        padNut: "iso-10511-m5" | "iso-10511-m6";
                        /**
                         * Clamp screw
                         * @description The hexagon head screw of each hold-down (its head locks in the knob). The longer, the lower the stock it reaches.
                         * @default iso-4017-m6x60
                         * @enum {unknown}
                         */
                        clampScrew: "iso-4017-m5x30" | "iso-4017-m5x40" | "iso-4017-m5x50" | "iso-4017-m6x30" | "iso-4017-m6x40" | "iso-4017-m6x50" | "iso-4017-m6x60";
                        /**
                         * Fit
                         * @description Play round the turntable, the arm, nuts and screws, on each side, in mm.
                         * @default 0.3
                         */
                        fit: number;
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
                                /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                                meshRepairs?: number;
                            }[];
                            /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                            meshRepairs?: number;
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
                            /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                            detail?: string;
                            /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                            reference?: string;
                            /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                            retryable?: boolean;
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
                                /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                                meshRepairs?: number;
                            }[];
                            /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                            meshRepairs?: number;
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
                            /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                            detail?: string;
                            /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                            reference?: string;
                            /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                            retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                                /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                                meshRepairs?: number;
                            }[];
                            /** @description Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none. */
                            meshRepairs?: number;
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
                            /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                            detail?: string;
                            /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                            reference?: string;
                            /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                            retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
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
                        /** @description Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator's output). */
                        detail?: string;
                        /** @description Identifier to quote when reporting the fault (a failed render: its job id). */
                        reference?: string;
                        /** @description Whether the same request may succeed on another attempt. False for defects that the same settings hit again. */
                        retryable?: boolean;
                    };
                };
            };
        };
    };
}
