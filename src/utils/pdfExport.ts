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

// مستويات النضج
const maturityLabels: Record<
  string,
  { ar: string; en: string; color: [number, number, number]; bgColor: [number, number, number] }
> = {
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
  // ---------------- PDF Setup ----------------
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as JsPdfWithAutoTable;

  let hasAmiri = false;
  try {
    const amiriFontBase64 = await loadAmiriFont();
    if (!pdf.addFileToVFS || !pdf.addFont) throw new Error("jsPDF font APIs not available");
    pdf.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    hasAmiri = true;
  } catch (error) {
    console.warn("Could not load Amiri font, falling back to helvetica:", error);
  }

  const arabicFont = hasAmiri ? "Amiri" : "helvetica";
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ---------------- Layout Tokens ----------------
  const layout = {
    margin: 20,
    yStart: 30,
    footerHeight: 25,
    sectionGap: 15,
  };

  const colors = {
    primary: [108, 58, 237] as [number, number, number],
    primaryLight: [139, 92, 246] as [number, number, number],
    secondary: [30, 58, 95] as [number, number, number],
    teal: [20, 184, 166] as [number, number, number],
    gold: [245, 158, 11] as [number, number, number],
    coral: [249, 115, 22] as [number, number, number],
    text: [30, 41, 59] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    bgLight: [248, 250, 252] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  };

  const typography = {
    title: 32,
    section: 16,
    h1: 20,
    h2: 14,
    body: 11,
    small: 9,
    micro: 7,
  };

  let yPos = layout.yStart;

  // ---------------- RTL text normalization ----------------
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
    for (const term of technicalTermsToStrip) out = out.replace(new RegExp(`\\b${term}\\b`, "gi"), " ");
    return out.replace(/\s+/g, " ").trim();
  };

  const mapWesternDigitsToArabic = (input: string): string =>
    input.replace(/[0-9]/g, (d) => westernToArabicDigitsMap[d] ?? d);

  const normalizePercents = (input: string): string => {
    let out = input;
    out = out.replace(/%\s*(\d+)/g, "$1%");
    out = out.replace(/%/g, "٪");
    out = out.replace(/(\d+\s*٪)\s*[-–—]\s*(\d+)(?!\s*٪)/g, "$1-$2٪");
    return out;
  };

  const stabilizePercentParentheses = (input: string): string => {
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

  const cleanedStrengths = strengths.map(normalizeForPdf).filter(Boolean);
  const cleanedOpportunities = opportunities.map(normalizeForPdf).filter(Boolean);
  const cleanedRecommendations = recommendations.map(normalizeForPdf).filter(Boolean);

  const renderText = (text: string): string => {
    const normalized = normalizeForPdf(text);
    return hasAmiri ? processArabicText(normalized) : normalized;
  };

  // ---------------- RTL support ----------------
  const basePdfText = pdf.text.bind(pdf);
  const rtlTextOptions = { isInputRtl: true, isOutputRtl: true, isSymmetricSwapping: true } as const;

  if (typeof (pdf as any).setR2L === "function") (pdf as any).setR2L(true);

  (pdf as any).text = (...args: any[]) => {
    const [text, x, y, options, ...rest] = args;
    if (options === undefined) return basePdfText(text, x, y, { ...rtlTextOptions } as any, ...rest);
    if (options && typeof options === "object" && !Array.isArray(options)) {
      return basePdfText(text, x, y, { ...options, ...rtlTextOptions } as any, ...rest);
    }
    return basePdfText(text, x, y, options, ...rest);
  };

  const pdfText = (text: string | string[], x: number, y: number, options: Record<string, unknown> = {}) => {
    basePdfText(text as any, x, y, { ...options, ...rtlTextOptions } as any);
  };

  const getMaturityColor = (percentage: number): [number, number, number] => {
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
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  };

  const checkPageBreak = (neededSpace: number = 40): boolean => {
    const availableSpace = pageHeight - layout.footerHeight;
    if (yPos + neededSpace > availableSpace) {
      pdf.addPage();
      yPos = layout.yStart;
      return true;
    }
    return false;
  };

  const drawSectionTitle = (title: string, accentColor: [number, number, number] = colors.primary) => {
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.roundedRect(pageWidth - layout.margin - 4, yPos, 4, 14, 2, 2, "F");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(typography.section);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdfText(renderText(title), pageWidth - layout.margin - 10, yPos + 10, { align: "right" });
    yPos += 22;
  };

  // ---------------- Section: Cover Page ----------------
  const drawCoverPage = async () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.rect(0, 0, pageWidth, 8, "F");
    pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");

    try {
      const logoResponse = await fetch("/src/assets/nusharek-logo.png");
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
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
      pdfText(renderText("نُشارك"), pageWidth / 2, 50, { align: "center" });
    }

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(typography.body);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdfText(renderText("منصة التقييم الذاتي للمشاركة المجتمعية"), pageWidth / 2, 62, {
      align: "center",
    });

    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(layout.margin + 30, 75, pageWidth - layout.margin - 30, 75);

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(typography.title);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdfText(renderText("تقرير نتائج التقييم"), pageWidth / 2, 110, { align: "center" });

    if (organization) {
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(typography.h1);
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdfText(renderText(organization.name), pageWidth / 2, 130, { align: "center" });

      if (organization.type && orgTypeLabels[organization.type]) {
        pdf.setFontSize(typography.body);
        pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        pdfText(renderText(orgTypeLabels[organization.type]), pageWidth / 2, 142, { align: "center" });
      }
    }

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
    pdfText(renderText(`${overallScore}٪`), pageWidth / 2, scoreBoxY + 32, { align: "center" });

    pdf.setFontSize(typography.body);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdfText(renderText("الدرجة الإجمالية"), pageWidth / 2, scoreBoxY + 45, { align: "center" });

    const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
    if (maturity) {
      const badgeY = scoreBoxY + scoreBoxHeight + 15;
      pdf.setFillColor(maturity.color[0], maturity.color[1], maturity.color[2]);
      pdf.roundedRect(pageWidth / 2 - 30, badgeY, 60, 22, 11, 11, "F");

      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(typography.h2);
      pdf.setTextColor(255, 255, 255);
      pdfText(renderText(maturity.ar), pageWidth / 2, badgeY + 14, { align: "center" });
    }

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(typography.body);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdfText(renderText(formatDate(assessment.completed_at)), pageWidth / 2, pageHeight - 30, {
      align: "center",
    });

    pdf.setFontSize(typography.small);
    pdfText(renderText("جميع الحقوق محفوظة © منصة نُشارك"), pageWidth / 2, pageHeight - 20, {
      align: "center",
    });
  };

  // ---------------- Section: Executive Summary ----------------
  const drawExecutiveSummary = () => {
    pdf.addPage();
    yPos = layout.yStart;

    drawSectionTitle("ملخص تنفيذي");

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(typography.body);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);

    const introText = organization
      ? `يعرض هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية لـ "${organization.name}".`
      : "يعرض هذا التقرير نتائج تقييم النضج في المشاركة المجتمعية.";
    const introLines = pdf.splitTextToSize(renderText(introText), pageWidth - layout.margin * 2);
    introLines.forEach((line: string) => {
      pdfText(line, pageWidth - layout.margin, yPos, { align: "right" });
      yPos += 6;
    });
    yPos += 10;

    const cardWidth = (pageWidth - layout.margin * 2 - 20) / 3;
    const cardHeight = 45;

    const overallScore = Math.round(assessment.overall_score || 0);
    const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;

    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(pageWidth - layout.margin - cardWidth, yPos, cardWidth, cardHeight, 6, 6, "F");
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdfText(renderText(`${overallScore}٪`), pageWidth - layout.margin - cardWidth / 2, yPos + 25, {
      align: "center",
    });
    pdf.setFontSize(typography.small);
    pdfText(renderText("الدرجة الإجمالية"), pageWidth - layout.margin - cardWidth / 2, yPos + 38, {
      align: "center",
    });

    const maturityCardColor = maturity?.color || colors.textMuted;
    pdf.setFillColor(maturityCardColor[0], maturityCardColor[1], maturityCardColor[2]);
    pdf.roundedRect(pageWidth - layout.margin - cardWidth * 2 - 10, yPos, cardWidth, cardHeight, 6, 6, "F");
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdfText(renderText(maturity?.ar || "—"), pageWidth - layout.margin - cardWidth * 1.5 - 10, yPos + 25, {
      align: "center",
    });
    pdf.setFontSize(typography.small);
    pdfText(renderText("مستوى النضج"), pageWidth - layout.margin - cardWidth * 1.5 - 10, yPos + 38, {
      align: "center",
    });

    pdf.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    pdf.roundedRect(layout.margin, yPos, cardWidth, cardHeight, 6, 6, "F");
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdfText(renderText(`${dimensionScores.length}`), layout.margin + cardWidth / 2, yPos + 25, {
      align: "center",
    });
    pdf.setFontSize(typography.small);
    pdfText(renderText("معايير التقييم"), layout.margin + cardWidth / 2, yPos + 38, {
      align: "center",
    });

    yPos += cardHeight + 25;

    const renderSummaryItem = (ds: DimensionScore, index: number, accentColor: [number, number, number]) => {
      checkPageBreak(25);
      const itemY = yPos;

      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.circle(pageWidth - layout.margin - 8, itemY, 5, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(typography.small);
      pdfText(renderText(`${index + 1}`), pageWidth - layout.margin - 8, itemY + 2, { align: "center" });

      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdfText(renderText(ds.dimension.name_ar), pageWidth - layout.margin - 18, itemY + 2, { align: "right" });

      const pctColor = getMaturityColor(ds.percentage);
      pdf.setFillColor(pctColor[0], pctColor[1], pctColor[2]);
      pdf.roundedRect(layout.margin, itemY - 5, 30, 12, 6, 6, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(8);
      pdfText(renderText(`${Math.round(ds.percentage)}٪`), layout.margin + 15, itemY + 2, { align: "center" });

      yPos += 18;
    };

    drawSectionTitle("أبرز نقاط القوة", colors.teal);
    [...dimensionScores]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
      .forEach((ds, index) => renderSummaryItem(ds, index, colors.teal));

    yPos += 15;

    drawSectionTitle("أهم فرص التحسين", colors.coral);
    [...dimensionScores]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3)
      .forEach((ds, index) => renderSummaryItem(ds, index, colors.coral));
  };

  // ---------------- Section: Dimensions Table ----------------
  const drawDimensionsTable = () => {
    pdf.addPage();
    yPos = layout.yStart;

    drawSectionTitle("تفاصيل نتائج المعايير");

    const tableData = dimensionScores.map((ds) => ({
      data: [
        renderText(getMaturityLabel(ds.percentage)),
        renderText(`${Math.round(ds.percentage)}٪`),
        renderText(`${ds.score} / ${ds.max_possible_score}`),
        renderText(ds.dimension.name_ar),
        renderText(ds.dimension.order_index.toString()),
      ],
      statusColor: getMaturityColor(ds.percentage),
      percentage: ds.percentage,
    }));

    const tableOptions: UserOptions = {
      startY: yPos,
      head: [[renderText("الحالة"), renderText("النسبة"), renderText("الدرجة"), renderText("المعيار"), "#"]],
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
        0: { cellWidth: 26, halign: "center" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 78, halign: "right" },
        4: { cellWidth: 14, halign: "center", fillColor: colors.bgLight },
      },
      margin: { left: layout.margin, right: layout.margin },
      tableWidth: "auto",
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const rowIndex = data.row.index;
          const statusColor = tableData[rowIndex]?.statusColor || colors.textMuted;
          pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.circle(data.cell.x + data.cell.width - 5, data.cell.y + data.cell.height / 2, 2, "F");
        }

        if (data.section === "body" && data.column.index === 1) {
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
          const fillX = barX + (barW - fillW);
          pdf.roundedRect(fillX, barY, fillW, barH, 1, 1, "F");
        }
      },
    };

    if (typeof pdf.autoTable === "function") pdf.autoTable(tableOptions);
    else autoTable(pdf, tableOptions);

    const finalY = pdf.lastAutoTable?.finalY;
    yPos = (typeof finalY === "number" ? finalY : yPos) + 15;

    const legendItems = [
      { label: "مثالي", range: "75%-100%", color: colors.teal },
      { label: "ناشئ", range: "50%-74%", color: colors.gold },
      { label: "أساسي", range: "0%-49%", color: colors.coral },
    ];

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(8);

    legendItems.forEach((item, index) => {
      const x = pageWidth - layout.margin - 10 - index * 55;
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.circle(x, yPos, 3, "F");
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdfText(renderText(`${item.label} (${item.range})`), x - 6, yPos + 2, { align: "right" });
    });
  };

  // ---------------- Section: Recommendations ----------------
  const drawRecommendations = () => {
    pdf.addPage();
    yPos = layout.yStart;

    const renderListItem = (item: string, index: number, accentColor: [number, number, number]) => {
      const maxWidth = pageWidth - layout.margin * 2 - 28;
      const lines = pdf.splitTextToSize(renderText(item), maxWidth);
      const lineHeight = 5;
      const itemHeight = Math.max(20, 12 + lines.length * lineHeight);

      checkPageBreak(itemHeight + 5);

      pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
      pdf.roundedRect(layout.margin, yPos - 4, pageWidth - layout.margin * 2, itemHeight - 2, 4, 4, "F");

      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(pageWidth - layout.margin - 3, yPos, 3, itemHeight - 10, 1.5, 1.5, "F");

      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.circle(pageWidth - layout.margin - 12, yPos + 4, 4, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(8);
      pdfText(renderText(`${index + 1}`), pageWidth - layout.margin - 12, yPos + 6, { align: "center" });

      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

      let textY = yPos + 6;
      lines.forEach((line: string) => {
        pdfText(line, pageWidth - layout.margin - 20, textY, { align: "right" });
        textY += lineHeight;
      });

      yPos += itemHeight;
    };

    if (cleanedStrengths.length > 0) {
      checkPageBreak(45);
      drawSectionTitle("نقاط القوة", colors.teal);
      cleanedStrengths.slice(0, 5).forEach((item, index) => renderListItem(item, index, colors.teal));
      yPos += 12;
    }

    if (cleanedOpportunities.length > 0) {
      checkPageBreak(45);
      drawSectionTitle("فرص التحسين", colors.gold);
      cleanedOpportunities.slice(0, 5).forEach((item, index) => renderListItem(item, index, colors.gold));
      yPos += 12;
    }

    if (cleanedRecommendations.length > 0) {
      checkPageBreak(45);
      drawSectionTitle("التوصيات العملية", colors.primary);
      cleanedRecommendations.slice(0, 6).forEach((item, index) => renderListItem(item, index, colors.primary));
    }

    yPos += 10;
  };

  // ---------------- Footer ----------------
  const drawFooter = () => {
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      if (i === 1) continue;

      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(0.5);
      pdf.line(layout.margin, pageHeight - 18, pageWidth - layout.margin, pageHeight - 18);

      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdfText(renderText("منصة نُشارك للتقييم الذاتي"), pageWidth / 2, pageHeight - 10, {
        align: "center",
      });

      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.roundedRect(pageWidth - layout.margin - 20, pageHeight - 14, 20, 8, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(7);
      pdfText(renderText(`${i} / ${pageCount}`), pageWidth - layout.margin - 10, pageHeight - 9, {
        align: "center",
      });

      if (organization) {
        pdf.setFont(arabicFont, "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
        pdfText(renderText(organization.name), layout.margin, pageHeight - 10, { align: "left" });
      }
    }
  };

  // ---------------- Render Pipeline ----------------
  await drawCoverPage();
  drawExecutiveSummary();
  drawDimensionsTable();
  drawRecommendations();
  drawFooter();

  // ---------------- Save ----------------
  const fileName = `تقرير-نُشارك-${organization?.name || "التقييم"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = pdf.output("blob") as Blob;
    downloadPdfBlob(blob, fileName);
  } else {
    pdf.save(fileName);
  }
}
