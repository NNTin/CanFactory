import type { Dimension, PartSource } from './schema.ts';

/** The day the web sources below were read. Re-read a source and update its `accessed` date when correcting a value from it. */
const ACCESSED = '2026-09-27';
const CATIO_ACCESSED = '2026-10-02';
const DETENT_ACCESSED = '2026-10-07';
const COLLAR_ACCESSED = '2026-10-07';
const BOARD_ACCESSED = '2026-10-09';

const iso = (number: string, title: string): PartSource => ({
  id: `iso-${number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title: `ISO ${number}: ${title}`, publisher: 'ISO',
  url: `https://www.iso.org/search.html?q=ISO%20${encodeURIComponent(number)}`, kind: 'standard', accessed: ACCESSED,
});
const din = (number: string, title: string): PartSource => ({
  id: `din-${number}`, title: `DIN ${number}: ${title}`, publisher: 'DIN', url: `https://www.dinmedia.de/en/search?query=DIN%20${number}`, kind: 'standard', accessed: ACCESSED,
});
/** fasteners.eu publishes each standard's dimension table; the values of the standard parts were read there. */
const fastenersEu = (standard: string, path: string): PartSource => ({
  id: `fasteners-eu-${standard}`, title: `${standard.toUpperCase().replace('-', ' ')} dimension table`, publisher: 'fasteners.eu',
  url: `https://www.fasteners.eu/standards/${path}/`, kind: 'reference', accessed: ACCESSED,
});

