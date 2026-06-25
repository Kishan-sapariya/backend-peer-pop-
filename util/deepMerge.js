const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function deepMerge(target, source) {
  for (const key in source) {
    // Block prototype-pollution vectors from untrusted JSON.
    if (FORBIDDEN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
