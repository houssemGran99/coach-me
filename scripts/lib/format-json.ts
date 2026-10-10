/** JSON with 2-space indent, but coordinate pairs and short number lists stay on one line. */
export function formatJson(value: unknown): string {
  const s = JSON.stringify(value, null, 2);
  return (
    s.replace(/\[\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*\]/g, "[$1, $2]") + "\n"
  );
}
