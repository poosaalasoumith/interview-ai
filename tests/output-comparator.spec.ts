import { test, expect } from "@playwright/test";
import { compareOutputs } from "../src/utils/output-comparator";

test.describe("Online Judge Output Comparator — 100+ Test Validation Suite", () => {
  // Category 1: Quoted vs Unquoted Plain Strings (15 Cases)
  test("Plain vs Quoted String Normalization", () => {
    const cases = [
      { actual: "IPv4", expected: '"IPv4"', shouldPass: true },
      { actual: '"IPv4"', expected: "IPv4", shouldPass: true },
      { actual: "IPv6", expected: '"IPv6"', shouldPass: true },
      { actual: '"IPv6"', expected: "IPv6", shouldPass: true },
      { actual: "Neither", expected: '"Neither"', shouldPass: true },
      { actual: '"Neither"', expected: "Neither", shouldPass: true },
      { actual: "hello", expected: "'hello'", shouldPass: true },
      { actual: "'hello'", expected: "hello", shouldPass: true },
      { actual: "true", expected: '"true"', shouldPass: true },
      { actual: "false", expected: '"false"', shouldPass: true },
      { actual: "null", expected: '"null"', shouldPass: true },
      { actual: "12345", expected: '"12345"', shouldPass: true },
      { actual: "hello world", expected: '"hello world"', shouldPass: true },
      { actual: '"hello world"', expected: "hello world", shouldPass: true },
      { actual: "IPv4", expected: "IPv6", shouldPass: false }
    ];

    cases.forEach(({ actual, expected, shouldPass }, idx) => {
      const comp = compareOutputs(actual, expected);
      expect(comp.result).toBe(shouldPass);
    });
  });

  // Category 2: Line Endings & Whitespace Normalization (20 Cases)
  test("Whitespace & Line Ending Normalization", () => {
    const cases = [
      { actual: "IPv4\n", expected: "IPv4", shouldPass: true },
      { actual: "IPv4\r\n", expected: "IPv4", shouldPass: true },
      { actual: "  IPv4  ", expected: "IPv4", shouldPass: true },
      { actual: "\n\nIPv4\n\n", expected: "IPv4", shouldPass: true },
      { actual: "IPv4\nIPv6", expected: "IPv4\r\nIPv6", shouldPass: true },
      { actual: "IPv4\n\nIPv6", expected: "IPv4\nIPv6", shouldPass: false }, // empty line difference
      { actual: "a\tb", expected: "a b", shouldPass: false },
      { actual: "\t  a  \t", expected: "a", shouldPass: true },
      { actual: "  \"IPv4\"  ", expected: "IPv4", shouldPass: true },
      { actual: "  'IPv4'  ", expected: "  IPv4  ", shouldPass: true },
      { actual: "line1\nline2\nline3", expected: "line1\r\nline2\r\nline3\r\n", shouldPass: true },
      { actual: " line1 \n line2 ", expected: "line1\nline2", shouldPass: false }, // inner spacing differences
      { actual: "  ", expected: "", shouldPass: true },
      { actual: "\r\n\r\n", expected: "", shouldPass: true },
      { actual: "", expected: '""', shouldPass: true },
      { actual: '""', expected: "", shouldPass: true },
      { actual: "''", expected: "", shouldPass: true },
      { actual: "[]", expected: "  [   ]  ", shouldPass: true },
      { actual: "{}", expected: " {  } ", shouldPass: true },
      { actual: "null", expected: "   null   ", shouldPass: true }
    ];

    cases.forEach(({ actual, expected, shouldPass }) => {
      const comp = compareOutputs(actual, expected);
      expect(comp.result).toBe(shouldPass);
    });
  });

  // Category 3: Numbers and Float Tolerance (20 Cases)
  test("Float Tolerance and Type Parsing", () => {
    const cases = [
      { actual: "3.14159", expected: "3.1416", shouldPass: true },
      { actual: "3.14159", expected: "3.1414", shouldPass: false }, // exceeds 1e-4 tolerance
      { actual: "0.0001", expected: "0", shouldPass: true }, // boundary check
      { actual: "0.0002", expected: "0", shouldPass: false },
      { actual: "123", expected: '"123"', shouldPass: true },
      { actual: "123.0", expected: "123", shouldPass: true },
      { actual: "1.00001", expected: "1.0", shouldPass: true },
      { actual: "-5.0", expected: "-5", shouldPass: true },
      { actual: "1e3", expected: "1000", shouldPass: true },
      { actual: "1000", expected: "1e3", shouldPass: true },
      { actual: "NaN", expected: "NaN", shouldPass: true },
      { actual: "Infinity", expected: "Infinity", shouldPass: true },
      { actual: "3.14159", expected: '3.14159', shouldPass: true },
      { actual: "3.14159", expected: '"3.14159"', shouldPass: true },
      { actual: "3.14159", expected: "'3.14159'", shouldPass: true },
      { actual: "42", expected: "42", shouldPass: true },
      { actual: "42", expected: "43", shouldPass: false },
      { actual: "-42", expected: "42", shouldPass: false },
      { actual: "0.0", expected: "-0.0", shouldPass: true },
      { actual: "0.00009", expected: "0.0001", shouldPass: true }
    ];

    cases.forEach(({ actual, expected, shouldPass }) => {
      const comp = compareOutputs(actual, expected);
      expect(comp.result).toBe(shouldPass);
    });
  });

  // Category 4: Arrays & Nested Structures (25 Cases)
  test("Arrays & Nested Arrays Normalization", () => {
    const cases = [
      { actual: "[1, 2, 3]", expected: "[1,2,3]", shouldPass: true },
      { actual: "[1, 2, 3]", expected: "[1, 2, 3, 4]", shouldPass: false },
      { actual: "[1, 2, 3]", expected: "[1, 3, 2]", shouldPass: false }, // array order is strict
      { actual: "[[1, 2], [3, 4]]", expected: "[[1,2],[3,4]]", shouldPass: true },
      { actual: "[[1, 2], [3, 4]]", expected: "[[1, 2], [3, 5]]", shouldPass: false },
      { actual: '["a", "b", "c"]', expected: "[a, b, c]", shouldPass: true }, // unquoted elements normalized
      { actual: '["a", "b", "c"]', expected: "['a', 'b', 'c']", shouldPass: true },
      { actual: "[true, false, null]", expected: "[true,false,null]", shouldPass: true },
      { actual: "[1.00001, 2.0]", expected: "[1, 2]", shouldPass: true },
      { actual: "[1.0001, 2.0]", expected: "[1.0002, 2.0]", shouldPass: true }, // inner elements float tolerance
      { actual: "[]", expected: "[]", shouldPass: true },
      { actual: "[]", expected: "[null]", shouldPass: false },
      { actual: "[null]", expected: "[null]", shouldPass: true },
      { actual: "[1]", expected: "1", shouldPass: false },
      { actual: "1", expected: "[1]", shouldPass: false },
      { actual: "[1, [2, [3]]]", expected: "[1,[2,[3]]]", shouldPass: true },
      { actual: "[1, [2, [3]]]", expected: "[1,[2,[4]]]", shouldPass: false },
      { actual: '["IPv4", "IPv6"]', expected: "['IPv4', 'IPv6']", shouldPass: true },
      { actual: "[IPv4, IPv6]", expected: '["IPv4", "IPv6"]', shouldPass: true },
      { actual: "[IPv4, IPv6]", expected: "[IPv4, IPv6]", shouldPass: true },
      { actual: "[IPv4,IPv6]", expected: "[ IPv4 , IPv6 ]", shouldPass: true },
      { actual: "[[[1]]]", expected: "[[[1]]]", shouldPass: true },
      { actual: "[[[1]]]", expected: "[[[2]]]", shouldPass: false },
      { actual: "[1,2,3]", expected: " [1, 2, 3] \n", shouldPass: true },
      { actual: " [1,2,3] ", expected: "[1, 2, 3]", shouldPass: true }
    ];

    cases.forEach(({ actual, expected, shouldPass }) => {
      const comp = compareOutputs(actual, expected);
      expect(comp.result).toBe(shouldPass);
    });
  });

  // Category 5: Objects & Key Order Canonicals (20 Cases)
  test("Objects & Canonical Formatting", () => {
    const cases = [
      { actual: '{"a": 1, "b": 2}', expected: '{"b": 2, "a": 1}', shouldPass: true }, // key ordering matches
      { actual: '{"a": 1, "b": {"c": 3}}', expected: '{"b": {"c": 3}, "a": 1}', shouldPass: true },
      { actual: '{"a": 1}', expected: '{"a": 2}', shouldPass: false },
      { actual: '{"a": 1}', expected: '{"b": 1}', shouldPass: false },
      { actual: '{"a": [1, 2]}', expected: '{"a": [1, 2]}', shouldPass: true },
      { actual: '{"a": [1, 2]}', expected: '{"a": [2, 1]}', shouldPass: false },
      { actual: "{}", expected: "{}", shouldPass: true },
      { actual: '{"a": 1.00001}', expected: '{"a": 1.0}', shouldPass: true },
      { actual: '{"status": "success", "data": "IPv4"}', expected: '{"data": "IPv4", "status": "success"}', shouldPass: true },
      { actual: '{"status": "success", "data": "IPv4"}', expected: '{"data": "IPv6", "status": "success"}', shouldPass: false },
      { actual: '{"a": null}', expected: '{"a": null}', shouldPass: true },
      { actual: '{"a": true}', expected: '{"a": true}', shouldPass: true },
      { actual: '{"a": false}', expected: '{"a": false}', shouldPass: true },
      { actual: '{"a": "hello"}', expected: '{"a": "hello"}', shouldPass: true },
      { actual: '{"a": "hello"}', expected: '{"a": "hello2"}', shouldPass: false },
      { actual: '{"a": 1, "b": null}', expected: '{"b": null, "a": 1}', shouldPass: true },
      { actual: '{"a": 1, "b": 2, "c": 3}', expected: '{"c":3,"b":2,"a":1}', shouldPass: true },
      { actual: '{"a": 1, "b": 2, "c": 3}', expected: '{"c":3,"b":2,"a":1,"d":4}', shouldPass: false },
      { actual: '{"a": {"b": {"c": 1}}}', expected: '{"a": {"b": {"c": 1}}}', shouldPass: true },
      { actual: '{"a": {"b": {"c": 1}}}', expected: '{"a": {"b": {"c": 2}}}', shouldPass: false }
    ];

    cases.forEach(({ actual, expected, shouldPass }) => {
      const comp = compareOutputs(actual, expected);
      expect(comp.result).toBe(shouldPass);
    });
  });
});
