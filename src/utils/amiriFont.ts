// Amiri font loader for jsPDF Arabic support
// We serve the font locally from /public/fonts to avoid CORS/CSP issues.

import { reshape } from "arabic-persian-reshaper";

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
 * Reverse a string while keeping certain character sequences intact
 * (like numbers and Latin characters)
 */
function reverseStringForPdf(text: string): string {
  // Split into segments: Arabic vs non-Arabic (numbers, Latin, symbols)
  const segments: { text: string; isArabic: boolean }[] = [];
  let currentSegment = "";
  let currentIsArabic = false;

  for (const char of text) {
    // Check if character is Arabic (includes Arabic-Indic digits)
    const isArabicChar = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);
    
    if (currentSegment === "") {
      currentIsArabic = isArabicChar;
      currentSegment = char;
    } else if (isArabicChar === currentIsArabic) {
      currentSegment += char;
    } else {
      segments.push({ text: currentSegment, isArabic: currentIsArabic });
      currentSegment = char;
      currentIsArabic = isArabicChar;
    }
  }
  
  if (currentSegment) {
    segments.push({ text: currentSegment, isArabic: currentIsArabic });
  }

  // Reverse the order of segments, and reverse Arabic segments internally
  const reversedSegments = segments.reverse().map(seg => {
    if (seg.isArabic) {
      // Reverse Arabic text character by character
      return [...seg.text].reverse().join("");
    }
    // Keep non-Arabic segments as-is (numbers, Latin text)
    return seg.text;
  });

  return reversedSegments.join("");
}

/**
 * Process Arabic text for proper PDF rendering
 * 
 * jsPDF does NOT support RTL natively. When using align: "right",
 * it just positions the starting point on the right but still draws
 * characters left-to-right. Therefore we must:
 * 1. Reshape Arabic characters (connect letters properly)
 * 2. Reverse the text so it displays correctly when drawn LTR
 */
export function processArabicText(text: string): string {
  if (!text) return text;
  
  try {
    // Step 1: Reshape Arabic text to handle proper character connections (ligatures)
    const reshaped = reshape(text);
    
    // Step 2: Reverse the text for correct RTL display in jsPDF
    const reversed = reverseStringForPdf(reshaped);
    
    return reversed;
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
 * Process text specifically for PDF list items
 * Same as processArabicText
 */
export function processListItemText(text: string): string {
  return processArabicText(text);
}
