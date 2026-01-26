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

// المستويات الثلاثة
const maturityLabels: Record<string, { ar: string; en: string; color: number[]; bgColor: number[] }> = {
  beginner: { ar: "أساسي", en: "Basic", color: [185, 28, 28], bgColor: [254, 226, 226] },
  developing: { ar: "ناشئ", en: "Emerging", color: [180, 83, 9], bgColor: [254, 243, 199] },
  leading: { ar: "مثالي", en: "Ideal", color: [21, 128, 61], bgColor: [220, 252, 231] },
};

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
  const margin = 20;
  let yPos = 30;

  // ---------------- Text normalization (numbers/percents/technical terms) ----------------
  const westernToArabicDigitsMap: Record<string, string> = {
    "0": "٠",
    "1": "١",
    "2": "٢",
    "3": "٣",
    "4": "٤",
    "5": "٥",
    "6": "٦",
    "7": "٧",
    "8": "٨",
    "9": "٩",
  };

  const technicalTermsToStrip = [
    "word-break-all",
    "overflow-wrap",
    "break-word",
    "break-all",
    "white-space",
    "text-overflow",
  ];

  const stripTechnicalTerms = (input: string): string => {
    if (!input) return input;
    let out = input;
    for (const term of technicalTermsToStrip) {
      out = out.replace(new RegExp(`\\b${term}\\b`, "gi"), " ");
    }
    return out.replace(/\s+/g, " ").trim();
  };

  const mapWesternDigitsToArabic = (input: string): string =>
    input.replace(/[0-9]/g, (d) => westernToArabicDigitsMap[d] ?? d);

  const normalizePercents = (input: string): string => {
    // 52%  -> 52٪
    // %52  -> 52٪
    // %75-100 -> 75٪-100٪
    // 75%-100% -> 75٪-100٪
    let out = input;

    // Convert leading percent before number to trailing percent
    out = out.replace(/%\s*(\d+)/g, "$1%");

    // Normalize percent sign to Arabic percent
    out = out.replace(/%/g, "٪");

    // Ensure ranges have percent on both ends: 75٪-100 -> 75٪-100٪
    out = out.replace(/(\d+\s*٪)\s*[-–—]\s*(\d+)(?!\s*٪)/g, "$1-$2٪");

    return out;
  };

  const stabilizePercentParentheses = (input: string): string => {
    // Wrap parenthetical % blocks with RLM to keep parentheses in correct visual order
    const RLM = "\u200F";
    return input.replace(/\(([^)]*٪[^)]*)\)/g, (_, inner) => `${RLM}(${inner})${RLM}`);
  };

  const normalizeForPdf = (input: string): string => {
    let out = stripTechnicalTerms(input);
    out = normalizePercents(out);
    out = mapWesternDigitsToArabic(out);
    out = stabilizePercentParentheses(out);
    return out;
  };

  // Clean lists BEFORE processing (explicit user requirement)
  const cleanedStrengths = strengths.map(normalizeForPdf).filter(Boolean);
  const cleanedOpportunities = opportunities.map(normalizeForPdf).filter(Boolean);
  const cleanedRecommendations = recommendations.map(normalizeForPdf).filter(Boolean);

  // Brand colors
  type ColorTuple = [number, number, number];
  const colors = {
    primary: [108, 58, 237] as ColorTuple,
    primaryLight: [139, 92, 246] as ColorTuple,
    secondary: [30, 58, 95] as ColorTuple,
    teal: [20, 184, 166] as ColorTuple,
    gold: [245, 158, 11] as ColorTuple,
    coral: [249, 115, 22] as ColorTuple,
    text: [30, 41, 59] as ColorTuple,
    textMuted: [100, 116, 139] as ColorTuple,
    border: [226, 232, 240] as ColorTuple,
    bgLight: [248, 250, 252] as ColorTuple,
    white: [255, 255, 255] as ColorTuple,
  };

  const renderText = (text: string): string => {
    const normalized = normalizeForPdf(text);
    return hasAmiri ? processArabicText(normalized) : normalized;
  };

  const getMaturityColor = (percentage: number): ColorTuple => {
    if (percentage >= 75) return colors.teal;
    if (percentage >= 50) return colors.gold;
    return colors.coral;
  };

  const getMaturityLabel = (percentage: number): string => {
    if (percentage >= 75) return "مثالي";
    if (percentage >= 50) return "ناشئ";
    return "أساسي";
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  };

  // Footer takes ~22mm at the bottom (18mm visible + margin buffer)
  const footerHeight = 25;
  
  const checkPageBreak = (neededSpace: number = 40): boolean => {
    const availableSpace = pageHeight - footerHeight;
    if (yPos + neededSpace > availableSpace) {
      pdf.addPage();
      yPos = 30;
      return true;
    }
    return false;
  };

  // RTL Section Title - accent bar on right side
  const drawSectionTitle = (title: string, accentColor: ColorTuple = colors.primary) => {
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.roundedRect(pageWidth - margin - 4, yPos, 4, 14, 2, 2, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(16);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(title), pageWidth - margin - 10, yPos + 10, { align: "right" });
    yPos += 22;
  };

  // ===================== صفحة الغلاف =====================
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // شريط علوي بنفسجي
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(0, 0, pageWidth, 8, "F");

  // شريط سفلي بنفسجي
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");

  // الشعار
  try {
    const logoResponse = await fetch("/src/assets/nusharek-logo.png");
    const logoBlob = await logoResponse.blob();
    const logoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(logoBlob);
    });

    const logoWidth = 50;
    const logoHeight = 18;
    const logoX = (pageWidth - logoWidth) / 2;
    pdf.addImage(logoBase64, "PNG", logoX, 35, logoWidth, logoHeight);
  } catch {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(28);
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(renderText("نُشارك"), pageWidth / 2, 50, { align: "center" });
  }

  // الشعار الفرعي
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  pdf.text(renderText("منصة التقييم الذاتي للمشاركة المجتمعية"), pageWidth / 2, 62, { align: "center" });

  // خط فاصل
  pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  pdf.setLineWidth(0.5);
  pdf.line(margin + 30, 75, pageWidth - margin - 30, 75);

  // عنوان التقرير
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(32);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("تقرير نتائج التقييم"), pageWidth / 2, 110, { align: "center" });

  // اسم المنظمة
  if (organization) {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(20);
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(renderText(organization.name), pageWidth / 2, 130, { align: "center" });

    if (organization.type && orgTypeLabels[organization.type]) {
      pdf.setFontSize(12);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText(orgTypeLabels[organization.type]), pageWidth / 2, 142, { align: "center" });
    }
  }

  // مربع النتيجة الرئيسية
  const scoreBoxY = 165;
  const scoreBoxWidth = 100;
  const scoreBoxHeight = 50;
  const scoreBoxX = (pageWidth - scoreBoxWidth) / 2;

  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setLineWidth(1.5);
  pdf.roundedRect(scoreBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight, 8, 8, "FD");

  const overallScore = Math.round(assessment.overall_score || 0);
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(36);
  pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.text(renderText(`${overallScore}٪`), pageWidth / 2, scoreBoxY + 32, { align: "center" });

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  pdf.text(renderText("الدرجة الإجمالية"), pageWidth / 2, scoreBoxY + 45, { align: "center" });

  // شارة مستوى النضج
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  if (maturity) {
    const badgeY = scoreBoxY + scoreBoxHeight + 15;
    pdf.setFillColor(maturity.color[0], maturity.color[1], maturity.color[2]);
    pdf.roundedRect(pageWidth / 2 - 30, badgeY, 60, 22, 11, 11, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(renderText(maturity.ar), pageWidth / 2, badgeY + 14, { align: "center" });
  }

  // التاريخ
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  pdf.text(renderText(formatDate(assessment.completed_at)), pageWidth / 2, pageHeight - 30, { align: "center" });

  // حقوق النشر
  pdf.setFontSize(9);
  pdf.text(renderText("جميع الحقوق محفوظة © منصة نُشارك"), pageWidth / 2, pageHeight - 20, { align: "center" });

  // ===================== صفحة 2: ملخص تنفيذي =====================
  pdf.addPage();
  yPos = 30;

  drawSectionTitle("ملخص تنفيذي");

  // مقدمة - RTL aligned
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  const introText = organization
    ? `يعرض هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية لـ "${organization.name}".`
    : "يعرض هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية.";
  const introLines = pdf.splitTextToSize(renderText(introText), pageWidth - margin * 2);
  introLines.forEach((line: string) => {
    pdf.text(line, pageWidth - margin, yPos, { align: "right" });
    yPos += 6;
  });
  yPos += 10;

  // بطاقات الإحصائيات الرئيسية - RTL order (right to left)
  const cardWidth = (pageWidth - margin * 2 - 20) / 3;
  const cardHeight = 45;

  // بطاقة الدرجة (أقصى اليمين)
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.roundedRect(pageWidth - margin - cardWidth, yPos, cardWidth, cardHeight, 6, 6, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text(renderText(`${overallScore}٪`), pageWidth - margin - cardWidth / 2, yPos + 25, { align: "center" });

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(9);
  pdf.text(renderText("الدرجة الإجمالية"), pageWidth - margin - cardWidth / 2, yPos + 38, { align: "center" });

  // بطاقة المستوى (الوسط)
  const maturityCardColor = maturity?.color || colors.textMuted;
  pdf.setFillColor(maturityCardColor[0], maturityCardColor[1], maturityCardColor[2]);
  pdf.roundedRect(pageWidth - margin - cardWidth * 2 - 10, yPos, cardWidth, cardHeight, 6, 6, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(renderText(maturity?.ar || "—"), pageWidth - margin - cardWidth * 1.5 - 10, yPos + 25, { align: "center" });

  pdf.setFontSize(9);
  pdf.text(renderText("مستوى النضج"), pageWidth - margin - cardWidth * 1.5 - 10, yPos + 38, { align: "center" });

  // بطاقة عدد المعايير (أقصى اليسار)
  pdf.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.roundedRect(margin, yPos, cardWidth, cardHeight, 6, 6, "F");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text(renderText(`${dimensionScores.length}`), margin + cardWidth / 2, yPos + 25, { align: "center" });

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(9);
  pdf.text(renderText("معايير التقييم"), margin + cardWidth / 2, yPos + 38, { align: "center" });

  yPos += cardHeight + 25;

  // أفضل 3 نتائج - RTL layout
  // Helper function to render summary list item
  const renderSummaryItem = (ds: DimensionScore, index: number, accentColor: ColorTuple) => {
    checkPageBreak(25);
    const itemY = yPos;

    // رقم الترتيب (على اليمين)
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.circle(pageWidth - margin - 8, itemY, 5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.text(renderText(`${index + 1}`), pageWidth - margin - 8, itemY + 2, { align: "center" });

    // اسم المعيار (يمين الرقم)
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(ds.dimension.name_ar), pageWidth - margin - 18, itemY + 2, { align: "right" });

    // النسبة (على اليسار)
    const pctColor = getMaturityColor(ds.percentage);
    pdf.setFillColor(pctColor[0], pctColor[1], pctColor[2]);
    pdf.roundedRect(margin, itemY - 5, 30, 12, 6, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.text(renderText(`${Math.round(ds.percentage)}٪`), margin + 15, itemY + 2, { align: "center" });

    yPos += 18;
  };

  checkPageBreak(80); // Space for title + 3 items
  drawSectionTitle("أبرز نقاط القوة", colors.teal);

  const top3 = [...dimensionScores].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  top3.forEach((ds, index) => {
    renderSummaryItem(ds, index, colors.teal);
  });

  yPos += 15;

  // أهم فرص التحسين - RTL layout
  checkPageBreak(80); // Space for title + 3 items
  drawSectionTitle("أهم فرص التحسين", colors.coral);

  const bottom3 = [...dimensionScores].sort((a, b) => a.percentage - b.percentage).slice(0, 3);
  bottom3.forEach((ds, index) => {
    renderSummaryItem(ds, index, colors.coral);
  });

  // ===================== صفحة 3: تفاصيل المعايير =====================
  pdf.addPage();
  yPos = 30;

  drawSectionTitle("تفاصيل نتائج المعايير");

  // جدول النتائج - RTL column order (right to left: #, المعيار, الدرجة, النسبة, الحالة)
  const tableData = dimensionScores.map((ds) => ({
    data: [
      renderText(ds.dimension.order_index.toString()),
      renderText(ds.dimension.name_ar),
      renderText(`${ds.score} / ${ds.max_possible_score}`),
      renderText(`${Math.round(ds.percentage)}٪`),
      renderText(getMaturityLabel(ds.percentage)),
    ],
    statusColor: getMaturityColor(ds.percentage),
    percentage: ds.percentage,
  }));

  const tableOptions: UserOptions = {
    startY: yPos,
    head: [["#", renderText("المعيار"), renderText("الدرجة"), renderText("النسبة"), renderText("الحالة")]],
    body: tableData.map((row) => row.data),
    theme: "plain",
    styles: {
      font: arabicFont,
      halign: "center",
      valign: "middle",
      cellPadding: 5,
      fontSize: 10,
      lineColor: colors.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: colors.primary,
      textColor: colors.white,
      fontSize: 10,
      font: arabicFont,
      halign: "center",
      fontStyle: "normal",
      cellPadding: 6,
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
      0: { cellWidth: 14, halign: "center", fillColor: colors.bgLight },
      1: { cellWidth: 78, halign: "right" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 26, halign: "center" },
    },
    margin: { left: margin, right: margin },
    tableWidth: "auto",
    didDrawCell: (data) => {
      // Status color indicator
      if (data.section === "body" && data.column.index === 4) {
        const rowIndex = data.row.index;
        const statusColor = tableData[rowIndex]?.statusColor || colors.textMuted;
        pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.circle(data.cell.x + 5, data.cell.y + data.cell.height / 2, 2, "F");
      }

      // Progress bar in percentage column
      if (data.section === "body" && data.column.index === 3) {
        const rowIndex = data.row.index;
        const percentage = tableData[rowIndex]?.percentage || 0;
        const barColor = tableData[rowIndex]?.statusColor || colors.textMuted;

        const barX = data.cell.x + 2;
        const barY = data.cell.y + data.cell.height - 4;
        const barW = data.cell.width - 4;
        const barH = 2;

        pdf.setFillColor(colors.border[0], colors.border[1], colors.border[2]);
        pdf.roundedRect(barX, barY, barW, barH, 1, 1, "F");

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
  yPos = (typeof finalY === "number" ? finalY : yPos) + 15;

  // مفتاح الألوان - RTL order
  const legendItems = [
    { label: "مثالي", range: "75%-100%", color: colors.teal },
    { label: "ناشئ", range: "50%-74%", color: colors.gold },
    { label: "أساسي", range: "0%-49%", color: colors.coral },
  ];

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(8);

  legendItems.forEach((item, index) => {
    const x = pageWidth - margin - 10 - index * 55;

    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.circle(x, yPos, 3, "F");

    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(`${item.label} (${item.range})`), x - 6, yPos + 2, { align: "right" });
  });

  // ===================== صفحة 4: التوصيات =====================
  pdf.addPage();
  yPos = 30;

  // Helper function for RTL list items with dynamic height
  const renderListItem = (item: string, index: number, accentColor: ColorTuple) => {
    // Calculate how many lines this text will take (after normalization)
    const maxWidth = pageWidth - margin * 2 - 28;
    const lines = pdf.splitTextToSize(renderText(item), maxWidth);
    const lineHeight = 5;
    const itemHeight = Math.max(20, 12 + lines.length * lineHeight);
    
    // Check if we need a new page BEFORE drawing (with extra buffer for footer)
    checkPageBreak(itemHeight + 5);

    // خلفية البطاقة - dynamic height based on content
    pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
    pdf.roundedRect(margin, yPos - 4, pageWidth - margin * 2, itemHeight - 2, 4, 4, "F");

    // شريط ملون على اليمين (RTL)
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.roundedRect(pageWidth - margin - 3, yPos, 3, itemHeight - 10, 1.5, 1.5, "F");

    // رقم الترتيب (على اليمين)
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.circle(pageWidth - margin - 12, yPos + 4, 4, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(8);
    pdf.text(renderText(`${index + 1}`), pageWidth - margin - 12, yPos + 6, { align: "center" });

    // النص (يمين الرقم) - support multi-line
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    
    let textY = yPos + 6;
    lines.forEach((line: string) => {
      pdf.text(line, pageWidth - margin - 20, textY, { align: "right" });
      textY += lineHeight;
    });

    yPos += itemHeight;
  };

  // نقاط القوة
  if (cleanedStrengths.length > 0) {
    checkPageBreak(45); // Ensure space for title + at least one item
    drawSectionTitle("نقاط القوة", colors.teal);
    cleanedStrengths.slice(0, 5).forEach((item, index) => {
      renderListItem(item, index, colors.teal);
    });
    yPos += 12;
  }

  // فرص التحسين
  if (cleanedOpportunities.length > 0) {
    checkPageBreak(45); // Ensure space for title + at least one item
    drawSectionTitle("فرص التحسين", colors.gold);
    cleanedOpportunities.slice(0, 5).forEach((item, index) => {
      renderListItem(item, index, colors.gold);
    });
    yPos += 12;
  }

  // التوصيات
  if (cleanedRecommendations.length > 0) {
    checkPageBreak(45); // Ensure space for title + at least one item
    drawSectionTitle("التوصيات العملية", colors.primary);
    cleanedRecommendations.slice(0, 6).forEach((item, index) => {
      renderListItem(item, index, colors.primary);
    });
  }
  
  // Add final spacing before footer on last content page
  yPos += 10;

  // ===================== الفوتر على جميع الصفحات =====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    if (i === 1) continue;

    // خط علوي للفوتر
    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    // نص الفوتر (وسط)
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdf.text(renderText("منصة نُشارك للتقييم الذاتي"), pageWidth / 2, pageHeight - 10, { align: "center" });

    // رقم الصفحة (على اليمين - RTL)
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(pageWidth - margin - 20, pageHeight - 14, 20, 8, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(7);
    pdf.text(renderText(`${i} / ${pageCount}`), pageWidth - margin - 10, pageHeight - 9, { align: "center" });

    // اسم المنظمة (على اليسار - RTL)
    if (organization) {
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText(organization.name), margin, pageHeight - 10, { align: "left" });
    }
  }

  // ===================== التحميل =====================
  const fileName = `تقرير-نُشارك-${organization?.name || "التقييم"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = pdf.output("blob") as Blob;
    downloadPdfBlob(blob, fileName);
  } else {
    pdf.save(fileName);
  }
}