/** Every source of the parts library, by id. Parts and dimensions refer to these ids; a test checks that each one exists. */
export const PART_SOURCES: readonly PartSource[] = [
  { id: 'sunon-dc-fan-catalogue', title: 'DC fan catalogue: 30 × 30 × 10 mm (2024)', publisher: 'SUNON', kind: 'manufacturer', accessed: '2026-10-10',
    url: 'https://www.sunon.com/eu/MANAGE/Docs/WEBCONT/Files/1236/DC_20240630%28255-E%29_web.pdf' },
  { id: 'noctua-nf-a4x10-5v-pwm', title: 'NF-A4x10 5V PWM: extended specifications', publisher: 'Noctua', kind: 'manufacturer', accessed: '2026-10-10',
    url: 'https://www.noctua.at/en/products/nf-a4x10-5v-pwm/specifications' },
  iso('261', 'ISO general purpose metric screw threads — General plan'),
  iso('286-2', 'Geometrical product specifications — ISO code system for tolerances on linear sizes — Part 2: Tables of standard tolerance classes and limit deviations'),
  iso('4762', 'Hexagon socket head cap screws'),
  iso('7380-1', 'Button head screws — Part 1: Hexagon socket button head screws'),
  iso('10642', 'Hexagon socket countersunk head screws'),
  iso('4017', 'Fasteners — Hexagon head screws — Product grades A and B'),
  iso('7045', 'Pan head screws with type H or type Z cross recess — Product grade A'),
  iso('7046-1', 'Countersunk flat head screws (common head style) with type H or type Z cross recess — Product grade A — Part 1: Steel screws of property class 4.8'),
  iso('4032', 'Hexagon regular nuts (style 1)'),
  iso('4035', 'Hexagon thin nuts chamfered (style 0)'),
  iso('10511', 'Prevailing torque type hexagon thin nuts (with non-metallic insert)'),
  din('562', 'Square thin nuts; product grade B'),
  din('557', 'Square nuts; product grade C'),
  iso('7089', 'Plain washers — Normal series — Product grade A'),
  iso('7090', 'Plain washers, chamfered — Normal series — Product grade A'),
  iso('7093-1', 'Plain washers — Large series — Part 1: Product grade A'),
  iso('8734', 'Parallel pins, of hardened steel and martensitic stainless steel (Dowel pins)'),
  iso('2338', 'Parallel pins, of unhardened steel and austenitic stainless steel'),
  iso('15', 'Rolling bearings — Radial bearings — Boundary dimensions, general plan'),
  iso('273', 'Fasteners — Clearance holes for bolts and screws'),
  fastenersEu('iso-4762', 'ISO/4762'),
  fastenersEu('iso-7380', 'ISO/7380'),
  fastenersEu('iso-10642', 'ISO/10642'),
  fastenersEu('iso-4017', 'ISO/4017'),
  fastenersEu('iso-7045', 'ISO/7045'),
  { id: 'fasteners-eu-iso-7046', title: 'ISO 7046 dimension table', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/ISO/7046/', kind: 'reference', accessed: '2026-09-29' },
  fastenersEu('iso-4032', 'ISO/4032'),
  fastenersEu('iso-4035', 'ISO/4035'),
  fastenersEu('iso-10511', 'ISO/10511'),
  fastenersEu('din-562', 'DIN/562'),
  fastenersEu('din-557', 'DIN/557'),
  fastenersEu('iso-7089', 'ISO/7089'),
  fastenersEu('iso-7090', 'ISO/7090'),
  fastenersEu('iso-7093', 'ISO/7093'),
  fastenersEu('iso-8734', 'ISO/8734'),
  fastenersEu('iso-2338', 'ISO/2338'),
  { id: 'globalfastener-din-562', title: 'DIN 562 (2013) dimension table', publisher: 'globalfastener.com', url: 'https://www.globalfastener.com/standards/detail_5299.html', kind: 'reference', accessed: ACCESSED },
  { id: 'igus-ball-bearing-table', title: 'Ball bearing table: sizes and dimensions (DIN 625)', publisher: 'igus', url: 'https://www.igus.eu/ball-bearings/wiki/ball-bearings-dimensions-table', kind: 'reference', accessed: ACCESSED },
  { id: 'supermagnete', title: 'supermagnete product data sheets (technical data of each article)', publisher: 'supermagnete (Webcraft GmbH)', url: 'https://www.supermagnete.de/eng/', kind: 'manufacturer', accessed: ACCESSED },
  { id: 'cnc-kitchen-inserts', title: 'CNC Kitchen heat set inserts: Dimensions & Design Guidelines, metric size inserts', publisher: 'CNC Kitchen', url: 'https://cnckitchen.store/products/heat-set-insert-m3-x-5-7-100-pieces', kind: 'manufacturer', accessed: ACCESSED },
  { id: 'ruthex-inserts', title: 'ruthex threaded inserts: dimension drawing on each product’s packaging image', publisher: 'ruthex', url: 'https://www.ruthex.de/en/collections/gewindeeinsatze', kind: 'manufacturer', accessed: ACCESSED },
  // Window catio hardware (the window insert's joints and clamps), read 2026-10-02.
  { ...din('7997', 'Cross recessed countersunk (flat) head wood screws'), accessed: CATIO_ACCESSED },
  { id: 'fasteners-eu-din-7997', title: 'DIN 7997 dimension table', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/DIN/7997/', kind: 'reference', accessed: CATIO_ACCESSED },
  { ...din('7965', 'Screwed inserts (insert nuts) for wood'), accessed: CATIO_ACCESSED },
  { id: 'fasteners-eu-din-7965', title: 'DIN 7965 dimension table and drawing', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/DIN/7965/', kind: 'reference', accessed: CATIO_ACCESSED },
  { ...din('1159', 'Staples (U-shaped wire nails, “Schlaufen/Krampen”)'), accessed: CATIO_ACCESSED },
  { id: 'kk-din-1159', title: 'DIN 1159, Schlaufen (Krampen): sizes d × l', publisher: 'Keller & Kalmbach', url: 'https://www.kk-shop.com/shop/kataloge/de_DE/52/articles/din-1159-schlaufen-krampen-/1759/1759.php', kind: 'reference', accessed: CATIO_ACCESSED },
  { id: 'ganter-gn-343-2', title: 'GN 343.2 Leveling Feet, Steel, with Threaded Stud: table, technical drawing and specification', publisher: 'Otto Ganter GmbH & Co. KG', url: 'https://www.ganternorm.com/en/products/3.4-Installing-lifting-dampening-with-levelling-feet-lifting-gear-and-rubber-elements/Levelling-feet/GN-343.2-Leveling-Feet-Steel-with-Threaded-Stud', kind: 'manufacturer', accessed: CATIO_ACCESSED },
  // The catio's insert–tunnel coupling, read 2026-10-02.
  { id: 'ganter-gn-831', title: 'GN 831 Toggle latches, Steel / Stainless Steel: table, technical drawing and specification', publisher: 'Otto Ganter GmbH & Co. KG', url: 'https://www.ganternorm.com/en/products/2.4-Tensioning-with-clamping-mechanisms/Toggle-latches/GN-831-Toggle-latches-Steel-Stainless-Steel', kind: 'manufacturer', accessed: CATIO_ACCESSED },
  // The catio's window insert hung on the window frame (insect screen hooks), read 2026-10-06.
  { id: 'windhager-03651', title: 'Einhängefeder Montageset 03651 (IS EH-Feder Montageset 5-35mm): product page, for frame lips of 5–35 mm', publisher: 'Windhager Handelsgesellschaft m.b.H.', url: 'https://www.windhager.eu/de/Produkte/Einhaengefeder-Montageset_a_85263', kind: 'manufacturer', accessed: '2026-10-06' },
  { id: 'windhager-qa468', title: 'Windhager assembly instructions QA468 (Spannrahmen Fenster PLUS and Einhängefedern 03651): hook tips 15 and 7 mm, bent at X + 3 mm', publisher: 'Windhager Handelsgesellschaft m.b.H. (published with the product on Amazon)', url: 'https://m.media-amazon.com/images/I/B1hRF8UnnqL.pdf', kind: 'manufacturer', accessed: '2026-10-06' },
  { id: 'hornbach-windhager-03651', title: 'Insektenschutz Windhager Einhängefeder Montageset 5-35 mm (EAN 9003117036512): stainless steel, 4 pieces', publisher: 'HORNBACH', url: 'https://www.hornbach.de/p/insektenschutz-windhager-einhaengefeder-montageset-5-35-mm-4-stueck/6830362/', kind: 'reference', accessed: '2026-10-06' },
  { id: 'canfactory-screen-hook-estimate', title: 'Estimated from the drawings of Windhager’s instructions QA468, scaled by the dimensioned 15 and 7 mm tips (docs/concepts/catio/window-insert.md)', publisher: 'CanFactory', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/concepts/catio/window-insert.md', kind: 'reference', accessed: '2026-10-06' },
  // The window insert's collar corners (flat corner brackets), read 2026-10-06.
  { id: 'alberts-stuhlwinkel', title: 'Stuhlwinkel: each article’s sizes a × b × c, Materialstärke and Anzahl x Loch-Ø', publisher: 'Gust. Alberts GmbH & Co. KG (GAH Alberts)', url: 'https://www.alberts.de/produkte/eisenwaren/holzverbinder/stuhlwinkel/', kind: 'manufacturer', accessed: '2026-10-06' },
  { id: 'simpson-l-pb', title: 'L-PB L-Flachverbinder, technical data sheet: A, B, C, t, holes', publisher: 'Simpson Strong-Tie GmbH', url: 'https://pim.strongtie.eu/api/v1/public/download/de/de/product/1645/L-PB.pdf', kind: 'manufacturer', accessed: '2026-10-06' },
  // The spring ball detent's ball, spring and set screw, read 2026-10-07.
  { ...iso('3290-1', 'Rolling bearings — Balls — Part 1: Steel balls'), accessed: DETENT_ACCESSED },
  { ...din('5401', 'Rolling bearings — Balls for rolling bearings and general industrial use'), accessed: DETENT_ACCESSED },
  { id: 'kugel-pompel-din-5401', title: 'Data sheet: dimensional/shape accuracy and roughness, DIN 5401:2002-08 (V1.03): each grade’s boundary dimensions', publisher: 'Kugel Pompel GmbH', url: 'https://www.kugelpompel.at/img/cms/Downloads/Datenbl%C3%A4tter%20Normen/Data%20sheet%20Dimensional%20shape%20accuracy%20and%20roughness%20DIN%205401%20V1-03.pdf', kind: 'reference', accessed: DETENT_ACCESSED },
  { id: 'gutekunst-compression-springs', title: 'Compression springs: each article’s data (d, De, L0, Ln, Lndyn, R, Fn, n, tolerances)', publisher: 'Gutekunst + Co. KG Federnfabriken (federnshop.com)', url: 'https://www.federnshop.com/en/products/compression_springs.html', kind: 'manufacturer', accessed: DETENT_ACCESSED },
  { id: 'din-en-13906-1', title: 'DIN EN 13906-1: Cylindrical helical springs made from round wire and bar — Calculation and design — Part 1: Compression springs', publisher: 'DIN', url: 'https://www.dinmedia.de/en/search?query=DIN%20EN%2013906-1', kind: 'standard', accessed: DETENT_ACCESSED },
  { ...iso('4026', 'Hexagon socket set screws with flat point'), accessed: DETENT_ACCESSED },
  { id: 'fasteners-eu-iso-4026', title: 'ISO 4026 dimension table', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/ISO/4026/', kind: 'reference', accessed: DETENT_ACCESSED },
  // The cat collar tag's hardware: split rings, NFC tags and the collars it is sized for, read 2026-10-07.
  { id: 'keyring-com-split-rings', title: 'Split key rings (Avco, made in the USA): each article’s “Actual Key Ring Dimensions” (outside and inside diameter, A and B dimension, wire diameter)', publisher: 'keyring.com', url: 'https://keyring.com/shop-by-category/plain-key-rings/', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'keyring-com-split-ring-chart', title: 'USA Made Split Key Rings – Size Chart (Avco #92000–#92975, outside and inside diameters, actual size)', publisher: 'keyring.com (© AKN 2011)', url: 'https://keyring.com/content/USA-Made-Split-Keyrings-Size-Comparison.pdf', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'nxp-ntag213-215-216', title: 'NTAG213/215/216, NFC Forum Type 2 Tag compliant IC with 144/504/888 bytes user memory, product data sheet, Rev. 3.2 (2 June 2015)', publisher: 'NXP Semiconductors', url: 'https://www.nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'gototags-nfc', title: 'GoToTags NFC inlays and stickers: each article’s Dimensions, Antenna Dimensions, chip and NFC memory', publisher: 'GoToTags', url: 'https://store.gototags.com/', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'core-electronics-ce08496', title: 'RFID/NFC Tag 25mm Coin (NTAG213 Chip, 13.56MHz), CE08496: “Dimensions: 0.9 x 25mm Diameter”', publisher: 'Core Electronics', url: 'https://core-electronics.com.au/ntag213-coin-25mm-white.html', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'lupinepet-safety-cat-collar', title: 'Original Designs Safety Cat Collar: 1/2" wide, adjusts from 8" to 12", YKK breakaway buckle (approx. 5 lbs), steel D-ring', publisher: 'LupinePet', url: 'https://www.lupinepet.com/products/original-designs-safety-cat-collar', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'rogz-cat-collars', title: 'Rogz KiddyCat and AlleyCat Safety Release Collars: Safeloc break-away buckle with three load settings, D-ring', publisher: 'Rogz', url: 'https://rogz.com/products/catz/cat-collars/', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'vetnpetdirect-rogz', title: 'Rogz KiddyCat (8mm width, neck 165–230mm; 11mm width, neck 255–310mm) and AlleyCat (Width 11mm, neck 20–31cm) Safety Release Cat Collars', publisher: 'Vet-n-Pet DIRECT', url: 'https://www.vetnpetdirect.com.au/products/rogz-kiddycat-safeloc-cat-collar', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'reberranch-coastal-safe-cat', title: 'Coastal Pet Products Safe Cat Fashion Adjustable Breakaway Collar: 3/8" × 8"–12", breakaway buckle', publisher: 'Reber Ranch', url: 'https://reberranch.com/collections/pet-collars/products/coastal-pet-product-safe-cat-fashion-adjustable-breakaway-collar', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'trixie-4180', title: 'TRIXIE Cat Collar with Address Tag, item no. 4180: continuously adjustable webbing tape', publisher: 'TRIXIE Heimtierbedarf GmbH & Co. KG', url: 'https://www.trixie.de/en/productworld/cat/transport-travel/cat-harnesses-collars/cat-collar-with-address-tag-1001435869-1001449753?itemNo=4180', kind: 'manufacturer', accessed: COLLAR_ACCESSED },
  { id: 'zooplus-trixie-4180', title: 'Trixie Cat Collar with Address Tag – 22cm: “Width: 10mm”, nylon, Snap & Easy safety fastening', publisher: 'zooplus', url: 'https://www.zooplus.co.uk/shop/cats/cat_carriers_travel/collars/multi_coloured/153169', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'fox-valley-webbing', title: 'Nylon webbing specs: thickness of each width (3/8": 1.18 mm; 5/8" to 1 1/2": 1.80 mm)', publisher: 'Fox Valley Dog Collars', url: 'https://foxvalleydogcollars.com/pages/webbing-specs', kind: 'reference', accessed: COLLAR_ACCESSED },
  { id: 'bic-graphic-j25', title: 'BIC J25 lighter (product 3460002360): 62 × 22 × 11 mm', publisher: 'BIC Graphic', url: 'https://www.bicgraphic.com/gb/bic-j25-lighter-3460002360.html', kind: 'manufacturer', accessed: '2026-09-25' },
  { id: '4imprint-j25', title: 'BIC J25 Standard Lighter: 22 × 62 × 11 mm', publisher: '4imprint UK', url: 'https://www.4imprint.co.uk/product/502972/BIC-J25-Standard-Lighter', kind: 'reference', accessed: '2026-09-25' },
  { id: 'wemag-j25', title: 'BIC Mini lighter J25: 22 × 62 × 11 mm', publisher: 'WE MAG', url: 'https://wemag.gr/en/product/bic-mini-lighter-j25-2360/', kind: 'reference', accessed: '2026-09-25' },
  { id: 'canfactory-lighter-estimate', title: 'Estimated from photographs and proportions (docs/cigarette-case-assembly.md, “Reference objects”)', publisher: 'CanFactory', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/cigarette-case-assembly.md#reference-objects', kind: 'reference', accessed: '2026-09-25' },
  { id: 'seeed-xiao-esp32s3-sense', title: 'XIAO ESP32-S3 Sense: specification (21 × 17.8 × 15 mm), camera variants, USB charging, BAT pads and U.FL antenna', publisher: 'Seeed Studio', url: 'https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/', kind: 'manufacturer', accessed: '2026-10-10' },
  { id: 'seeed-xiao-esp32s3-sense-cad', title: 'XIAO ESP32-S3 Sense STEP assembly (2023-05-29): 1.25 mm main PCB; camera and expansion stack', publisher: 'Seeed Studio', url: 'https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/seeed-studio-xiao-esp32s3-sense-3d_model.zip', kind: 'manufacturer', accessed: '2026-10-10' },
  // Development boards (ESP32-C3 SuperMini and ESP32-C3-Zero), read 2026-10-09.
  { id: 'nologo-esp32c3-supermini', title: 'ESP32C3SuperMini 入门 (getting started): 产品参数 22.52 × 18 mm, ESP32C3FN4, single-sided components, blue LED on GPIO8; 引脚图 (pinout), 原理图 (schematic: SMD KEY 3*4*2 2P buttons, SMD 3325 40M crystal, SOT23-5 ME6211, SOD323 BAT60J, 0603 LEDs) and 尺寸图 (to-scale top-view dimension render: 18.00, 15.24 and 22.52 mm)', publisher: 'Nologo (wmnologo)', url: 'https://wiki.nologo.tech/product/esp32/esp32c3/esp32c3supermini/esp32C3SuperMini.html', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'waveshare-esp32-c3-zero', title: 'ESP32-C3-Zero wiki: dimension drawing (18.00 × 23.50 mm, R1.00, 2.54 pitch, 1.59, 1.38 and 4.67 mm), onboard components, schematic', publisher: 'Waveshare Electronics', url: 'https://www.waveshare.com/wiki/ESP32-C3-Zero', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'waveshare-esp32-c3-zero-product', title: 'ESP32-C3-Zero product page: pinout (pins 1–18), onboard resources, US$3.49 (ESP32-C3-Zero-M with headers US$4.49)', publisher: 'Waveshare Electronics', url: 'https://www.waveshare.com/esp32-c3-zero.htm', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'xinglight-xl-0807rgbc-ws2812b', title: 'XL-0807RGBC-WS2812B data sheet: appearance dimension (L/W/H) 2.0 × 1.8 × 0.8 mm', publisher: 'XINGLIGHT (published by Waveshare with the ESP32-C3-Zero)', url: 'https://files.waveshare.com/wiki/ESP32-C3-Zero/XL-0807RGBC-WS2812B.pdf', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'xunpu-ts-1088', title: 'TS-1088-ARxxxxx tact switch (4 × 3 mm SMD, two terminals): 3.90 × 3.00 body, 5.00 over the terminals, 1.50 body height, Ø1.80 plunger, overall H 1.8 / 2.0 / 2.5, travel 0.2 ± 0.1 mm', publisher: 'DongGuan XunPu Electronics (published by LCSC)', url: 'https://datasheet.lcsc.com/datasheet/pdf/0475ac02febf455ca9ddcfb380b0df0d.pdf', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'waveshare-esp32-c6-zero', title: 'ESP32-C6-Zero wiki: 2D drawing and DXF (23.50 × 18.00 mm, R1.00, 1.60 mm PCB, 4.85 mm overall, 2.54 pitch, 1.59, 1.38, 7.98, 9.74, 8.79 and 3.63 mm; Ø0.9 holes, Ø1.15 pads underneath), STEP model and schematic', publisher: 'Waveshare Electronics', url: 'https://www.waveshare.com/wiki/ESP32-C6-Zero', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'waveshare-esp32-c6-zero-product', title: 'ESP32-C6-Zero product page: pinout (pins 1–18 and the GPIO pads underneath), onboard resources, US$4.99 (ESP32-C6-Zero-M with headers US$5.99)', publisher: 'Waveshare Electronics', url: 'https://www.waveshare.com/esp32-c6-zero.htm', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'seeed-xiao-esp32c6', title: 'Getting Started with Seeed Studio XIAO ESP32C6: 21 × 17.8 mm, pin map, RF switch (GPIO3 enable, GPIO14 onboard or U.FL antenna), front and back pinouts', publisher: 'Seeed Studio', url: 'https://wiki.seeedstudio.com/xiao_esp32c6_getting_started/', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'seeed-xiao-esp32c6-kicad', title: 'XIAO ESP32 C6 v1.0 schematic and PCB (KiCad 8, 2026-01-14): board outline 20.955 × 17.78 mm, R1.905, 1.6 mm stack-up, footprint placements', publisher: 'Seeed Studio', url: 'https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32C6/XIAO_ESP32_C6_v1.0_SCH&PCB_260114.zip', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'gct-usb4105', title: 'USB4105 USB Type C receptacle for USB 2.0, SMT, PCB top mount (rev. B4): 8.94 × 7.35 mm, 3.31 mm high; mated plug up to 6.5 mm', publisher: 'Global Connector Technology (GCT)', url: 'https://gct.co/files/drawings/usb4105.pdf', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'alps-sktaaae010', title: 'SKTAAAE010 TACT switch, 2.6 × 1.6 mm compact type with projection: 2.6 × 1.6 × 0.53 mm (3 over the terminals), 0.11 mm travel, 1.6 N, top push', publisher: 'Alps Alpine', url: 'https://tech.alpsalpine.com/e/products/detail/SKTAAAE010/', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'hirose-u-fl', title: 'U.FL Series, ultra small surface mount coaxial connectors: U.FL-R-SMT-1 receptacle 2.6 × 2.6 mm (3 over the ground tabs), 0.35 mm base, Ø2 mm post 1.25 mm high; mated height 2.4 mm (2.5 max)', publisher: 'Hirose Electric (catalog published by RS)', url: 'https://docs.rs-online.com/3355/0900766b8105243f.pdf', kind: 'manufacturer', accessed: BOARD_ACCESSED },
  { id: 'canfactory-dev-board-estimate', title: 'Read off the makers’ to-scale drawings and photographs, or the usual size of the package (docs/adding-parts.md, “Development boards”)', publisher: 'CanFactory', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/adding-parts.md#development-boards', kind: 'reference', accessed: BOARD_ACCESSED },
];

export function findPartSource(id: string): PartSource | undefined { return PART_SOURCES.find(source => source.id === id); }

/** A dimension builder bound to one source and basis, so that the tables below stay one line per row. */
export const measured = (basis: Dimension['basis'], source: string) =>
  (value: number, min: number | null = null, max: number | null = null): Dimension => ({ value, min, max, basis, source });
