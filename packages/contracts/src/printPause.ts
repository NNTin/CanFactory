/**
 * Embedding a flat item (a magnet, an NFC tag) at a print pause, shared by the models that do it (the QR magnet tag, the cat collar
 * tag). The item lies in a sealed cavity: from a skin over the face on the print bed up to the pause height, where the print pauses,
 * the item is dropped in, and the next layer bridges over it. Every height is on a layer boundary, so that the slicer's pause falls
 * exactly between the cavity's last layer and the first that closes it, and the nozzle never meets the item.
 */

/** A height rounded up to whole layers (to the micrometre, as the SCAD files' `layers`). */
export const toLayers = (height: number, layerHeight: number): number =>
  Math.round(Math.ceil(height / layerHeight - 1e-9) * layerHeight * 1e6) / 1e6;

/** The 1-based number of the first layer printed above a height on a layer boundary: the layer to pause (or change filament) before. */
export const layerAbove = (height: number, layerHeight: number): number => Math.round(height / layerHeight) + 1;

/**
 * A sealed cavity for an item `itemHeight` high (its greatest), whose floor is at least `skin` above the bed and which leaves
 * `headroom` over the item: the floor (`skin`, in whole layers) and the pause height (the cavity's top, in whole layers).
 */
export function embedCavity(skin: number, itemHeight: number, headroom: number, layerHeight: number): { skin: number; pause: number } {
  const floor = toLayers(skin, layerHeight);
  return { skin: floor, pause: toLayers(floor + itemHeight + headroom, layerHeight) };
}
