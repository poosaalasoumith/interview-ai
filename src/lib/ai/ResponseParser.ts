export interface ParsedAIResponse {
  message: string;
  type: string;
  confidence?: number;
  relatedConcepts?: string[];
  nextSuggestion?: string;
  citations?: string[];
}

export class AIResponseParser {
  static parse(text: string): ParsedAIResponse {
    const fallback: ParsedAIResponse = { message: text, type: "hint" };
    if (!text) return { message: "", type: "hint" };

    let cleaned = text.trim();

    // Clean standard Vercel AI stream protocol prefixes if they leaked into the content
    if (cleaned.startsWith("0:")) {
      cleaned = cleaned.substring(2).trim();
    }

    // Clean escaped double-stringified wraps
    if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
      try {
        const unquoted = JSON.parse(cleaned);
        if (typeof unquoted === "string") {
          cleaned = unquoted.trim();
        }
      } catch (e) {}
    }

    // Strip markdown code block wrappers wrapping JSON if the model generated them
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
    }

    // 1. Try standard complete JSON parsing
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object") {
        return {
          message: typeof parsed.message === "string" ? parsed.message : JSON.stringify(parsed),
          type: parsed.type || "hint",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
          relatedConcepts: Array.isArray(parsed.relatedConcepts) ? parsed.relatedConcepts : [],
          nextSuggestion: typeof parsed.nextSuggestion === "string" ? parsed.nextSuggestion : undefined,
          citations: Array.isArray(parsed.citations) ? parsed.citations : []
        };
      }
    } catch (err) {
      // 2. Synchronous partial parsing logic for streaming JSON
      const messageKeyIndex = cleaned.indexOf('"message"');
      
      // Prevent raw JSON structure characters from flashing before message key starts
      if (messageKeyIndex === -1 && (cleaned.startsWith("{") || cleaned.startsWith("["))) {
        return { message: "", type: "hint" };
      }

      if (messageKeyIndex !== -1) {
        const colonIndex = cleaned.indexOf(':', messageKeyIndex);
        if (colonIndex !== -1) {
          const startQuote = cleaned.indexOf('"', colonIndex);
          if (startQuote !== -1) {
            // Find the next unescaped double quote
            let endQuote = -1;
            for (let i = startQuote + 1; i < cleaned.length; i++) {
              if (cleaned[i] === '"' && cleaned[i - 1] !== '\\') {
                endQuote = i;
                break;
              }
            }

            let rawVal = endQuote !== -1 
              ? cleaned.substring(startQuote + 1, endQuote) 
              : cleaned.substring(startQuote + 1);

            // Clean escaped character formats
            rawVal = rawVal
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\\\/g, '\\');

            return {
              message: rawVal,
              type: "hint"
            };
          }
        }
      }
    }

    // If it is just plain text and doesn't look like JSON, return the fallback content
    return fallback;
  }
}
