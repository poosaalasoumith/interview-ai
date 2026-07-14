export interface ComparisonDiagnostics {
  expectedRaw: string;
  expectedParsed: string;
  actualRaw: string;
  actualParsed: string;
  expectedType: string;
  actualType: string;
  result: boolean;
}

export function parseValue(val: string): any {
  if (!val) return "";
  const clean = val.replace(/\r\n/g, "\n").trim();
  
  // 1. Try standard JSON.parse
  try {
    return JSON.parse(clean);
  } catch (e) {}

  // 2. Try parsing unquoted arrays (e.g. [a, b, c])
  if (clean.startsWith("[") && clean.endsWith("]")) {
    const content = clean.substring(1, clean.length - 1).trim();
    if (!content) return [];
    
    // Split by commas and map elements
    const items = content.split(",").map(item => {
      const trimmed = item.trim();
      try {
        return JSON.parse(trimmed);
      } catch (e) {}
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.substring(1, trimmed.length - 1);
      }
      return trimmed;
    });
    return items;
  }

  // 3. Strip quotes from string
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.substring(1, clean.length - 1);
  }

  return clean;
}

export function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  
  // Handle null explicitly — JSON.parse("null") returns JS null (typeof 'object')
  // but we want "null" (string) to match null (JS null)
  if (a === null || b === null) {
    const strA = String(a).toLowerCase().trim();
    const strB = String(b).toLowerCase().trim();
    return strA === strB;
  }
  
  // Float tolerance check first if they are numbers or strings that parse as numbers
  const floatA = parseFloat(String(a));
  const floatB = parseFloat(String(b));
  if (!isNaN(floatA) && !isNaN(floatB)) {
    const isStrictNumeric = (val: any) => typeof val === "number" || (typeof val === "string" && /^-?\d+(\.\d+)?(e-?\d+)?$/.test(val.trim()));
    if (isStrictNumeric(a) && isStrictNumeric(b)) {
      return Math.abs(floatA - floatB) <= 1e-4;
    }
  }
  
  // Handle object/array comparison
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepCompare(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      if (!deepCompare(a[keysA[i]], b[keysB[i]])) return false;
    }
    return true;
  }
  
  // If one is object/array and the other is a primitive, they do not match
  if (typeof a === 'object' || typeof b === 'object') {
    return false;
  }
  
  // Primitive string-based comparison fallback (covers booleans, null, strings, numbers)
  const strA = String(a).toLowerCase().trim();
  const strB = String(b).toLowerCase().trim();
  return strA === strB;
}

export function compareOutputs(actual: string, expected: string): ComparisonDiagnostics {
  const cleanActual = (actual || "").replace(/\r\n/g, "\n").trim();
  const cleanExpected = (expected || "").replace(/\r\n/g, "\n").trim();

  const parsedActual = parseValue(cleanActual);
  const parsedExpected = parseValue(cleanExpected);

  const result = deepCompare(parsedActual, parsedExpected);

  return {
    expectedRaw: expected || "",
    expectedParsed: typeof parsedExpected === "object" ? JSON.stringify(parsedExpected) : String(parsedExpected),
    actualRaw: actual || "",
    actualParsed: typeof parsedActual === "object" ? JSON.stringify(parsedActual) : String(parsedActual),
    expectedType: Array.isArray(parsedExpected) ? "array" : typeof parsedExpected,
    actualType: Array.isArray(parsedActual) ? "array" : typeof parsedActual,
    result
  };
}
