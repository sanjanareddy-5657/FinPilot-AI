/**
 * FinPilot AI - Financial Analysis Engine
 * Sprint 5: Rule-based local AI for financial document analysis
 * 
 * Analyzes extracted text/JSON to produce:
 *   - Executive Summary
 *   - Financial Health Score (0-100)
 *   - Key Financial Metrics
 *   - Key Insights
 *   - Risk Factors
 *   - AI Recommendations
 */
const { GoogleGenAI } = require('@google/genai');

class FinancialAnalyzer {
  constructor() {
    this.ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
  }

  /**
   * Main analysis entry point.
   * @param {string} extractedText - Raw extracted text from document
   * @param {Object} extractedJson - Structured JSON from document
   * @param {Object} statistics    - Document statistics
   * @param {string} fileType      - PDF, CSV, or XLSX
   * @returns {Object} Full analysis result
   */
  async analyze(extractedText, extractedJson, statistics, fileType) {
    if (this.ai) {
      try {
        return await this.analyzeWithLLM(extractedText, extractedJson, statistics, fileType);
      } catch (err) {
        console.error('LLM Analysis failed, falling back to regex:', err.message);
        return this.analyzeWithRegex(extractedText, extractedJson, statistics, fileType);
      }
    } else {
      return this.analyzeWithRegex(extractedText, extractedJson, statistics, fileType);
    }
  }

