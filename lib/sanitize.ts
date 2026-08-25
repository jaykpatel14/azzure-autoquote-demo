export function stripNullBytes<T = unknown>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Strip both raw 0x00 and escaped unicode nulls
    return obj
      .replace(/\0/g, "")
      .replace(/\\u0000/g, "")
      .replace(/\u0000/g, "") as unknown as T;
  }

  if (typeof obj === "number" || typeof obj === "boolean" || typeof obj === "bigint") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripNullBytes(item)) as unknown as T;
  }

  if (obj instanceof Error) {
    return {
      name: stripNullBytes(obj.name),
      message: stripNullBytes(obj.message),
      stack: stripNullBytes(obj.stack)
    } as unknown as T;
  }

  if (typeof obj === "object") {
    // Leave Dates and RegExps intact
    if (obj instanceof Date || obj instanceof RegExp) return obj;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanKey = typeof key === "string" ? stripNullBytes(key) : key;
      result[cleanKey] = stripNullBytes(value);
    }
    return result as unknown as T;
  }

  return obj;
}
