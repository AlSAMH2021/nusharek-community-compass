// Amiri font loader for jsPDF Arabic support
// We'll load the font from Google Fonts CDN and convert to base64

export async function loadAmiriFont(): Promise<string> {
  const fontUrl = "https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUp.ttf";
  
  try {
    const response = await fetch(fontUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return base64;
  } catch (error) {
    console.error("Failed to load Amiri font:", error);
    throw error;
  }
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

// Helper to reverse Arabic text for proper RTL display in PDF
export function reverseArabicText(text: string): string {
  // Check if text contains Arabic characters
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) {
    return text;
  }
  
  // Reverse the text for RTL display
  return text.split("").reverse().join("");
}

// Process mixed Arabic/English text
export function processArabicText(text: string): string {
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) {
    return text;
  }
  
  // Split by words and process
  const words = text.split(" ");
  const processedWords = words.map(word => {
    if (arabicRegex.test(word)) {
      return word.split("").reverse().join("");
    }
    return word;
  });
  
  return processedWords.reverse().join(" ");
}
