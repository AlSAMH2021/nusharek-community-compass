import jsPDF from "jspdf";
import "jspdf-autotable";
import { loadAmiriFont, processArabicText } from "./amiriFont";

// Extend jsPDF type for autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

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
  });

  // Load and add Amiri font for Arabic support
  try {
    const amiriFontBase64 = await loadAmiriFont();
    pdf.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
    pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  } catch (error) {
    console.warn("Could not load Amiri font, falling back to helvetica:", error);
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to add Arabic text (right-aligned)
  const addArabicText = (text: string, y: number, fontSize: number = 12, align: "right" | "center" | "left" = "right") => {
    pdf.setFont("Amiri", "normal");
    pdf.setFontSize(fontSize);
    const processedText = processArabicText(text);
    
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

  // Helper function to add English text
  const addEnglishText = (text: string, y: number, fontSize: number = 12, align: "right" | "center" | "left" = "left") => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    
    if (align === "center") {
      const textWidth = pdf.getTextWidth(text);
      pdf.text(text, (pageWidth - textWidth) / 2, y);
    } else if (align === "right") {
      pdf.text(text, pageWidth - margin, y, { align: "right" });
    } else {
      pdf.text(text, margin, y);
    }
    return y + fontSize * 0.5;
  };

  // Arabic Title
  pdf.setTextColor(59, 130, 246); // Primary blue
  yPos = addArabicText("تقرير تقييم المشاركة المجتمعية", yPos, 22, "center");
  
  pdf.setTextColor(100, 100, 100);
  yPos = addArabicText("منصة نُشارك", yPos + 12, 16, "center");

  // Divider line
  yPos += 10;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Organization Info (Arabic)
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
  
  // Score Section (Right side)
  pdf.setTextColor(59, 130, 246);
  addArabicText("الدرجة الإجمالية", yPos - 3, 14, "right");
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(32);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`${Math.round(assessment.overall_score || 0)}%`, pageWidth - margin - 5, yPos + 15, { align: "right" });

  // Maturity Level (Left side)
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  pdf.setTextColor(59, 130, 246);
  addArabicText("مستوى النضج", yPos - 3, 14, "left");
  
  pdf.setFont("Amiri", "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(0, 0, 0);
  const maturityText = processArabicText(maturity?.ar || "—");
  pdf.text(maturityText, margin + 5, yPos + 15);

  yPos += 45;

  // Dimension Scores Section
  pdf.setTextColor(59, 130, 246);
  yPos = addArabicText("نتائج المعايير", yPos, 16, "right");
  yPos += 5;

  // Table data with Arabic dimension names
  const tableData = dimensionScores.map((ds) => [
    ds.percentage >= 75 ? "ممتاز" : ds.percentage >= 50 ? "جيد" : ds.percentage >= 25 ? "يحتاج تحسين" : "ضعيف",
    `${Math.round(ds.percentage)}%`,
    `${ds.score} / ${ds.max_possible_score}`,
    processArabicText(ds.dimension.name_ar),
    ds.dimension.order_index.toString(),
  ]);

  pdf.autoTable({
    startY: yPos,
    head: [[
      processArabicText("المستوى"),
      processArabicText("النسبة"),
      processArabicText("الدرجة"),
      processArabicText("المعيار"),
      "#"
    ]],
    body: tableData,
    theme: "striped",
    styles: {
      font: "Amiri",
      halign: "right",
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 11,
      font: "Amiri",
      halign: "right",
    },
    bodyStyles: {
      fontSize: 10,
      font: "Amiri",
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 70 },
      4: { cellWidth: 10, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  yPos = pdf.lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPos > 200) {
    pdf.addPage();
    yPos = 20;
  }

  // Strengths Section
  if (strengths.length > 0) {
    pdf.setTextColor(34, 197, 94); // Green
    yPos = addArabicText("نقاط القوة", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    strengths.forEach((s) => {
      const processedText = processArabicText(`• ${s}`);
      pdf.setFont("Amiri", "normal");
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(processedText, pageWidth - margin * 2 - 10);
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

  // Check if we need a new page
  if (yPos > 200) {
    pdf.addPage();
    yPos = 20;
  }

  // Opportunities Section
  if (opportunities.length > 0) {
    pdf.setTextColor(249, 115, 22); // Orange
    yPos = addArabicText("فرص التحسين", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    opportunities.slice(0, 5).forEach((o) => {
      const processedText = processArabicText(`• ${o}`);
      pdf.setFont("Amiri", "normal");
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(processedText, pageWidth - margin * 2 - 10);
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

  // Check if we need a new page
  if (yPos > 200) {
    pdf.addPage();
    yPos = 20;
  }

  // Recommendations Section
  if (recommendations.length > 0) {
    pdf.setTextColor(59, 130, 246); // Blue
    yPos = addArabicText("التوصيات", yPos, 16, "right");
    yPos += 6;

    pdf.setTextColor(0, 0, 0);
    recommendations.slice(0, 5).forEach((r, index) => {
      const processedText = processArabicText(`${index + 1}. ${r}`);
      pdf.setFont("Amiri", "normal");
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(processedText, pageWidth - margin * 2 - 10);
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

  // Footer on each page
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("Amiri", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    const footerText = processArabicText(`منصة نُشارك - صفحة ${i} من ${pageCount}`);
    pdf.text(footerText, pageWidth / 2, 285, { align: "center" });
  }

  // Save the PDF
  const fileName = `تقرير-التقييم-${assessment.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}
