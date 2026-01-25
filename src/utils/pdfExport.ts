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
}

// المستويات الثلاثة: أساسي (0-49%) - ناشئ (50-74%) - مثالي (75-100%)
const maturityLabels: Record<string, { ar: string; en: string; color: number[] }> = {
  beginner: { ar: "أساسي", en: "Basic", color: [239, 68, 68] },
  developing: { ar: "ناشئ", en: "Emerging", color: [249, 115, 22] },
  leading: { ar: "مثالي", en: "Ideal", color: [34, 197, 94] },
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
  const margin = 20;
  let yPos = 25;

  // Helper function for Arabic text
  const renderText = (text: string): string => {
    return hasAmiri ? processArabicText(text) : text;
  };

  const addText = (
    text: string,
    y: number,
    fontSize: number = 12,
    align: "right" | "center" | "left" = "right",
    color: number[] = [0, 0, 0]
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

  // ===================== HEADER =====================
  // Background header box
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 50, "F");

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(24);
  pdf.text(renderText("تقرير تقييم المشاركة المجتمعية"), pageWidth / 2, 22, { align: "center" });

  // Subtitle
  pdf.setFontSize(14);
  pdf.setTextColor(148, 163, 184);
  pdf.text(renderText("منصة نُشارك"), pageWidth / 2, 35, { align: "center" });

  yPos = 60;

  // ===================== ORGANIZATION INFO =====================
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 3, 3, "F");

  yPos += 12;

  if (organization) {
    addText(`المنظمة: ${organization.name}`, yPos, 13, "right", [30, 41, 59]);
    yPos += 10;
    if (organization.sector) {
      addText(`القطاع: ${organization.sector}`, yPos, 11, "right", [100, 116, 139]);
      yPos += 8;
    }
  }

  const completedDate = assessment.completed_at
    ? new Date(assessment.completed_at).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "قيد التنفيذ";
  addText(`تاريخ التقييم: ${completedDate}`, yPos, 11, "right", [100, 116, 139]);

  yPos += 25;

  // ===================== OVERALL SCORE SECTION =====================
  pdf.setFillColor(239, 246, 255);
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 50, 4, 4, "FD");

  const boxCenterY = yPos + 25;
  const leftBoxX = margin + 45;
  const rightBoxX = pageWidth - margin - 45;

  // Overall Score (Right side)
  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(100, 116, 139);
  pdf.text(renderText("الدرجة الإجمالية"), rightBoxX, boxCenterY - 12, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(36);
  pdf.setTextColor(30, 64, 175);
  pdf.text(`${Math.round(assessment.overall_score || 0)}%`, rightBoxX, boxCenterY + 8, { align: "center" });

  // Divider line
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(pageWidth / 2, yPos + 10, pageWidth / 2, yPos + 40);

  // Maturity Level (Left side)
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(100, 116, 139);
  pdf.text(renderText("مستوى النضج"), leftBoxX, boxCenterY - 12, { align: "center" });

  if (maturity) {
    pdf.setTextColor(maturity.color[0], maturity.color[1], maturity.color[2]);
  } else {
    pdf.setTextColor(0, 0, 0);
  }
  pdf.setFontSize(26);
  pdf.text(renderText(maturity?.ar || "—"), leftBoxX, boxCenterY + 8, { align: "center" });

  yPos += 60;

  // ===================== DIMENSION SCORES TABLE =====================
  checkPageBreak(60);

  addText("نتائج المعايير", yPos, 16, "right", [30, 64, 175]);
  yPos += 8;

  const tableData = dimensionScores.map((ds) => {
    const status = ds.percentage >= 75 ? "ممتاز" : ds.percentage >= 50 ? "جيد" : ds.percentage >= 25 ? "يحتاج تحسين" : "ضعيف";
    return [
      renderText(status),
      `${Math.round(ds.percentage)}%`,
      `${ds.score} / ${ds.max_possible_score}`,
      renderText(ds.dimension.name_ar),
      ds.dimension.order_index.toString(),
    ];
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
    body: tableData,
    theme: "grid",
    styles: {
      font: arabicFont,
      halign: "center",
      valign: "middle",
      cellPadding: 4,
      fontSize: 10,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontSize: 11,
      font: arabicFont,
      halign: "center",
      fontStyle: "normal",
    },
    bodyStyles: {
      fontSize: 10,
      font: arabicFont,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 70, halign: "right" },
      4: { cellWidth: 12, halign: "center" },
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
  };

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable(tableOptions);
  } else {
    autoTable(pdf, tableOptions);
  }

  const finalY = pdf.lastAutoTable?.finalY;
  yPos = (typeof finalY === "number" ? finalY : yPos) + 15;

  // ===================== INSIGHTS SECTIONS =====================
  const renderSection = (
    title: string,
    items: string[],
    titleColor: number[],
    iconColor: number[],
    maxItems: number = 5
  ) => {
    if (items.length === 0) return;

    checkPageBreak(40);

    // Section title
    addText(title, yPos, 14, "right", titleColor);
    yPos += 8;

    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(51, 65, 85);

    items.slice(0, maxItems).forEach((item, index) => {
      checkPageBreak(15);

      const bulletNum = `${index + 1}.`;
      const text = renderText(item);
      const maxWidth = pageWidth - margin * 2 - 15;
      const lines = pdf.splitTextToSize(text, maxWidth);

      // Bullet/number
      pdf.setTextColor(iconColor[0], iconColor[1], iconColor[2]);
      pdf.text(bulletNum, pageWidth - margin, yPos, { align: "right" });

      // Content
      pdf.setTextColor(51, 65, 85);
      lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
          pdf.text(line, pageWidth - margin - 10, yPos, { align: "right" });
        } else {
          yPos += 6;
          checkPageBreak(10);
          pdf.text(line, pageWidth - margin - 10, yPos, { align: "right" });
        }
      });

      yPos += 8;
    });

    yPos += 5;
  };

  // Strengths
  renderSection("نقاط القوة", strengths, [22, 163, 74], [22, 163, 74]);

  // Opportunities
  renderSection("فرص التحسين", opportunities, [234, 88, 12], [234, 88, 12]);

  // Recommendations
  renderSection("التوصيات العملية", recommendations, [37, 99, 235], [37, 99, 235]);

  // ===================== FOOTER =====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // Footer line
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184);

    const footerText = renderText(`منصة نُشارك للتقييم الذاتي`);
    pdf.text(footerText, pageWidth - margin, pageHeight - 8, { align: "right" });

    const pageText = `${i} / ${pageCount}`;
    pdf.text(pageText, margin, pageHeight - 8, { align: "left" });
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
