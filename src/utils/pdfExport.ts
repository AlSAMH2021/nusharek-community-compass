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
  organization?: Organization | null
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
  let yPos = 25;

  // Brand colors - using tuples for jspdf-autotable compatibility
  type ColorTuple = [number, number, number];
  const colors = {
    primary: [20, 184, 166] as ColorTuple, // Teal
    primaryDark: [13, 148, 136] as ColorTuple,
    secondary: [15, 23, 42] as ColorTuple, // Dark slate
    text: [30, 41, 59] as ColorTuple,
    textMuted: [100, 116, 139] as ColorTuple,
    border: [226, 232, 240] as ColorTuple,
    bgLight: [248, 250, 252] as ColorTuple,
    white: [255, 255, 255] as ColorTuple,
    success: [21, 128, 61] as ColorTuple,
    warning: [180, 83, 9] as ColorTuple,
    danger: [185, 28, 28] as ColorTuple,
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
    color: number[] = colors.text
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
    if (yPos > pageHeight - neededSpace) {
      pdf.addPage();
      yPos = 25;
    }
  };

  // Draw decorative circle pattern
  const drawDecoPattern = (x: number, y: number, size: number, color: number[]) => {
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.3);
    pdf.circle(x, y, size, "S");
    pdf.circle(x, y, size * 0.7, "S");
    pdf.circle(x, y, size * 0.4, "S");
  };

  // ===================== HEADER =====================
  // Gradient-like header with primary color
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(0, 0, pageWidth, 55, "F");
  
  // Decorative darker strip
  pdf.setFillColor(colors.primaryDark[0], colors.primaryDark[1], colors.primaryDark[2]);
  pdf.rect(0, 48, pageWidth, 7, "F");

  // Decorative patterns
  drawDecoPattern(pageWidth - 25, 20, 12, [255, 255, 255]);
  drawDecoPattern(25, 35, 8, [255, 255, 255]);

  // Main title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(26);
  pdf.text(renderText("تقرير تقييم المشاركة المجتمعية"), pageWidth / 2, 25, { align: "center" });

  // Subtitle with badge effect
  pdf.setFontSize(13);
  pdf.setTextColor(255, 255, 255);
  pdf.text(renderText("منصة نُشارك للتقييم الذاتي"), pageWidth / 2, 40, { align: "center" });

  yPos = 68;

  // ===================== ORGANIZATION INFO CARD =====================
  const orgCardHeight = organization?.sector ? 38 : 30;
  
  // Card shadow effect
  pdf.setFillColor(200, 200, 200);
  pdf.roundedRect(margin + 1, yPos + 1, pageWidth - margin * 2, orgCardHeight, 4, 4, "F");
  
  // Main card
  pdf.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
  pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, orgCardHeight, 4, 4, "FD");

  // Left accent bar
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.roundedRect(pageWidth - margin - 4, yPos + 4, 3, orgCardHeight - 8, 1.5, 1.5, "F");

  yPos += 12;

  if (organization) {
    // Organization name
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(15);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(organization.name), pageWidth - margin - 10, yPos, { align: "right" });
    
    yPos += 9;
    
    // Organization details row
    const details: string[] = [];
    if (organization.type && orgTypeLabels[organization.type]) {
      details.push(orgTypeLabels[organization.type]);
    }
    if (organization.sector) {
      details.push(organization.sector);
    }
    if (organization.city) {
      details.push(organization.city);
    }
    
    if (details.length > 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
      pdf.text(renderText(details.join(" • ")), pageWidth - margin - 10, yPos, { align: "right" });
      yPos += 8;
    }
  }

  // Date badge
  const completedDate = assessment.completed_at
    ? new Date(assessment.completed_at).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "قيد التنفيذ";
  
  pdf.setFontSize(9);
  pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  const dateLabel = renderText(`تاريخ التقييم: ${completedDate}`);
  pdf.text(dateLabel, margin + 8, yPos - 2);

  yPos = organization?.sector ? yPos + 18 : yPos + 14;

  // ===================== SCORE SUMMARY SECTION =====================
  // Main score container
  const scoreBoxWidth = (pageWidth - margin * 2 - 8) / 2;
  const scoreBoxHeight = 55;
  
  // Overall Score Box (Right)
  pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  pdf.roundedRect(pageWidth / 2 + 4, yPos, scoreBoxWidth, scoreBoxHeight, 4, 4, "F");
  
  // Score circle background
  const scoreCircleX = pageWidth / 2 + 4 + scoreBoxWidth / 2;
  const scoreCircleY = yPos + scoreBoxHeight / 2 + 2;
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.circle(scoreCircleX, scoreCircleY, 18, "F");
  
  // Score value
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${Math.round(assessment.overall_score || 0)}%`, scoreCircleX, scoreCircleY + 3, { align: "center" });
  
  // Score label
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("الدرجة الإجمالية"), scoreCircleX, yPos + 10, { align: "center" });

  // Maturity Level Box (Left)
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  const maturityBgColor = maturity?.bgColor || colors.bgLight;
  
  pdf.setFillColor(maturityBgColor[0], maturityBgColor[1], maturityBgColor[2]);
  pdf.roundedRect(margin, yPos, scoreBoxWidth, scoreBoxHeight, 4, 4, "F");
  
  // Maturity badge
  const maturityBadgeX = margin + scoreBoxWidth / 2;
  const maturityBadgeY = yPos + scoreBoxHeight / 2 + 2;
  
  if (maturity) {
    // Badge background
    pdf.setFillColor(maturity.color[0], maturity.color[1], maturity.color[2]);
    pdf.roundedRect(maturityBadgeX - 22, maturityBadgeY - 10, 44, 18, 9, 9, "F");
    
    // Badge text
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(renderText(maturity.ar), maturityBadgeX, maturityBadgeY + 2, { align: "center" });
  } else {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(20);
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdf.text("—", maturityBadgeX, maturityBadgeY + 4, { align: "center" });
  }
  
  // Maturity label
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("مستوى النضج"), maturityBadgeX, yPos + 10, { align: "center" });

  yPos += scoreBoxHeight + 15;

  // ===================== DIMENSION SCORES TABLE =====================
  checkPageBreak(70);

  // Section header with line
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 14, "F");
  
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(16);
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text(renderText("تفاصيل نتائج المعايير"), pageWidth - margin - 8, yPos + 8, { align: "right" });
  
  yPos += 18;

  // Prepare table data with status colors
  const tableData = dimensionScores.map((ds) => {
    let status: string;
    let statusColor: number[];
    
    if (ds.percentage >= 75) {
      status = "مثالي";
      statusColor = colors.success;
    } else if (ds.percentage >= 50) {
      status = "ناشئ";
      statusColor = colors.warning;
    } else {
      status = "أساسي";
      statusColor = colors.danger;
    }
    
    return {
      data: [
        renderText(status),
        `${Math.round(ds.percentage)}%`,
        `${ds.score} / ${ds.max_possible_score}`,
        renderText(ds.dimension.name_ar),
        ds.dimension.order_index.toString(),
      ],
      statusColor,
    };
  });

  const tableOptions: UserOptions = {
    startY: yPos,
    head: [
      [
        renderText("الحالة"),
        renderText("النسبة"),
        renderText("الدرجة"),
        renderText("المعيار"),
        "#",
      ],
    ],
    body: tableData.map(row => row.data),
    theme: "plain",
    styles: {
      font: arabicFont,
      halign: "center",
      valign: "middle",
      cellPadding: 5,
      fontSize: 10,
      lineColor: colors.border,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: colors.secondary,
      textColor: colors.white,
      fontSize: 11,
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
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 72, halign: "right" },
      4: { cellWidth: 14, halign: "center", fillColor: colors.bgLight },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Add colored status indicator
      if (data.section === "body" && data.column.index === 0) {
        const rowIndex = data.row.index;
        const statusColor = tableData[rowIndex]?.statusColor || colors.textMuted;
        
        // Draw a small colored dot before status text
        pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.circle(data.cell.x + data.cell.width - 5, data.cell.y + data.cell.height / 2, 2, "F");
      }
    },
  };

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable(tableOptions);
  } else {
    autoTable(pdf, tableOptions);
  }

  const finalY = pdf.lastAutoTable?.finalY;
  yPos = (typeof finalY === "number" ? finalY : yPos) + 18;

  // ===================== MATURITY LEVELS LEGEND =====================
  checkPageBreak(25);
  
  const legendY = yPos;
  const legendItemWidth = 50;
  const legendStartX = pageWidth / 2 + (legendItemWidth * 1.5);
  
  pdf.setFontSize(9);
  
  // Legend items
  const legendItems = [
    { label: "مثالي (75-100%)", color: colors.success },
    { label: "ناشئ (50-74%)", color: colors.warning },
    { label: "أساسي (0-49%)", color: colors.danger },
  ];
  
  legendItems.forEach((item, index) => {
    const x = legendStartX - (index * legendItemWidth);
    
    // Color dot
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.circle(x, legendY, 2.5, "F");
    
    // Label
    pdf.setFont(arabicFont, "normal");
    pdf.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    pdf.text(renderText(item.label), x - 5, legendY + 1, { align: "right" });
  });
  
  yPos += 15;

  // ===================== INSIGHTS SECTIONS =====================
  const renderSection = (
    title: string,
    items: string[],
    accentColor: number[],
    maxItems: number = 5
  ) => {
    if (items.length === 0) return;

    checkPageBreak(45);

    // Section header with accent bar
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.rect(pageWidth - margin - 3, yPos - 2, 3, 14, "F");
    
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.text(renderText(title), pageWidth - margin - 8, yPos + 8, { align: "right" });
    
    yPos += 16;

    pdf.setFontSize(11);

    items.slice(0, maxItems).forEach((item, index) => {
      checkPageBreak(18);

      const text = renderText(item);
      const maxWidth = pageWidth - margin * 2 - 20;
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      // Numbered circle
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.circle(pageWidth - margin - 5, yPos + 1, 4, "F");
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${index + 1}`, pageWidth - margin - 5, yPos + 2.5, { align: "center" });

      // Content
      pdf.setFont(arabicFont, "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      
      lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
          pdf.text(line, pageWidth - margin - 12, yPos + 2, { align: "right" });
        } else {
          yPos += 6;
          checkPageBreak(10);
          pdf.text(line, pageWidth - margin - 12, yPos + 2, { align: "right" });
        }
      });

      yPos += 10;
    });

    yPos += 8;
  };

  // Strengths
  renderSection("نقاط القوة", strengths, colors.success);

  // Opportunities
  renderSection("فرص التحسين", opportunities, colors.warning);

  // Recommendations
  renderSection("التوصيات العملية", recommendations, colors.primary);

  // ===================== FOOTER =====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

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
    pdf.roundedRect(margin, pageHeight - 14, 20, 10, 2, 2, "F");
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${i} / ${pageCount}`, margin + 10, pageHeight - 7.5, { align: "center" });
  }

  // ===================== DOWNLOAD =====================
  const fileName = `تقرير-نُشارك-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = pdf.output("blob") as Blob;
    downloadPdfBlob(blob, fileName);
  } else {
    pdf.save(fileName);
  }
}
