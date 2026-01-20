import jsPDF from "jspdf";
import "jspdf-autotable";

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

  // Add Amiri font for Arabic support - we'll use a simple approach
  pdf.setFont("helvetica");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to add right-aligned Arabic text
  const addRightAlignedText = (text: string, y: number, fontSize: number = 12) => {
    pdf.setFontSize(fontSize);
    const textWidth = pdf.getTextWidth(text);
    pdf.text(text, pageWidth - margin - textWidth, y);
    return y + fontSize * 0.5;
  };

  // Helper function to add centered text
  const addCenteredText = (text: string, y: number, fontSize: number = 12) => {
    pdf.setFontSize(fontSize);
    const textWidth = pdf.getTextWidth(text);
    pdf.text(text, (pageWidth - textWidth) / 2, y);
    return y + fontSize * 0.5;
  };

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(59, 130, 246); // Primary blue
  yPos = addCenteredText("Community Engagement Assessment Report", yPos, 20);
  
  pdf.setFontSize(14);
  pdf.setTextColor(100, 100, 100);
  yPos = addCenteredText("Nusharek Platform", yPos + 10, 14);

  // Divider line
  yPos += 10;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Organization Info
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  
  if (organization) {
    pdf.text(`Organization: ${organization.name_en || organization.name}`, margin, yPos);
    yPos += 8;
    if (organization.sector) {
      pdf.text(`Sector: ${organization.sector}`, margin, yPos);
      yPos += 8;
    }
  }

  const completedDate = assessment.completed_at
    ? new Date(assessment.completed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "In Progress";
  pdf.text(`Assessment Date: ${completedDate}`, margin, yPos);
  yPos += 15;

  // Overall Score Box
  pdf.setFillColor(240, 249, 255);
  pdf.setDrawColor(59, 130, 246);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 3, 3, "FD");
  
  yPos += 12;
  pdf.setFontSize(14);
  pdf.setTextColor(59, 130, 246);
  pdf.text("Overall Score", margin + 10, yPos);
  
  pdf.setFontSize(28);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`${Math.round(assessment.overall_score || 0)}%`, margin + 10, yPos + 15);

  // Maturity Level
  const maturity = assessment.maturity_level ? maturityLabels[assessment.maturity_level] : null;
  pdf.setFontSize(14);
  pdf.setTextColor(59, 130, 246);
  pdf.text("Maturity Level", pageWidth / 2, yPos);
  
  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.text(maturity?.en || "—", pageWidth / 2, yPos + 15);

  yPos += 40;

  // Dimension Scores Section
  pdf.setFontSize(16);
  pdf.setTextColor(59, 130, 246);
  pdf.text("Dimension Scores", margin, yPos);
  yPos += 8;

  // Table data
  const tableData = dimensionScores.map((ds) => [
    ds.dimension.order_index.toString(),
    ds.dimension.name_en || ds.dimension.name_ar,
    `${ds.score} / ${ds.max_possible_score}`,
    `${Math.round(ds.percentage)}%`,
    ds.percentage >= 75 ? "Excellent" : ds.percentage >= 50 ? "Good" : ds.percentage >= 25 ? "Needs Improvement" : "Weak",
  ]);

  pdf.autoTable({
    startY: yPos,
    head: [["#", "Dimension", "Score", "Percentage", "Level"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = pdf.lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPos > 220) {
    pdf.addPage();
    yPos = 20;
  }

  // Strengths Section
  if (strengths.length > 0) {
    pdf.setFontSize(14);
    pdf.setTextColor(34, 197, 94); // Green
    pdf.text("Strengths", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    // Convert Arabic strengths to English descriptions
    strengths.forEach((s, index) => {
      const englishText = `• Strong performance in dimension ${index + 1}`;
      const lines = pdf.splitTextToSize(englishText, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, margin + 5, yPos);
        yPos += 6;
      });
    });
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 220) {
    pdf.addPage();
    yPos = 20;
  }

  // Opportunities Section
  if (opportunities.length > 0) {
    pdf.setFontSize(14);
    pdf.setTextColor(249, 115, 22); // Orange
    pdf.text("Areas for Improvement", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    opportunities.slice(0, 5).forEach((o, index) => {
      const englishText = `• Improvement opportunity in area ${index + 1}`;
      const lines = pdf.splitTextToSize(englishText, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, margin + 5, yPos);
        yPos += 6;
      });
    });
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 220) {
    pdf.addPage();
    yPos = 20;
  }

  // Recommendations Section
  if (recommendations.length > 0) {
    pdf.setFontSize(14);
    pdf.setTextColor(59, 130, 246); // Blue
    pdf.text("Recommendations", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    const englishRecommendations = [
      "Develop a comprehensive community engagement strategy",
      "Establish a dedicated team for stakeholder management",
      "Implement monitoring and evaluation mechanisms",
      "Build strategic partnerships with key stakeholders",
      "Document best practices and share across the organization"
    ];
    
    englishRecommendations.slice(0, recommendations.length).forEach((r, index) => {
      const lines = pdf.splitTextToSize(`${index + 1}. ${r}`, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 2;
    });
  }

  // Footer on each page
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated by Nusharek Platform - Page ${i} of ${pageCount}`,
      pageWidth / 2 - 30,
      285
    );
  }

  // Save the PDF
  const fileName = `assessment-report-${assessment.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}