  async analyzeWithLLM(extractedText, extractedJson, statistics, fileType) {
    const prompt = `
You are a highly capable AI financial analyst. I am providing you with the extracted text and structured JSON from a ${fileType} document.
Your task is to analyze this data and return a JSON object with the following schema:
{
  "document_category": "String (e.g. Bank Statement, Invoice, Profit & Loss)",
  "executive_summary": "String (1-2 paragraphs summarizing the financial health and key takeaways)",
  "health_score": Number (0 to 100),
  "health_label": { "label": "String (Excellent, Good, Fair, Poor, Critical)", "color": "String (Hex code like #10B981)" },
  "sentiment": { "label": "String (Positive, Neutral, Negative)", "score": Number (-100 to 100) },
  "metrics": { "revenue": Number, "expenses": Number, "net_profit": Number, "profit_margin_pct": Number, ... (any other key financial metrics found) },
  "insights": [ { "type": "String (positive, neutral, negative)", "title": "String", "detail": "String" } ],
  "risks": [ { "severity": "String (low, medium, high)", "title": "String", "detail": "String" } ],
  "recommendations": [ { "priority": "String (low, medium, high)", "title": "String", "detail": "String" } ]
}

Do not include markdown blocks or any text outside the JSON. Return only the raw JSON string.

Document Text:
${(extractedText || '').substring(0, 15000)}

Document JSON:
${JSON.stringify(extractedJson || {}).substring(0, 15000)}
`;

    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
        }
    });

    const text = response.text;
    const data = JSON.parse(text);
    data.analyzed_at = new Date().toISOString();
    return data;
  }

  analyzeWithRegex(extractedText, extractedJson, statistics, fileType) {
    const text = (extractedText || '').toLowerCase();
    const originalText = extractedText || '';

    // 1. Detect document type
    const docCategory = this.detectDocumentCategory(text, extractedJson);

    // 2. Extract financial metrics
    const metrics = this.extractMetrics(text, originalText, extractedJson, fileType);

    // 3. Compute health score
    const healthScore = this.computeHealthScore(metrics, docCategory, text);

    // 4. Generate insights
    const insights = this.generateInsights(metrics, docCategory, text, healthScore);

    // 5. Identify risks
    const risks = this.identifyRisks(metrics, docCategory, text, healthScore);

    // 6. Generate recommendations
    const recommendations = this.generateRecommendations(metrics, docCategory, risks, healthScore);

    // 7. Executive summary
    const executiveSummary = this.generateExecutiveSummary(
      docCategory, metrics, healthScore, insights, risks, statistics, fileType
    );

    // 8. Sentiment
    const sentiment = this.analyzeSentiment(text);

    return {
      document_category: docCategory,
      executive_summary: executiveSummary,
      health_score: healthScore,
      health_label: this.healthLabel(healthScore),
      sentiment,
      metrics,
      insights,
      risks,
      recommendations,
      analyzed_at: new Date().toISOString()
    };
  }

  // ─────────────────────────────────────────────
  // DOCUMENT CATEGORY DETECTION
  // ─────────────────────────────────────────────
  detectDocumentCategory(text, extractedJson) {
    const categories = [
      { name: 'Bank Statement',      keywords: ['account number', 'bank statement', 'opening balance', 'closing balance', 'transaction', 'debit', 'credit', 'atm', 'neft', 'rtgs', 'imps', 'statement of account'] },
      { name: 'Invoice',             keywords: ['invoice', 'bill to', 'ship to', 'invoice number', 'due date', 'payment terms', 'subtotal', 'gst', 'vat', 'tax invoice'] },
      { name: 'Profit & Loss',       keywords: ['profit and loss', 'p&l', 'income statement', 'revenue', 'gross profit', 'net profit', 'operating expense', 'ebitda', 'net income', 'operating income'] },
      { name: 'Balance Sheet',       keywords: ['balance sheet', 'total assets', 'total liabilities', "shareholder's equity", 'current assets', 'fixed assets', 'long-term liabilities', 'retained earnings'] },
      { name: 'Expense Report',      keywords: ['expense report', 'reimbursement', 'travel expense', 'meal expense', 'accommodation', 'mileage', 'receipts'] },
      { name: 'GST Report',          keywords: ['gst', 'gstin', 'goods and services tax', 'output tax', 'input tax credit', 'igst', 'cgst', 'sgst', 'gstr'] },
      { name: 'Tax Document',        keywords: ['income tax', 'tax return', 'form 16', 'itr', 'tds', 'advance tax', 'taxable income', 'deductions', 'irs', 'tax assessment'] },
      { name: 'Payroll',             keywords: ['payroll', 'salary slip', 'pay slip', 'basic pay', 'provident fund', 'pf', 'esi', 'gross salary', 'net salary', 'employee id', 'designation'] },
      { name: 'Cash Flow Statement', keywords: ['cash flow', 'operating activities', 'investing activities', 'financing activities', 'net cash', 'cash equivalents'] },
      { name: 'Financial Report',    keywords: ['annual report', 'quarterly report', 'financial results', 'earnings per share', 'eps', 'dividend', 'market cap', 'revenue growth'] },
      { name: 'Resume / CV',         keywords: ['resume', 'curriculum vitae', 'experience', 'education', 'skills', 'objective', 'references', 'employment'] },
    ];

    let bestMatch = { name: 'General Document', score: 0 };
    for (const cat of categories) {
      const score = cat.keywords.filter(kw => text.includes(kw)).length;
      if (score > bestMatch.score) {
        bestMatch = { name: cat.name, score };
      }
    }

    // Special case: CSV/XLSX — look at headers
    if ((extractedJson?.type === 'CSV' || extractedJson?.type === 'XLSX') && extractedJson.headers) {
      const headers = extractedJson.headers.map(h => (h || '').toLowerCase());
      if (headers.some(h => ['revenue', 'income', 'sales', 'profit', 'loss'].includes(h))) {
        return 'Financial Data Sheet';
      }
      if (headers.some(h => ['transaction', 'debit', 'credit', 'amount', 'balance'].includes(h))) {
        return 'Transaction Data';
      }
      if (headers.some(h => ['employee', 'salary', 'name', 'department'].includes(h))) {
        return 'Payroll Data';
      }
    }

    return bestMatch.name;
  }

  // ─────────────────────────────────────────────
  // METRIC EXTRACTION (regex-based NLP)
  // ─────────────────────────────────────────────
  extractMetrics(text, originalText, extractedJson, fileType) {
    const metrics = {};

    // Currency amount patterns: handles ₹, $, EUR, GBP, commas, decimals
    const extractAmount = (patterns) => {
      for (const pattern of patterns) {
        const match = originalText.match(pattern);
        if (match) {
          const raw = match[1] || match[2] || match[0];
          const num = parseFloat(raw.replace(/[₹$€£,\s]/g, ''));
          if (!isNaN(num) && num > 0) return num;
        }
      }
      return null;
    };

    // Revenue
    metrics.revenue = extractAmount([
      /(?:total\s+)?revenue[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:net\s+)?sales[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:gross\s+)?income[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /turnover[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Expenses
    metrics.expenses = extractAmount([
      /(?:total\s+)?expenses?[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:total\s+)?expenditure[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:total\s+)?costs?[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /operating\s+expenses?[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Net Profit
    metrics.net_profit = extractAmount([
      /net\s+profit[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /net\s+income[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /profit\s+after\s+tax[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /profit\s+for\s+the\s+(?:year|period)[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Gross Profit
    metrics.gross_profit = extractAmount([
      /gross\s+profit[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Assets
    metrics.total_assets = extractAmount([
      /total\s+assets[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /assets[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Liabilities
    metrics.total_liabilities = extractAmount([
      /total\s+liabilities[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /liabilities[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Cash / Cash Flow
    metrics.cash_flow = extractAmount([
      /net\s+cash\s+flow[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /cash\s+and\s+cash\s+equivalents[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /closing\s+balance[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Tax
    metrics.tax = extractAmount([
      /(?:income\s+)?tax[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /tds[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Salary (payroll)
    metrics.net_salary = extractAmount([
      /net\s+salary[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /take\s+home[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /net\s+pay[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // GST
    metrics.gst_amount = extractAmount([
      /(?:total\s+)?gst[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:igst|cgst|sgst)[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Invoice Amount
    metrics.invoice_total = extractAmount([
      /(?:total\s+)?amount\s+(?:due|payable)[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /grand\s+total[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
      /invoice\s+(?:total|amount)[:\s]+[₹$€£]?\s*([\d,]+(?:\.\d+)?)/i,
    ]);

    // Derive profit margin if we have revenue + expenses
    if (metrics.revenue && metrics.expenses && !metrics.net_profit) {
      metrics.net_profit = metrics.revenue - metrics.expenses;
    }

    // Derived ratios
    if (metrics.revenue && metrics.net_profit) {
      metrics.profit_margin_pct = parseFloat(((metrics.net_profit / metrics.revenue) * 100).toFixed(2));
    }
    if (metrics.total_assets && metrics.total_liabilities) {
      metrics.debt_to_assets_ratio = parseFloat((metrics.total_liabilities / metrics.total_assets).toFixed(3));
    }
    if (metrics.gross_profit && metrics.revenue) {
      metrics.gross_margin_pct = parseFloat(((metrics.gross_profit / metrics.revenue) * 100).toFixed(2));
    }

    // For CSV/XLSX — derive metrics from data rows
    if (extractedJson?.type === 'CSV' || extractedJson?.type === 'XLSX') {
      const csvMetrics = this.extractFromTabularData(extractedJson);
      Object.assign(metrics, csvMetrics);
    }

    // Remove nulls
    return Object.fromEntries(Object.entries(metrics).filter(([, v]) => v !== null && v !== undefined));
  }

  extractFromTabularData(extractedJson) {
    const metrics = {};
    const data = extractedJson.data || (extractedJson.sheets && Object.values(extractedJson.sheets)[0]?.data) || [];
    const headers = extractedJson.headers || (data.length > 0 ? Object.keys(data[0]) : []);

    if (!data.length) return metrics;

    // Find numeric columns
    const numericCols = headers.filter(h => {
      return data.slice(0, 5).some(row => {
        const val = parseFloat(String(row[h] || '').replace(/[,₹$€£\s]/g, ''));
        return !isNaN(val);
      });
    });

    // Look for amount/revenue/expense columns
    const amountCols = numericCols.filter(h =>
      /amount|total|revenue|income|sales|value|price|cost/i.test(h)
    );

    const expenseCols = numericCols.filter(h =>
      /expense|cost|debit|payment|expenditure/i.test(h)
    );

    const creditCols = numericCols.filter(h =>
      /credit|income|revenue|receipt|sales/i.test(h)
    );

    // Sum columns
    const sumCol = (col) => {
      return data.reduce((sum, row) => {
        const val = parseFloat(String(row[col] || '').replace(/[,₹$€£\s]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
    };

    if (amountCols.length > 0) {
      metrics.total_transaction_value = Math.round(sumCol(amountCols[0]));
      metrics.transaction_count = data.length;
      metrics.average_transaction = Math.round(metrics.total_transaction_value / Math.max(data.length, 1));
    }

    // Separate positive/negative in amount column (income vs expense)
    if (amountCols.length > 0) {
      let totalPositive = 0, totalNegative = 0;
      data.forEach(row => {
        const val = parseFloat(String(row[amountCols[0]] || '').replace(/[,₹$€£\s]/g, ''));
        if (!isNaN(val)) {
          if (val > 0) totalPositive += val;
          else totalNegative += Math.abs(val);
        }
      });
      if (totalPositive > 0) metrics.revenue = Math.round(totalPositive);
      if (totalNegative > 0) metrics.expenses = Math.round(totalNegative);
      if (totalPositive > 0 || totalNegative > 0) {
        metrics.net_profit = Math.round(totalPositive - totalNegative);
        if (totalPositive > 0) {
          metrics.profit_margin_pct = parseFloat(((metrics.net_profit / totalPositive) * 100).toFixed(2));
        }
      }
    }

    if (expenseCols.length > 0 && !metrics.expenses) {
      metrics.expenses = Math.round(sumCol(expenseCols[0]));
    }
    if (creditCols.length > 0 && !metrics.revenue) {
      metrics.revenue = Math.round(sumCol(creditCols[0]));
    }

    return metrics;
  }

  // ─────────────────────────────────────────────
  // FINANCIAL HEALTH SCORE (0-100)
  // ─────────────────────────────────────────────
  computeHealthScore(metrics, docCategory, text) {
    let score = 50; // Start neutral
    let factors = 0;

    // Profit margin scoring
    if (metrics.profit_margin_pct !== undefined) {
      factors++;
      if (metrics.profit_margin_pct >= 20) score += 20;
      else if (metrics.profit_margin_pct >= 10) score += 12;
      else if (metrics.profit_margin_pct >= 5) score += 6;
      else if (metrics.profit_margin_pct >= 0) score += 2;
      else score -= 20; // Negative margin is serious
    }

    // Gross margin scoring
    if (metrics.gross_margin_pct !== undefined) {
      factors++;
      if (metrics.gross_margin_pct >= 40) score += 10;
      else if (metrics.gross_margin_pct >= 25) score += 6;
      else if (metrics.gross_margin_pct >= 10) score += 3;
      else score -= 5;
    }

    // Debt to assets ratio
    if (metrics.debt_to_assets_ratio !== undefined) {
      factors++;
      if (metrics.debt_to_assets_ratio < 0.3) score += 15;
      else if (metrics.debt_to_assets_ratio < 0.5) score += 8;
      else if (metrics.debt_to_assets_ratio < 0.7) score += 2;
      else score -= 15; // Highly leveraged
    }

    // Cash flow
    if (metrics.cash_flow !== undefined) {
      factors++;
      if (metrics.cash_flow > 0) score += 8;
      else score -= 10;
    }

    // Revenue presence
    if (metrics.revenue !== undefined && metrics.revenue > 0) {
      factors++;
      score += 5;
    }

    // Net profit presence
    if (metrics.net_profit !== undefined) {
      factors++;
      if (metrics.net_profit > 0) score += 8;
      else score -= 12;
    }

    // Text sentiment indicators
    const positiveKeywords = ['growth', 'profit', 'surplus', 'increase', 'strong', 'positive', 'record', 'outperform', 'exceeded'];
    const negativeKeywords = ['loss', 'deficit', 'decline', 'decrease', 'debt', 'overdue', 'default', 'risk', 'penalty', 'negative'];

    const posCount = positiveKeywords.filter(kw => text.includes(kw)).length;
    const negCount = negativeKeywords.filter(kw => text.includes(kw)).length;
    score += (posCount - negCount) * 2;

    // If no financial metrics found at all, score is lower
    if (factors === 0) {
      score = 40; // Can't evaluate properly
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  healthLabel(score) {
    if (score >= 80) return { label: 'Excellent', color: '#10B981' };
    if (score >= 65) return { label: 'Good', color: '#22C55E' };
    if (score >= 50) return { label: 'Fair', color: '#F59E0B' };
    if (score >= 35) return { label: 'Poor', color: '#F97316' };
    return { label: 'Critical', color: '#EF4444' };
  }

  // ─────────────────────────────────────────────
  // INSIGHTS
  // ─────────────────────────────────────────────
  generateInsights(metrics, docCategory, text, healthScore) {
    const insights = [];

    if (metrics.profit_margin_pct !== undefined) {
      if (metrics.profit_margin_pct >= 20) {
        insights.push({ type: 'positive', title: 'Strong Profit Margin', detail: `Net profit margin of ${metrics.profit_margin_pct}% is above the typical 15-20% benchmark — indicating efficient operations.` });
      } else if (metrics.profit_margin_pct >= 5) {
        insights.push({ type: 'neutral', title: 'Moderate Profit Margin', detail: `Net profit margin of ${metrics.profit_margin_pct}% is within acceptable range. There is room for improvement through cost control.` });
      } else if (metrics.profit_margin_pct < 0) {
        insights.push({ type: 'negative', title: 'Operating at a Loss', detail: `Negative profit margin of ${metrics.profit_margin_pct}% indicates expenditure exceeds revenue. Immediate corrective action is recommended.` });
      }
    }

    if (metrics.revenue && metrics.expenses) {
      const ratio = (metrics.expenses / metrics.revenue * 100).toFixed(1);
      insights.push({ type: ratio < 80 ? 'positive' : ratio < 100 ? 'neutral' : 'negative', title: 'Revenue vs Expense Ratio', detail: `Expenses represent ${ratio}% of revenue. ${ratio < 80 ? 'Strong cost efficiency.' : ratio < 100 ? 'Moderate efficiency. Monitor trends.' : 'Expenses exceed revenue — unsustainable.'}` });
    }

    if (metrics.debt_to_assets_ratio !== undefined) {
      const label = metrics.debt_to_assets_ratio < 0.3 ? 'low' : metrics.debt_to_assets_ratio < 0.6 ? 'moderate' : 'high';
      insights.push({ type: label === 'low' ? 'positive' : label === 'moderate' ? 'neutral' : 'negative', title: 'Leverage Position', detail: `Debt-to-assets ratio of ${metrics.debt_to_assets_ratio} indicates ${label} leverage. ${label === 'high' ? 'Consider debt reduction strategies.' : 'Balance sheet appears healthy.'}` });
    }

    if (metrics.gross_margin_pct !== undefined) {
      insights.push({ type: metrics.gross_margin_pct >= 30 ? 'positive' : 'neutral', title: 'Gross Margin Analysis', detail: `Gross margin of ${metrics.gross_margin_pct}% reflects the efficiency of core operations before overheads.` });
    }

    if (metrics.transaction_count !== undefined) {
      insights.push({ type: 'neutral', title: 'Transaction Volume', detail: `${metrics.transaction_count} transactions recorded with an average value of ${this.formatCurrency(metrics.average_transaction)}.` });
    }

    if (metrics.cash_flow !== undefined) {
      insights.push({ type: metrics.cash_flow > 0 ? 'positive' : 'negative', title: 'Cash Flow Position', detail: `${metrics.cash_flow > 0 ? 'Positive cash flow of' : 'Negative cash flow of'} ${this.formatCurrency(Math.abs(metrics.cash_flow))} indicates ${metrics.cash_flow > 0 ? 'healthy liquidity.' : 'potential liquidity concerns.'}` });
    }

    if (text.includes('gst') || text.includes('tax')) {
      insights.push({ type: 'neutral', title: 'Tax Compliance Document', detail: 'This document contains tax-related information. Ensure timely filing and payment obligations are met.' });
    }

    // If no metrics found at all
    if (insights.length === 0) {
      insights.push({ type: 'neutral', title: 'Limited Financial Data', detail: 'Insufficient structured financial data was found in this document for detailed metric analysis.' });
      insights.push({ type: 'neutral', title: 'Document Type', detail: `This appears to be a "${docCategory}" document. Upload a financial statement for a richer analysis.` });
    }

    return insights;
  }

  // ─────────────────────────────────────────────
  // RISK FACTORS
  // ─────────────────────────────────────────────
  identifyRisks(metrics, docCategory, text, healthScore) {
    const risks = [];

    if (metrics.profit_margin_pct !== undefined && metrics.profit_margin_pct < 0) {
      risks.push({ severity: 'high', title: 'Negative Profitability', detail: 'The entity is operating at a loss. Sustained losses can threaten long-term viability.' });
    }

    if (metrics.debt_to_assets_ratio !== undefined && metrics.debt_to_assets_ratio > 0.7) {
      risks.push({ severity: 'high', title: 'High Financial Leverage', detail: `Debt-to-assets ratio of ${metrics.debt_to_assets_ratio} indicates significant financial risk. High leverage amplifies volatility.` });
    }

    if (metrics.cash_flow !== undefined && metrics.cash_flow < 0) {
      risks.push({ severity: 'high', title: 'Negative Cash Flow', detail: 'Negative cash flow may indicate inability to meet short-term obligations or operational inefficiencies.' });
    }

    if (metrics.revenue && metrics.expenses && metrics.expenses > metrics.revenue * 0.95) {
      risks.push({ severity: 'medium', title: 'Thin Margin Risk', detail: 'Operating expenses are dangerously close to revenue. Any adverse conditions could result in a loss.' });
    }

    if (text.includes('overdue') || text.includes('past due') || text.includes('default')) {
      risks.push({ severity: 'high', title: 'Overdue Obligations Detected', detail: 'Document contains references to overdue or defaulted payments. This may indicate liquidity or creditworthiness concerns.' });
    }

    if (text.includes('penalty') || text.includes('fine') || text.includes('notice')) {
      risks.push({ severity: 'medium', title: 'Compliance Risk', detail: 'References to penalties or notices detected. Review for regulatory compliance obligations.' });
    }

    if (text.includes('fraud') || text.includes('discrepancy') || text.includes('mismatch')) {
      risks.push({ severity: 'high', title: 'Potential Accuracy Concern', detail: 'Words like "fraud", "discrepancy", or "mismatch" detected. Manual review recommended.' });
    }

    if (healthScore < 35) {
      risks.push({ severity: 'high', title: 'Overall Financial Health Critical', detail: 'The financial health score indicates the document reflects a financially stressed entity requiring immediate attention.' });
    } else if (healthScore < 50) {
      risks.push({ severity: 'medium', title: 'Below-Average Financial Health', detail: 'Financial indicators suggest below-average performance. Improvement in key metrics is recommended.' });
    }

    if (risks.length === 0) {
      risks.push({ severity: 'low', title: 'No Critical Risks Identified', detail: 'Based on the available data, no critical financial risks were detected. Continue monitoring regularly.' });
    }

    return risks;
  }

  // ─────────────────────────────────────────────
  // RECOMMENDATIONS
  // ─────────────────────────────────────────────
  generateRecommendations(metrics, docCategory, risks, healthScore) {
    const recs = [];

    if (metrics.profit_margin_pct !== undefined && metrics.profit_margin_pct < 10) {
      recs.push({ priority: 'high', title: 'Improve Profit Margins', detail: 'Review pricing strategy and identify opportunities to reduce cost of goods sold (COGS). Consider value-based pricing models.' });
    }

    if (metrics.expenses && metrics.revenue && metrics.expenses / metrics.revenue > 0.8) {
      recs.push({ priority: 'high', title: 'Reduce Operating Costs', detail: 'Operating expenses are high relative to revenue. Conduct an expense audit, automate repetitive tasks, and renegotiate vendor contracts.' });
    }

    if (metrics.debt_to_assets_ratio !== undefined && metrics.debt_to_assets_ratio > 0.5) {
      recs.push({ priority: 'medium', title: 'Debt Restructuring', detail: 'Consider refinancing high-interest debt, accelerating debt repayment, or equity financing to improve the balance sheet.' });
    }

    if (metrics.cash_flow !== undefined && metrics.cash_flow < 0) {
      recs.push({ priority: 'high', title: 'Improve Cash Flow Management', detail: 'Accelerate receivables collection, negotiate extended payables terms, and maintain a cash reserve for operational continuity.' });
    }

    if (healthScore >= 65) {
      recs.push({ priority: 'low', title: 'Optimize Investment Strategy', detail: 'With healthy financials, consider strategic investments in growth areas, R&D, or market expansion to compound returns.' });
      recs.push({ priority: 'low', title: 'Maintain Financial Discipline', detail: 'Continue the current trajectory with regular financial reviews. Set quarterly KPI targets to sustain performance.' });
    }

    if (docCategory === 'Bank Statement' || docCategory === 'Transaction Data') {
      recs.push({ priority: 'medium', title: 'Categorize Transactions', detail: 'Implement expense categorization to track spending patterns. Use this data to set departmental budgets.' });
    }

    if (docCategory === 'Invoice') {
      recs.push({ priority: 'medium', title: 'Monitor Receivables', detail: 'Set up automated invoice reminders and track days-sales-outstanding (DSO) to optimize cash conversion cycle.' });
    }

    if (docCategory.includes('Tax') || docCategory === 'GST Report') {
      recs.push({ priority: 'medium', title: 'Tax Planning', detail: 'Consult a chartered accountant to identify available deductions and credits. Ensure advance tax deposits are current.' });
    }

    if (recs.length === 0) {
      recs.push({ priority: 'medium', title: 'Conduct Full Financial Review', detail: 'Upload complete financial statements (P&L, Balance Sheet, Cash Flow) for a comprehensive analysis and targeted recommendations.' });
      recs.push({ priority: 'low', title: 'Establish Financial KPIs', detail: 'Define and track key financial performance indicators monthly. Use benchmarks specific to your industry for comparison.' });
    }

    return recs;
  }

  // ─────────────────────────────────────────────
  // EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────
  generateExecutiveSummary(docCategory, metrics, healthScore, insights, risks, statistics, fileType) {
    const healthLabelObj = this.healthLabel(healthScore);
    const metricCount = Object.keys(metrics).length;
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const positiveInsights = insights.filter(i => i.type === 'positive').length;

    let summary = `This ${fileType} document has been classified as a "${docCategory}". `;

    if (metricCount > 0) {
      summary += `FinPilot AI identified ${metricCount} financial metric${metricCount > 1 ? 's' : ''} from the document content. `;
    } else {
      summary += `No direct financial figures were automatically extracted — the document may require manual review or contain non-numeric data. `;
    }

    summary += `The overall Financial Health Score is ${healthScore}/100, rated as "${healthLabelObj.label}". `;

    if (metrics.revenue) {
      summary += `Revenue stands at ${this.formatCurrency(metrics.revenue)}`;
      if (metrics.expenses) summary += ` against expenses of ${this.formatCurrency(metrics.expenses)}`;
      if (metrics.net_profit !== undefined) {
        summary += `, resulting in a net ${metrics.net_profit >= 0 ? 'profit' : 'loss'} of ${this.formatCurrency(Math.abs(metrics.net_profit))}`;
      }
      summary += '. ';
    }

    if (metrics.profit_margin_pct !== undefined) {
      summary += `The profit margin is ${metrics.profit_margin_pct}%. `;
    }

    if (highRisks > 0) {
      summary += `${highRisks} high-severity risk${highRisks > 1 ? 's were' : ' was'} identified that require${highRisks === 1 ? 's' : ''} attention. `;
    } else {
      summary += `No critical financial risks were detected. `;
    }

    if (positiveInsights > 0) {
      summary += `${positiveInsights} positive financial indicator${positiveInsights > 1 ? 's were' : ' was'} found.`;
    }

    return summary.trim();
  }

  // ─────────────────────────────────────────────
  // SENTIMENT
  // ─────────────────────────────────────────────
  analyzeSentiment(text) {
    const positive = ['profit', 'growth', 'surplus', 'strong', 'increase', 'positive', 'efficient', 'success', 'gain', 'improve', 'record', 'exceeded', 'outperformed'];
    const negative = ['loss', 'deficit', 'decline', 'decrease', 'debt', 'overdue', 'default', 'risk', 'concern', 'warning', 'negative', 'drop', 'fail'];

    const posScore = positive.filter(w => text.includes(w)).length;
    const negScore = negative.filter(w => text.includes(w)).length;
    const total = posScore + negScore;

    if (total === 0) return { label: 'Neutral', score: 0 };
    const sentimentScore = Math.round(((posScore - negScore) / total) * 100);

    if (sentimentScore > 20) return { label: 'Positive', score: sentimentScore };
    if (sentimentScore < -20) return { label: 'Negative', score: sentimentScore };
    return { label: 'Neutral', score: sentimentScore };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return 'N/A';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${amount.toLocaleString('en-IN')}`;
    return `₹${amount}`;
  }
}

module.exports = { FinancialAnalyzer };
