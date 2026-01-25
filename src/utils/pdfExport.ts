import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { loadAmiriFont, processArabicText } from "./amiriFont";

type JsPdfWithAutoTable = jsPDF & {
  autoTable?: (options: UserOptions) => jsPDF;
  lastAutoTable?: { finalY?: number };
};

interface DimensionScore {
  id: string;
  dimension_id: string;
  score: number;
  max_possible_score: number;
  percentage: number;
  dimension: {
    name_ar: string;
    name_en: string;
    order_index: number;
  };
}

interface Assessment {
  id: string;
  overall_score: number | null;
  maturity_level: string | null;
  completed_at: string | null;
  organization_id: string;
}

interface Organization {
  name: string;
  name_en?: string | null;
  sector?: string | null;
  city?: string | null;
  type?: string | null;
}

// المستويات الثلاثة: أساسي (0-49%) - ناشئ (50-74%) - مثالي (75-100%)
const maturityLabels: Record<string, { ar: string; en: string; color: number[]; bgColor: number[] }> = {
  beginner: { ar: "أساسي", en: "Basic", color: [185, 28, 28], bgColor: [254, 226, 226] },
  developing: { ar: "ناشئ", en: "Emerging", color: [180, 83, 9], bgColor: [254, 243, 199] },
  leading: { ar: "مثالي", en: "Ideal", color: [21, 128, 61], bgColor: [220, 252, 231] },
};

// Organization type labels
const orgTypeLabels: Record<string, string> = {
  government: "حكومي",
  non_profit: "غير ربحي",
  private_sector: "قطاع خاص",
  other: "أخرى",
};

function downloadPdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportResultsToPDF(
  assessment: Assessment,
  dimensionScores: DimensionScore[],
  strengths: string[],
  opportunities: string[],
  recommendations: string[],
  organization?: Organization | null,
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as JsPdfWithAutoTable;

  let hasAmiri = false;
  try {
    const amiriFontBase64 = await loadAmiriFont();

    if (!pdf.addFileToVFS || !pdf.addFont) {
      throw new Error("jsPDF font APIs not available");
    }

    pdf.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    hasAmiri = true;
  } catch (error) {
    console.warn("Could not load Amiri font, falling back to helvetica:", error);
  }

  const arabicFont = hasAmiri ? "Amiri" : "helvetica";
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const safeMargin = 25; // Safe area for logo/branding
  let yPos = 25;

  // Brand colors - using tuples for jspdf-autotable compatibility
  type ColorTuple = [number, number, number];
  const colors = {
    primary: [108, 58, 237] as ColorTuple, // Nusharek Purple (#6C3AED)
    primaryDark: [91, 33, 182] as ColorTuple,
    primaryLight: [139, 92, 246] as ColorTuple,
    secondary: [30, 58, 95] as ColorTuple, // Navy (#1E3A5F)
    teal: [20, 184, 166] as ColorTuple,
    coral: [249, 115, 22] as ColorTuple,
    gold: [245, 158, 11] as ColorTuple,
    text: [30, 41, 59] as ColorTuple,
    textMuted: [100, 116, 139] as ColorTuple,
    border: [226, 232, 240] as ColorTuple,
    bgLight: [248, 250, 252] as ColorTuple,
    white: [255, 255, 255] as ColorTuple,
    success: [20, 184, 166] as ColorTuple, // Teal for مثالي
    warning: [245, 158, 11] as ColorTuple, // Gold for ناشئ
    danger: [249, 115, 22] as ColorTuple, // Coral for أساسي
  };

  // Helper function for Arabic text
  const renderText = (text: string): string => {
    return hasAmiri ? processArabicText(text) : text;
  };

  const addText = (
    text: string,
    y: number,
    fontSize: number = 12,
    align: "right" | "center" | "left" = "right",
    color: number[] = colors.text,
  ): number => {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);

    const processed = renderText(text);

    if (align === "center") {
      pdf.text(processed, pageWidth / 2, y, { align: "center" });
    } else if (align === "right") {
      pdf.text(processed, pageWidth - margin, y, { align: "right" });
    } else {
      pdf.text(processed, margin, y);
    }

    return y + fontSize * 0.5;
  };

  const checkPageBreak = (neededSpace: number = 30): void => {
    if (yPos > pageHeight - neededSpace - 20) {
      pdf.addPage();
      yPos = 30;
    }
  };

  // Draw decorative portal pattern (curved grid)
  const drawPortalPattern = (centerX: number, centerY: number, size: number, opacity: number = 0.15) => {
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.3);

    // Draw concentric arcs
    for (let i = 1; i <= 5; i++) {
      const radius = size * (i / 5);
      pdf.circle(centerX, centerY, radius, "S");
    }

    // Draw radial lines
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180;
      const x2 = centerX + Math.cos(rad) * size;
      const y2 = centerY + Math.sin(rad) * size;
      pdf.line(centerX, centerY, x2, y2);
    }
  };

  // Draw decorative corner element
  const drawCornerDecoration = (x: number, y: number, size: number, flip: boolean = false) => {
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);

    const dir = flip ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      pdf.line(x, y + i * 4 * dir, x + size - i * 8, y + i * 4 * dir);
    }
  };

  // Draw gauge arc for score visualization
  const drawGaugeArc = (
    centerX: number,
    centerY: number,
    radius: number,
    percentage: number,
    bgColor: number[],
    fgColor: number[],
  ) => {
    const startAngle = Math.PI;
    const endAngle = 0;
    const arcAngle = startAngle + (endAngle - startAngle) * (percentage / 100);

    // Background arc
    pdf.setDrawColor(bgColor[0], bgColor[1], bgColor[2]);
    pdf.setLineWidth(6);

    // Draw background arc segments
    for (let a = startAngle; a <= endAngle + 0.01; a += 0.1) {
      const x1 = centerX + Math.cos(a) * radius;
      const y1 = centerY + Math.sin(a) * radius;
      const x2 = centerX + Math.cos(a + 0.1) * radius;
      const y2 = centerY + Math.sin(a + 0.1) * radius;
      pdf.line(x1, y1, x2, y2);
    }

    // Foreground arc (score)
    pdf.setDrawColor(fgColor[0], fgColor[1], fgColor[2]);
    for (let a = startAngle; a <= arcAngle; a += 0.05) {
      const x1 = centerX + Math.cos(a) * radius;
      const y1 = centerY + Math.sin(a) * radius;
      const x2 = centerX + Math.cos(a + 0.05) * radius;
      const y2 = centerY + Math.sin(a + 0.05) * radius;
      pdf.line(x1, y1, x2, y2);
    }
  };

  // Draw radar chart
  const drawRadarChart = (
    centerX: number,
    centerY: number,
    radius: number,
    data: { label: string; value: number; shortLabel: string }[],
  ) => {
    const numPoints = data.length;
    const angleStep = (2 * Math.PI) / numPoints;
    const startAngle = -Math.PI / 2; // Start from top

    // Draw grid circles (background)
    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.3);

    for (let level = 1; level <= 4; level++) {
      const levelRadius = (radius * level) / 4;
      pdf.circle(centerX, centerY, levelRadius, "S");
    }

    // Draw axis lines
    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.3);

    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      pdf.line(centerX, centerY, x, y);
    }

    // Draw data polygon (filled)
    const dataPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const value = data[i].value / 100; // Normalize to 0-1
      const pointRadius = radius * value;
      dataPoints.push({
        x: centerX + Math.cos(angle) * pointRadius,
        y: centerY + Math.sin(angle) * pointRadius,
      });
    }

    // Fill polygon with triangles from center (simpler approach without GState)
    if (dataPoints.length > 0) {
      // Draw filled area by creating triangles from center with lighter color
      pdf.setFillColor(
        Math.min(255, colors.primaryLight[0] + 40),
        Math.min(255, colors.primaryLight[1] + 40),
        Math.min(255, colors.primaryLight[2] + 40),
      );

      for (let i = 0; i < dataPoints.length; i++) {
        const current = dataPoints[i];
        const next = dataPoints[(i + 1) % dataPoints.length];

        // Draw triangle
        pdf.triangle(centerX, centerY, current.x, current.y, next.x, next.y, "F");
      }

      // Draw outline
      pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setLineWidth(2);
      for (let i = 0; i < dataPoints.length; i++) {
        const current = dataPoints[i];
        const next = dataPoints[(i + 1) % dataPoints.length];
        pdf.line(current.x, current.y, next.x, next.y);
      }

      // Draw data points
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      dataPoints.forEach((point) => {
        pdf.circle(point.x, point.y, 2.5, "F");
      });

      // Draw white center point
      pdf.setFillColor(255, 255, 255);
      pdf.circle(centerX, centerY, 3, "F");
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.circle(centerX, centerY, 1.5, "F");
    }

    // Draw labels
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const labelRadius = radius + 12;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;

      // Adjust alignment based on position
      let align: "center" | "right" | "left" = "center";
      if (Math.cos(angle) < -0.3) align = "right";
      else if (Math.cos(angle) > 0.3) align = "left";

      pdf.text(renderText(data[i].shortLabel), x, y + 2, { align });
    }

    // Draw percentage labels on grid
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);

    for (let level = 1; level <= 4; level++) {
      const levelRadius = (radius * level) / 4;
      const percentage = level * 25;
      pdf.text(`${percentage}%`, centerX + 3, centerY - levelRadius + 3);
    }
  };

  // Get maturity color based on percentage
  const getMaturityColor = (percentage: number): ColorTuple => {
    if (percentage >= 75) return colors.success;
    if (percentage >= 50) return colors.warning;
    return colors.danger;
  };

  const getMaturityLabel = (percentage: number): string => {
    if (percentage >= 75) return "مثالي";
    if (percentage >= 50) return "ناشئ";
    return "أساسي";
  };

  // Format date in Arabic
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr)
      return new Date().toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Sort dimension scores by percentage for recommendations (lowest first)
  const sortedByPriority = [...dimensionScores].sort((a, b) => a.percentage - b.percentage);

  // ===================== PAGE 1: COVER PAGE (Minimal Design with Portal Pattern) =====================
  // Clean white background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // Draw Nusharek portal pattern in corners (similar to Auth page)
  const drawPortalShape = (x: number, y: number, size: number, rotation: number, color: number[]) => {
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(1.5);

    // Save the current state
    const cos = Math.cos((rotation * Math.PI) / 180);
    const sin = Math.sin((rotation * Math.PI) / 180);

    // Helper to rotate a point around center
    const rotatePoint = (px: number, py: number) => {
      const dx = px - x;
      const dy = py - y;
      return {
        x: x + dx * cos - dy * sin,
        y: y + dx * sin + dy * cos,
      };
    };

    // Draw the four curved diamond shapes (portal pattern)
    // Shape 1 - Top right quadrant
    const s = size / 4;

    // Outer shape paths (simplified curved diamonds)
    // First diamond (top-left of pattern)
    const d1Points = [
      { x: x - s, y: y - s * 2 },
      { x: x + s, y: y - s },
      { x: x, y: y + s },
      { x: x - s * 2, y: y },
    ];

    // Second diamond (top-right)
    const d2Points = [
      { x: x + s, y: y - s * 2 },
      { x: x + s * 2, y: y },
      { x: x + s, y: y + s },
      { x: x, y: y - s },
    ];

    // Third diamond (bottom-left)
    const d3Points = [
      { x: x - s * 2, y: y },
      { x: x - s, y: y + s },
      { x: x, y: y + s * 2 },
      { x: x - s, y: y + s },
    ];

    // Fourth diamond (bottom-right)
    const d4Points = [
      { x: x, y: y + s },
      { x: x + s, y: y + s * 2 },
      { x: x + s * 2, y: y + s },
      { x: x + s, y: y },
    ];

    // Draw all four diamond shapes with rotation
    [d1Points, d2Points, d3Points, d4Points].forEach((points, index) => {
      // Use different shades for visual effect
      if (index < 2) {
        pdf.setDrawColor(155, 114, 242); // Lighter purple #9b72f2
      } else {
        pdf.setDrawColor(105, 41, 242); // Darker purple #6929f2
      }

      const rotatedPoints = points.map((p) => rotatePoint(p.x, p.y));

      // Draw diamond shape
      for (let i = 0; i < rotatedPoints.length; i++) {
        const start = rotatedPoints[i];
        const end = rotatedPoints[(i + 1) % rotatedPoints.length];
        pdf.line(start.x, start.y, end.x, end.y);
      }
    });
  };

  // Draw portal pattern in top-left corner (rotated -15 degrees)
  drawPortalShape(-15, -15, 80, -15, colors.primaryLight);

  // Draw portal pattern in bottom-right corner (rotated 165 degrees)
  drawPortalShape(pageWidth + 15, pageHeight + 15, 80, 165, colors.primaryLight);

  // Load and add Nusharek logo image
  try {
    const logoResponse = await fetch("/src/assets/nusharek-logo.png");
    const logoBlob = await logoResponse.blob();
    const logoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 data after the data URL prefix
        const base64Data = result.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(logoBlob);
    });

    // Add logo image centered at top (smaller size)
    const logoWidth = 55;
    const logoHeight = 19; // Approximate height based on logo aspect ratio
    const logoX = (pageWidth - logoWidth) / 2;
    pdf.addImage(logoBase64, "PNG", logoX, 50, logoWidth, logoHeight);
  } catch (logoError) {
    // Fallback to text if logo fails to load
    console.warn("Could not load logo image, falling back to text:", logoError);
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(32);
    pdf.text(renderText("نُشارك"), pageWidth / 2, 60, { align: "center" });
  }

  // Small tagline below logo
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  pdf.text(renderText("منصة التقييم الذاتي للمشاركة المجتمعية"), pageWidth / 2, 85, { align: "center" });

  // Main title
  pdf.setFont(arabicFont, "normal");
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.setFontSize(28);
  pdf.text(renderText("تقرير نتائج التقييم"), pageWidth / 2, pageHeight / 2 - 10, { align: "center" });

  // Organization name
  if (organization) {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(18);
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(renderText(organization.name), pageWidth / 2, pageHeight / 2 + 15, { align: "center" });

    // Organization type
    if (organization.type && orgTypeLabels[organization.type]) {
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText(orgTypeLabels[organization.type]), pageWidth / 2, pageHeight / 2 + 28, { align: "center" });
    }
  }

  // Date at bottom
  const coverDate = formatDate(assessment.completed_at);
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  pdf.text(renderText(coverDate), pageWidth / 2, pageHeight - 40, { align: "center" });

  // Copyright
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(9);
  pdf.text(renderText("جميع الحقوق محفوظة © منصة نُشارك"), pageWidth / 2, pageHeight - 25, { align: "center" });

  // ===================== PAGE 2: EXECUTIVE SUMMARY =====================
  pdf.addPage();
  yPos = safeMargin;

  // Executive Summary Title
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(18);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("نظرة عامة على نتائج التقييم"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 25;

  // Summary intro text
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  const summaryIntro = organization
    ? `يقدم هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية لـ "${organization.name}". يتضمن الملخص أبرز النتائج والتوصيات الاستراتيجية.`
    : "يقدم هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية. يتضمن الملخص أبرز النتائج والتوصيات الاستراتيجية.";

  const introLines = pdf.splitTextToSize(renderText(summaryIntro), pageWidth - margin * 2 - 10);
  introLines.forEach((line: string) => {
    pdf.text(line, pageWidth - margin - 5, yPos, { align: "right" });
    yPos += 6;
  });

  yPos += 10;

  // Key metrics row
  const metricBoxWidth = (pageWidth - margin * 2 - 16) / 3;
  const metricBoxHeight = 50;

  // Metric 1: Overall Score
  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setLineWidth(1.5);
  pdf.roundedRect(pageWidth - margin - metricBoxWidth, yPos, metricBoxWidth, metricBoxHeight, 6, 6, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  const overallScore = Math.round(assessment.overall_score || 0);
  pdf.text(`${overallScore}%`, pageWidth - margin - metricBoxWidth / 2, yPos + 28, { align: "center" });

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("الدرجة الإجمالية"), pageWidth - margin - metricBoxWidth / 2, yPos + 42, { align: "center" });

  // Metric 2: Maturity Level
  const maturityForSummary = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  const maturityColorSummary = maturityForSummary?.color || colors.textMuted;

  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.setDrawColor(maturityColorSummary[0], maturityColorSummary[1], maturityColorSummary[2]);
  pdf.roundedRect(pageWidth - margin - metricBoxWidth * 2 - 8, yPos, metricBoxWidth, metricBoxHeight, 6, 6, "FD");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(20);
  pdf.setTextColor(maturityColorSummary[0], maturityColorSummary[1], maturityColorSummary[2]);
  pdf.text(renderText(maturityForSummary?.ar || "—"), pageWidth - margin - metricBoxWidth * 1.5 - 8, yPos + 28, {
    align: "center",
  });

  pdf.setFontSize(10);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("مستوى النضج"), pageWidth - margin - metricBoxWidth * 1.5 - 8, yPos + 42, { align: "center" });

  // Metric 3: Dimensions Count
  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.roundedRect(margin, yPos, metricBoxWidth, metricBoxHeight, 6, 6, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.text(`${dimensionScores.length}`, margin + metricBoxWidth / 2, yPos + 28, { align: "center" });

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("معايير التقييم"), margin + metricBoxWidth / 2, yPos + 42, { align: "center" });

  yPos += metricBoxHeight + 20;

  // Top 3 Results Section
  pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("أبرز ٣ نتائج"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 20;

  // Get top 3 performing dimensions
  const top3Dimensions = [...dimensionScores].sort((a, b) => b.percentage - a.percentage).slice(0, 3);

  top3Dimensions.forEach((ds, index) => {
    const cardY = yPos;
    const cardHeight = 22;

    // Card background
    pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
    pdf.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 4, 4, "F");

    // Left accent based on score
    const accentColor = getMaturityColor(ds.percentage);
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.roundedRect(pageWidth - margin - 3, cardY + 4, 2, cardHeight - 8, 1, 1, "F");

    // Number badge
    pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
    pdf.circle(pageWidth - margin - 14, cardY + cardHeight / 2, 6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${index + 1}`, pageWidth - margin - 14, cardY + cardHeight / 2 + 2, { align: "center" });

    // Dimension name
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(ds.dimension.name_ar), pageWidth - margin - 25, cardY + cardHeight / 2 + 2, { align: "right" });

    // Percentage badge
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.roundedRect(margin + 5, cardY + 5, 35, cardHeight - 10, 6, 6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${Math.round(ds.percentage)}%`, margin + 22.5, cardY + cardHeight / 2 + 2, { align: "center" });

    yPos += cardHeight + 5;
  });

  yPos += 15;

  // Top 3 Recommendations Section
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("أهم ٣ توصيات"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 20;

  // Get top 3 priority recommendations (from lowest scoring dimensions)
  const priorityRecommendations = sortedByPriority.slice(0, 3).map((ds) => {
    const name = ds.dimension.name_ar;
    const percentage = ds.percentage;
    if (percentage < 50) {
      return `التركيز على بناء الأسس في "${name}" - الدرجة الحالية ${Math.round(percentage)}%`;
    } else if (percentage < 75) {
      return `تطوير ممارسات "${name}" للوصول للمستوى المثالي - الدرجة الحالية ${Math.round(percentage)}%`;
    } else {
      return `الحفاظ على التميز في "${name}" ومشاركة الممارسات الناجحة`;
    }
  });

  priorityRecommendations.forEach((rec, index) => {
    const cardY = yPos;
    const cardHeight = 26;

    // Card background
    pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
    pdf.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 4, 4, "F");

    // Left accent
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(pageWidth - margin - 3, cardY + 4, 2, cardHeight - 8, 1, 1, "F");

    // Number badge
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.circle(pageWidth - margin - 14, cardY + cardHeight / 2, 6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${index + 1}`, pageWidth - margin - 14, cardY + cardHeight / 2 + 2, { align: "center" });

    // Recommendation text
    const recText = renderText(rec);
    const maxWidth = pageWidth - margin * 2 - 35;
    const lines = pdf.splitTextToSize(recText, maxWidth);

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(lines[0], pageWidth - margin - 25, cardY + cardHeight / 2 + 2, { align: "right" });

    yPos += cardHeight + 5;
  });

  // ===================== PAGE 3: EXECUTIVE DASHBOARD =====================
  pdf.addPage();
  yPos = safeMargin;

  // Section title
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(18);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("ملخص الأداء العام"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 28;

  // Two main score boxes
  const dashboardBoxWidth = (pageWidth - margin * 2 - 12) / 2;
  const dashboardBoxHeight = 70;

  // Overall Score Box (Right side)
  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(pageWidth / 2 + 6, yPos, dashboardBoxWidth, dashboardBoxHeight, 6, 6, "FD");

  // Score gauge visualization
  const scoreValue = Math.round(assessment.overall_score || 0);
  const gaugeX = pageWidth / 2 + 6 + dashboardBoxWidth / 2;
  const gaugeY = yPos + dashboardBoxHeight / 2 + 8;
  const gaugeRadius = 25;

  // Draw gauge arc
  drawGaugeArc(gaugeX, gaugeY, gaugeRadius, scoreValue, colors.border, colors.primary);

  // Score value in center
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.text(`${scoreValue}%`, gaugeX, gaugeY + 3, { align: "center" });

  // Label
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("الدرجة الإجمالية"), gaugeX, yPos + 14, { align: "center" });

  // Maturity Level Box (Left side)
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  const maturityBgColor = maturity?.bgColor || colors.bgLight;

  pdf.setFillColor(maturityBgColor[0], maturityBgColor[1], maturityBgColor[2]);
  pdf.roundedRect(margin, yPos, dashboardBoxWidth, dashboardBoxHeight, 6, 6, "F");

  // Maturity label
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("مستوى النضج"), margin + dashboardBoxWidth / 2, yPos + 14, { align: "center" });

  // Maturity badge
  if (maturity) {
    const badgeX = margin + dashboardBoxWidth / 2;
    const badgeY = yPos + dashboardBoxHeight / 2 + 5;

    pdf.setFillColor(maturity.color[0], maturity.color[1], maturity.color[2]);
    pdf.roundedRect(badgeX - 28, badgeY - 12, 56, 22, 11, 11, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text(renderText(maturity.ar), badgeX, badgeY + 3, { align: "center" });
  }

  yPos += dashboardBoxHeight + 20;

  // ===================== RADAR CHART SECTION =====================
  // Section title
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(16);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("الرسم الراداري للمعايير"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 20;

  // Prepare radar data
  const radarData = dimensionScores.map((ds) => ({
    label: ds.dimension.name_ar,
    shortLabel: `م${ds.dimension.order_index}`,
    value: ds.percentage,
  }));

  // Draw radar chart
  const radarCenterX = pageWidth / 2;
  const radarCenterY = yPos + 55;
  const radarRadius = 45;

  drawRadarChart(radarCenterX, radarCenterY, radarRadius, radarData);

  yPos = radarCenterY + radarRadius + 25;

  // Dimension labels legend (below radar)
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

  const legendColWidth = (pageWidth - margin * 2) / 3;
  dimensionScores.forEach((ds, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = pageWidth - margin - col * legendColWidth - 5;
    const y = yPos + row * 10;

    // Colored dot
    const dotColor = getMaturityColor(ds.percentage);
    pdf.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
    pdf.circle(x, y - 1, 2, "F");

    // Label
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    const legendText = `م${ds.dimension.order_index}: ${ds.dimension.name_ar.substring(0, 20)}`;
    pdf.text(renderText(legendText), x - 5, y, { align: "right" });
  });

  yPos += Math.ceil(dimensionScores.length / 3) * 10 + 15;

  // Maturity levels legend
  pdf.setFontSize(8);
  const legendItems = [
    { label: "مثالي (75-100%)", color: colors.success },
    { label: "ناشئ (50-74%)", color: colors.warning },
    { label: "أساسي (0-49%)", color: colors.danger },
  ];

  const legendStartX = pageWidth - margin - 10;
  legendItems.forEach((item, index) => {
    const x = legendStartX - index * 55;

    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.circle(x, yPos, 2.5, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdf.text(renderText(item.label), x - 5, yPos + 1, { align: "right" });
  });

  // ===================== PAGE 3: DETAILED DATA TABLE =====================
  pdf.addPage();
  yPos = safeMargin;

  // Section title
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(16);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("تفاصيل نتائج المعايير"), pageWidth - margin - 8, yPos + 10, { align: "right" });

  yPos += 22;

  // Prepare table data
  const tableData = dimensionScores.map((ds) => {
    const status = getMaturityLabel(ds.percentage);
    const statusColor = getMaturityColor(ds.percentage);

    return {
      data: [
        renderText(status),
        `${Math.round(ds.percentage)}%`,
        `${ds.score} / ${ds.max_possible_score}`,
        renderText(ds.dimension.name_ar),
        ds.dimension.order_index.toString(),
      ],
      statusColor,
      percentage: ds.percentage,
    };
  });

  const tableOptions: UserOptions = {
    startY: yPos,
    head: [[renderText("الحالة"), renderText("النسبة"), renderText("الدرجة"), renderText("المعيار"), "#"]],
    body: tableData.map((row) => row.data),
    theme: "plain",
    styles: {
      font: arabicFont,
      halign: "center",
      valign: "middle",
      cellPadding: 6,
      fontSize: 10,
      lineColor: colors.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: colors.secondary,
      textColor: colors.white,
      fontSize: 11,
      font: arabicFont,
      halign: "center",
      fontStyle: "normal",
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 10,
      font: arabicFont,
      textColor: colors.text,
    },
    alternateRowStyles: {
      fillColor: colors.bgLight,
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 75, halign: "right" },
      4: { cellWidth: 14, halign: "center", fillColor: colors.bgLight },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Add colored status indicator and progress bar
      if (data.section === "body" && data.column.index === 0) {
        const rowIndex = data.row.index;
        const statusColor = tableData[rowIndex]?.statusColor || colors.textMuted;

        // Draw a small colored dot
        pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.circle(data.cell.x + data.cell.width - 6, data.cell.y + data.cell.height / 2, 2.5, "F");
      }

      // Add mini progress bar in percentage column
      if (data.section === "body" && data.column.index === 1) {
        const rowIndex = data.row.index;
        const percentage = tableData[rowIndex]?.percentage || 0;
        const barColor = tableData[rowIndex]?.statusColor || colors.textMuted;

        const barX = data.cell.x + 3;
        const barY = data.cell.y + data.cell.height - 5;
        const barW = data.cell.width - 6;
        const barH = 2;

        // Background
        pdf.setFillColor(colors.border[0], colors.border[1], colors.border[2]);
        pdf.roundedRect(barX, barY, barW, barH, 1, 1, "F");

        // Fill
        const fillW = (barW * percentage) / 100;
        pdf.setFillColor(barColor[0], barColor[1], barColor[2]);
        pdf.roundedRect(barX, barY, fillW, barH, 1, 1, "F");
      }
    },
  };

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable(tableOptions);
  } else {
    autoTable(pdf, tableOptions);
  }

  const finalY = pdf.lastAutoTable?.finalY;
  yPos = (typeof finalY === "number" ? finalY : yPos) + 20;

  // Maturity levels legend below table
  const tableLegendY = yPos;
  const tableLegendItems = [
    { label: "مثالي", range: "(75-100%)", color: colors.success },
    { label: "ناشئ", range: "(50-74%)", color: colors.warning },
    { label: "أساسي", range: "(0-49%)", color: colors.danger },
  ];

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(9);

  const tableLegendStartX = pageWidth - margin - 5;
  tableLegendItems.forEach((item, index) => {
    const x = tableLegendStartX - index * 60;

    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.roundedRect(x - 18, tableLegendY - 4, 20, 10, 5, 5, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text(renderText(item.label), x - 8, tableLegendY + 1.5, { align: "center" });

    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdf.text(renderText(item.range), x - 22, tableLegendY + 1.5, { align: "right" });
  });

  // ===================== PAGE 4: RECOMMENDATIONS & ROADMAP =====================
  pdf.addPage();
  yPos = safeMargin;

  // Render insights section as cards
  const renderInsightCard = (
    title: string,
    items: string[],
    accentColor: number[],
    iconSymbol: string,
    maxItems: number = 5,
    priorityBased: boolean = false,
  ) => {
    if (items.length === 0) return;

    checkPageBreak(50);

    // Section header with accent bar
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 16, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(title), pageWidth - margin - 8, yPos + 10, { align: "right" });

    // Priority note for recommendations
    if (priorityBased) {
      pdf.setFontSize(9);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText("(مرتبة حسب الأولوية)"), pageWidth - margin - 100, yPos + 10, { align: "right" });
    }

    yPos += 20;

    items.slice(0, maxItems).forEach((item, index) => {
      checkPageBreak(25);

      // Card background
      const cardHeight = 18;
      pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, cardHeight, 4, 4, "FD");

      // Left accent
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(pageWidth - margin - 3, yPos + 3, 2, cardHeight - 6, 1, 1, "F");

      // Number badge
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.circle(pageWidth - margin - 12, yPos + cardHeight / 2, 5, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${index + 1}`, pageWidth - margin - 12, yPos + cardHeight / 2 + 1.5, { align: "center" });

      // Content text
      const text = renderText(item);
      const maxWidth = pageWidth - margin * 2 - 30;
      const lines = pdf.splitTextToSize(text, maxWidth);

      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdf.text(lines[0], pageWidth - margin - 22, yPos + cardHeight / 2 + 2, { align: "right" });

      yPos += cardHeight + 5;
    });

    yPos += 10;
  };

  // Strengths section
  renderInsightCard("نقاط القوة", strengths, colors.success, "✓");

  // Opportunities section (sorted by priority - lowest scores first)
  const prioritizedOpportunities = sortedByPriority
    .filter((ds) => ds.percentage < 75)
    .map((ds) => {
      const name = ds.dimension.name_ar;
      const percentage = ds.percentage;
      if (percentage < 50) {
        return `بناء أساسيات "${name}" (${Math.round(percentage)}%)`;
      }
      return `تطوير "${name}" من ${Math.round(percentage)}% إلى مستوى أعلى`;
    });

  renderInsightCard(
    "فرص التحسين",
    prioritizedOpportunities.length > 0 ? prioritizedOpportunities : opportunities,
    colors.warning,
    "!",
    5,
    true,
  );

  // Recommendations section (sorted by priority)
  renderInsightCard("التوصيات العملية", recommendations, colors.primary, "→", 6, true);

  // ===================== FOOTER ON ALL PAGES =====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // Skip footer on cover page
    if (i === 1) continue;

    // Footer background strip
    pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
    pdf.rect(0, pageHeight - 18, pageWidth, 18, "F");

    // Top border line
    pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.setLineWidth(0.8);
    pdf.line(0, pageHeight - 18, pageWidth, pageHeight - 18);

    // Footer text
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);

    const footerText = renderText("منصة نُشارك للتقييم الذاتي | جميع الحقوق محفوظة");
    pdf.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" });

    // Page number badge
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(margin, pageHeight - 14, 24, 10, 2, 2, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${i} / ${pageCount}`, margin + 12, pageHeight - 7.5, { align: "center" });

    // Organization name in footer (if available)
    if (organization) {
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText(organization.name), pageWidth - margin, pageHeight - 8, { align: "right" });
    }
  }

  // ===================== DOWNLOAD =====================
  const fileName = `تقرير-نُشارك-${organization?.name || "التقييم"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = pdf.output("blob") as Blob;
    downloadPdfBlob(blob, fileName);
  } else {
    pdf.save(fileName);
  }
}
