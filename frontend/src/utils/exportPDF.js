import jsPDF from 'jspdf';

/**
 * Exports the AI Analysis data for a document as a styled PDF report.
 * @param {Object} analysis - The analysis object from the API
 * @param {Object} doc - The document metadata (file_name, file_type, etc.)
 */
export async function exportAnalysisPDF(analysis, doc) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const scoreColor = hexToRgb(analysis.health_label?.color || '#94A3B8');
  const primaryRgb = { r: 99, g: 102, b: 241 };

  const addPageIfNeeded = (requiredSpace = 20) => {
    if (y + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const setColor = (rgb) => pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  const resetColor = () => pdf.setTextColor(30, 30, 50);

  // ── HEADER ──
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, pageWidth, 38, 'F');
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('FinPilot AI — Financial Analysis Report', margin, 17);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Document: ${doc?.file_name || 'N/A'}  ·  Generated: ${new Date().toLocaleString()}`, margin, 27);
  pdf.text(`Type: ${doc?.file_type || 'N/A'}  ·  Category: ${analysis.document_category || 'N/A'}`, margin, 33);
  y = 48;
  resetColor();

  // ── HEALTH SCORE ──
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  setColor(primaryRgb);
  pdf.text('Financial Health Score', margin, y);
  y += 6;

  const score = analysis.health_score ?? 0;
  const barWidth = contentWidth;
  const barHeight = 8;
  pdf.setFillColor(235, 235, 245);
  pdf.roundedRect(margin, y, barWidth, barHeight, 3, 3, 'F');
  if (score > 0) {
    pdf.setFillColor(scoreColor.r, scoreColor.g, scoreColor.b);
    pdf.roundedRect(margin, y, barWidth * (score / 100), barHeight, 3, 3, 'F');
  }
  resetColor();
  pdf.setFontSize(9);
  pdf.text(`${score}/100 — ${analysis.health_label?.label || 'N/A'}`, margin + barWidth + 2, y + 6);
  y += 16;

  // ── EXECUTIVE SUMMARY ──
  addPageIfNeeded(30);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  setColor(primaryRgb);
  pdf.text('Executive Summary', margin, y);
  y += 6;
  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  resetColor();
  const summaryLines = pdf.splitTextToSize(analysis.executive_summary || 'No summary available.', contentWidth);
  pdf.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 8;

  // ── KEY METRICS ──
  const metrics = analysis.metrics || {};
  const metricEntries = Object.entries(metrics).filter(([, v]) => v != null);
  if (metricEntries.length > 0) {
    addPageIfNeeded(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    setColor(primaryRgb);
    pdf.text('Key Financial Metrics', margin, y);
    y += 7;

    const colW = contentWidth / 2;
    metricEntries.forEach(([key, val], i) => {
      if (i % 2 === 0) addPageIfNeeded(10);
      const col = i % 2;
      const row = Math.floor(i / 2);
      const xPos = margin + col * colW;
      const yPos = y + row * 9;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 120);
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      pdf.text(label, xPos, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 50);
      pdf.text(formatMetricValue(key, val), xPos + colW * 0.55, yPos);
    });
    y += Math.ceil(metricEntries.length / 2) * 9 + 8;
  }

  // ── INSIGHTS ──
  const insights = analysis.insights || [];
  if (insights.length > 0) {
    addPageIfNeeded(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    setColor(primaryRgb);
    pdf.text('Key Insights', margin, y);
    y += 7;
    insights.forEach((ins) => {
      addPageIfNeeded(16);
      const dotColor = ins.type === 'positive' ? { r: 16, g: 185, b: 129 } : ins.type === 'negative' ? { r: 239, g: 68, b: 68 } : { r: 148, g: 163, b: 184 };
      pdf.setFillColor(dotColor.r, dotColor.g, dotColor.b);
      pdf.circle(margin + 1.5, y - 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      resetColor();
      pdf.text(ins.title, margin + 6, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(80, 80, 100);
      const lines = pdf.splitTextToSize(ins.detail, contentWidth - 6);
      pdf.text(lines, margin + 6, y);
      y += lines.length * 4.5 + 4;
    });
    y += 4;
  }

  // ── RISKS ──
  const risks = analysis.risks || [];
  if (risks.length > 0) {
    addPageIfNeeded(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    setColor({ r: 239, g: 68, b: 68 });
    pdf.text('Risk Factors', margin, y);
    y += 7;
    risks.forEach((risk) => {
      addPageIfNeeded(16);
      const sevColor = risk.severity === 'high' ? { r: 239, g: 68, b: 68 } : risk.severity === 'medium' ? { r: 245, g: 158, b: 11 } : { r: 16, g: 185, b: 129 };
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      setColor(sevColor);
      pdf.text(`[${(risk.severity || 'low').toUpperCase()}] ${risk.title}`, margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(80, 80, 100);
      const lines = pdf.splitTextToSize(risk.detail, contentWidth);
      pdf.text(lines, margin, y);
      y += lines.length * 4.5 + 5;
    });
    y += 4;
  }

  // ── RECOMMENDATIONS ──
  const recs = analysis.recommendations || [];
  if (recs.length > 0) {
    addPageIfNeeded(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    setColor({ r: 34, g: 197, b: 94 });
    pdf.text('AI Recommendations', margin, y);
    y += 7;
    recs.forEach((rec, i) => {
      addPageIfNeeded(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      resetColor();
      pdf.text(`${i + 1}. ${rec.title}`, margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(80, 80, 100);
      const lines = pdf.splitTextToSize(rec.detail, contentWidth);
      pdf.text(lines, margin + 4, y);
      y += lines.length * 4.5 + 5;
    });
  }

  // ── FOOTER on each page ──
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7.5);
    pdf.setTextColor(160, 160, 180);
    pdf.text(`Page ${i} of ${totalPages}  ·  Confidential — Generated by FinPilot AI`, margin, pageHeight - 8);
  }

  pdf.save(`FinPilot_Analysis_${doc?.file_name?.replace(/\.[^/.]+$/, '') || 'report'}.pdf`);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 99, g: 102, b: 241 };
}

function formatMetricValue(key, val) {
  if (key.includes('pct') || key.includes('margin')) return `${val}%`;
  if (key.includes('ratio')) return Number(val).toFixed(3);
  if (key.includes('count')) return String(val);
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${Number(val).toLocaleString('en-IN')}`;
  return `₹${val}`;
}
