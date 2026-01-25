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

/**
 * Process Arabic text for proper PDF rendering
 * 1. Reshape Arabic characters (handles ligatures and contextual forms)
 * 2. Apply BiDi algorithm to handle mixed LTR/RTL text properly
 */
export function processArabicText(text: string): string {
  if (!text) return text;
  
  try {
    // Step 1: Reshape Arabic text to handle proper character connections
    const reshaped = reshape(text);
    
    // Step 2: Apply BiDi algorithm and get the visual order
    const embeddingLevels = bidi.getEmbeddingLevels(reshaped);
    const reorderedText = bidi.getReorderedString(reshaped, embeddingLevels);
    
    return reorderedText;
  } catch (error) {
    console.warn("Arabic text processing failed, using original:", error);
    return text;
  }
}

// Legacy function kept for compatibility
export function reverseArabicText(text: string): string {
  return processArabicText(text);
}
