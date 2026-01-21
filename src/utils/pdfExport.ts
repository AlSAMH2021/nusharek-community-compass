import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { loadAmiriFont, processArabicText } from "./amiriFont";

type JsPdfWithAutoTable = jsPDF & {
  // When plugin patches the prototype, this exists.
  autoTable?: (options: UserOptions) => jsPDF;
  // When using the functional API, plugin sets this.
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

const maturityLabels: Record<string, { ar: string; en: string }> = {
  beginner: { ar: "ناشئ", en: "Beginner" },
  developing: { ar: "متوسط", en: "Developing" },
  advanced: { ar: "متقدم", en: "Advanced" },
  leading: { ar: "رائد", en: "Leading" },
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
      throw new Error("jsPDF font APIs not available (addFileToVFS/addFont)");
    }

    pdf.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    hasAmiri = true;
  } catch (error) {
    // IMPORTANT: don't break export if the font cannot be loaded.
    console.warn("Could not load Amiri font, falling back to helvetica:", error);
  }

  const arabicFont = hasAmiri ? "Amiri" : "helvetica";
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  const addArabicText = (
    text: string,
    y: number,
    fontSize: number = 12,
    align: "right" | "center" | "left" = "right"
  ) => {
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(fontSize);

    const processedText = hasAmiri ? processArabicText(text) : text; // if no Arabic font, don't mangle the string

    if (align === "center") {
      const textWidth = pdf.getTextWidth(processedText);
      pdf.text(processedText, (pageWidth - textWidth) / 2, y);
    } else if (align === "right") {
      pdf.text(processedText, pageWidth - margin, y, { align: "right" });
    } else {
      pdf.text(processedText, margin, y);
    }

    return y + fontSize * 0.5;
  };

  // Title
  pdf.setTextColor(59, 130, 246);
  yPos = addArabicText("تقرير تقييم المشاركة المجتمعية", yPos, 22, "center");
  pdf.setTextColor(100, 100, 100);
  yPos = addArabicText("منصة نُشارك", yPos + 12, 16, "center");

  // Divider
  yPos += 10;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Organization Info
  pdf.setTextColor(0, 0, 0);
  if (organization) {
    yPos = addArabicText(`المنظمة: ${organization.name}`, yPos, 12, "right");
    yPos += 4;
    if (organization.sector) {
      yPos = addArabicText(`القطاع: ${organization.sector}`, yPos, 12, "right");
      yPos += 4;
    }
  }

  const completedDate = assessment.completed_at
    ? new Date(assessment.completed_at).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "قيد التنفيذ";
  yPos = addArabicText(`تاريخ التقييم: ${completedDate}`, yPos, 12, "right");
  yPos += 12;

  // Overall Score Box
  pdf.setFillColor(240, 249, 255);
  pdf.setDrawColor(59, 130, 246);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 40, 3, 3, "FD");

  yPos += 15;

  // Score (Right)
  pdf.setTextColor(59, 130, 246);
  addArabicText("الدرجة الإجمالية", yPos - 3, 14, "right");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(32);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`${Math.round(assessment.overall_score || 0)}%`, pageWidth - margin - 5, yPos + 15, {
    align: "right",
  });

  // Maturity (Left)
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  pdf.setTextColor(59, 130, 246);
  addArabicText("مستوى النضج", yPos - 3, 14, "left");

  pdf.setFont(arabicFont, "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(0, 0, 0);
  const maturityText = hasAmiri ? processArabicText(maturity?.ar || "—") : maturity?.ar || "—";
  pdf.text(maturityText, margin + 5, yPos + 15);

  yPos += 45;

  // Dimension Scores
  pdf.setTextColor(59, 130, 246);
  yPos = addArabicText("نتائج المعايير", yPos, 16, "right");
  yPos += 5;

  const tableData = dimensionScores.map((ds) => [
    ds.percentage >= 75 ? "ممتاز" : ds.percentage >= 50 ? "جيد" : ds.percentage >= 25 ? "يحتاج تحسين" : "ضعيف",
    `${Math.round(ds.percentage)}%`,
    `${ds.score} / ${ds.max_possible_score}`,
    hasAmiri ? processArabicText(ds.dimension.name_ar) : ds.dimension.name_ar,
    ds.dimension.order_index.toString(),
  ]);

  const tableOptions: UserOptions = {
    startY: yPos,
    head: [
      [
        hasAmiri ? processArabicText("المستوى") : "المستوى",
        hasAmiri ? processArabicText("النسبة") : "النسبة",
        hasAmiri ? processArabicText("الدرجة") : "الدرجة",
        hasAmiri ? processArabicText("المعيار") : "المعيار",
        "#",
      ],
    ],
    body: tableData,
    theme: "striped",
    styles: {
      font: arabicFont,
      halign: "right",
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 11,
      font: arabicFont,
      halign: "right",
    },
    bodyStyles: {
      fontSize: 10,
      font: arabicFont,
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 70 },
      4: { cellWidth: 10, halign: "center" },
    },
    margin: { left: margin, right: margin },
  };

  // Robust integration: prefer plugin method if it exists, otherwise use functional API.
  if (typeof pdf.autoTable === "function") {
    pdf.autoTable(tableOptions);
  } else {
    autoTable(pdf, tableOptions);
  }

  const finalY = pdf.lastAutoTable?.finalY;
  yPos = (typeof finalY === "number" ? finalY : yPos) + 15;

  const ensurePage = () => {
    if (yPos > 200) {
      pdf.addPage();
      yPos = 20;
    }
  };

  ensurePage();

  // Strengths
  if (strengths.length > 0) {
    pdf.setTextColor(34, 197, 94);
    yPos = addArabicText("نقاط القوة", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(11);

    strengths.forEach((s) => {
      const text = `• ${s}`;
      const processed = hasAmiri ? processArabicText(text) : text;
      const lines = pdf.splitTextToSize(processed, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, pageWidth - margin - 5, yPos, { align: "right" });
        yPos += 7;
      });
    });

    yPos += 8;
  }

  ensurePage();

  // Opportunities
  if (opportunities.length > 0) {
    pdf.setTextColor(249, 115, 22);
    yPos = addArabicText("فرص التحسين", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(11);

    opportunities.slice(0, 5).forEach((o) => {
      const text = `• ${o}`;
      const processed = hasAmiri ? processArabicText(text) : text;
      const lines = pdf.splitTextToSize(processed, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, pageWidth - margin - 5, yPos, { align: "right" });
        yPos += 7;
      });
    });

    yPos += 8;
  }

  ensurePage();

  // Recommendations
  if (recommendations.length > 0) {
    pdf.setTextColor(59, 130, 246);
    yPos = addArabicText("التوصيات", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(11);

    recommendations.slice(0, 5).forEach((r, index) => {
      const text = `${index + 1}. ${r}`;
      const processed = hasAmiri ? processArabicText(text) : text;
      const lines = pdf.splitTextToSize(processed, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, pageWidth - margin - 5, yPos, { align: "right" });
        yPos += 7;
      });
      yPos += 2;
    });
  }

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont(arabicFont, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);

    const footerRaw = `منصة نُشارك - صفحة ${i} من ${pageCount}`;
    const footerText = hasAmiri ? processArabicText(footerRaw) : footerRaw;
    pdf.text(footerText, pageWidth / 2, 285, { align: "center" });
  }

  // Save / Download
  const fileName = `تقرير-التقييم-${assessment.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = pdf.output("blob") as Blob;
    downloadPdfBlob(blob, fileName);
  } else {
    pdf.save(fileName);
  }
}
