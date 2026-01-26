// Amiri font loader for jsPDF Arabic support
// We serve the font locally from /public/fonts to avoid CORS/CSP issues.

import { reshape } from "arabic-persian-reshaper";
import bidi from "bidi-js";

let cachedAmiriBase64: string | null = null;

export async function loadAmiriFont(): Promise<string> {
  if (cachedAmiriBase64) return cachedAmiriBase64;

  const urls = [
    "/fonts/Amiri-Regular.ttf",
    // Fallback (in case local file isn't available for some reason)
    "https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUp.ttf",
  ];

  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch font: ${url} (${response.status})`);
      const arrayBuffer = await response.arrayBuffer();
      cachedAmiriBase64 = arrayBufferToBase64(arrayBuffer);
      return cachedAmiriBase64;
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Failed to load Amiri font", lastError);
  throw lastError;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Unicode RTL mark to preserve number/symbol positioning
const RLM = "\u200F";
// Unicode LTR mark for embedded LTR content
const LRM = "\u200E";

// Technical CSS terms that might appear in text and should be removed
const technicalTermsToRemove = [
  "word-break-all",
  "overflow-wrap",
  "break-word",
  "break-all",
  "white-space",
  "text-overflow",
];

/**
 * Clean text from any technical CSS/styling terms that may have leaked
 */
function cleanTechnicalTerms(text: string): string {
  let cleaned = text;
  technicalTermsToRemove.forEach((term) => {
    // Remove the term with optional surrounding spaces/punctuation
    const regex = new RegExp(`\\s*${term}[:\\s;]*`, "gi");
    cleaned = cleaned.replace(regex, " ");
  });
  // Clean up multiple spaces
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Fix parentheses for RTL context - swap opening/closing for proper display
 */
function fixParenthesesForRTL(text: string): string {
  // In RTL context, we need to swap parentheses direction
  return text
    .replace(/\(/g, "<<<OPEN>>>")
    .replace(/\)/g, "(")
    .replace(/<<<OPEN>>>/g, ")")
    .replace(/\[/g, "<<<OPEN_SQ>>>")
    .replace(/\]/g, "[")
    .replace(/<<<OPEN_SQ>>>/g, "]");
}

/**
 * Wrap numbers and special symbols with RTL marks to keep them in correct position
 */
function wrapNumbersAndSymbols(text: string): string {
  // Match: percentages, numbers, parentheses groups, dates, ranges
  // Add RLM before and after to anchor them in RTL flow
  return text.replace(
    /(%?\d+(?:[.,/\-:]\d+)*%?|\([^)]*\)|\[[^\]]*\])/g,
    (match) => `${RLM}${match}${RLM}`
  );
}

/**
 * Process Arabic text for proper PDF rendering
 * 1. Clean any technical terms that leaked into text
 * 2. Reshape Arabic characters (handles ligatures and contextual forms)
 * 3. Apply BiDi algorithm to handle mixed LTR/RTL text properly
 * 4. Fix number and symbol positioning with RTL marks
 */
export function processArabicText(text: string): string {
  if (!text) return text;
  
  try {
    // Step 0: Clean any technical CSS terms that may have leaked
    let processed = cleanTechnicalTerms(text);
    
    // Step 1: Reshape Arabic text to handle proper character connections
    const reshaped = reshape(processed);
    
    // Step 2: Apply BiDi algorithm and get the visual order
    const embeddingLevels = bidi.getEmbeddingLevels(reshaped);
    const reorderedText = bidi.getReorderedString(reshaped, embeddingLevels);
    
    // Step 3: Fix parentheses direction for RTL display
    const withFixedParens = fixParenthesesForRTL(reorderedText);
    
    // Step 4: Wrap remaining numbers/symbols with RTL marks
    const finalText = wrapNumbersAndSymbols(withFixedParens);
    
    return finalText;
  } catch (error) {
    console.warn("Arabic text processing failed, using original:", error);
    return text;
  }
}

// Legacy function kept for compatibility
export function reverseArabicText(text: string): string {
  return processArabicText(text);
}

/**
 * Process text specifically for PDF list items (recommendations, strengths, etc.)
 * Handles mixed Arabic/English content with proper RTL positioning
 */
export function processListItemText(text: string): string {
  if (!text) return text;
  
  // Clean technical terms first
  let cleaned = cleanTechnicalTerms(text);
  
  // Add RLM at the start to establish RTL context
  cleaned = RLM + cleaned;
  
  return processArabicText(cleaned);
}
