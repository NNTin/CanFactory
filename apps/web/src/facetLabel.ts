/**
 * How a filter shows an attribute's value: a lowercase slug reads as words (`socket-cap` → `socket cap`), and any other value
 * keeps its hyphens, which belong to the name (ISO 7046-1, USB-C, ESP32-C3, D-ring).
 */
export function facetLabel(value: string): string {
  return /^[a-z]+(-[a-z]+)+$/.test(value) ? value.replace(/-/g, ' ') : value;
}
