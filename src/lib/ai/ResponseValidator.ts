export class AIResponseValidator {
  static validate(
    responseText: string,
    allowSolutions: boolean
  ): { isValid: boolean; reason?: string } {
    if (!responseText || responseText.trim() === "") {
      return { isValid: false, reason: "Response is empty" };
    }

    // Parse JSON structure
    let parsed: any = null;
    try {
      parsed = JSON.parse(responseText);
    } catch (err) {
      return { isValid: false, reason: "Response is not valid JSON" };
    }

    // Validate standard structured payload keys
    if (!parsed.message || typeof parsed.message !== "string") {
      return { isValid: false, reason: "Response message field is missing or invalid" };
    }

    if (!allowSolutions) {
      const msg = parsed.message;

      // 1. Detect full code blocks with implementations
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = msg.match(codeBlockRegex) || [];
      for (const block of codeBlocks) {
        const cleanedBlock = block.replace(/```[a-zA-Z]*/, "").replace(/```$/, "").trim();
        const linesCount = cleanedBlock.split("\n").length;
        
        // If it is longer than 4 lines and contains common program structure syntax
        if (
          linesCount > 4 &&
          (cleanedBlock.includes("function") ||
            cleanedBlock.includes("const ") ||
            cleanedBlock.includes("let ") ||
            cleanedBlock.includes("return ") ||
            cleanedBlock.includes("=>") ||
            cleanedBlock.includes("class ") ||
            cleanedBlock.includes("SELECT ") ||
            cleanedBlock.includes("INSERT "))
        ) {
          return { isValid: false, reason: "Response contains copy-pasteable implementation block" };
        }
      }

      // 2. Detect raw JavaScript function structures or SQL query solutions
      if (
        (msg.includes("function ") || msg.includes("const ") || msg.includes("let ")) &&
        msg.includes("return ") &&
        msg.includes("{")
      ) {
        return { isValid: false, reason: "Response contains raw code structures" };
      }
      if (msg.includes("SELECT ") && msg.includes("FROM ") && msg.includes("WHERE ")) {
        return { isValid: false, reason: "Response contains raw SQL queries" };
      }
    }

    return { isValid: true };
  }
}
