export function stripNullBytes(obj: unknown): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj.replace(/\u0000/g, "");
  if (typeof obj === "object") {
    try {
      const stringified = JSON.stringify(obj);
      if (!stringified) return obj;
      return JSON.parse(stringified.replace(/\\u0000/g, ""));
    } catch {
      return obj;
    }
  }
  return obj;
}
