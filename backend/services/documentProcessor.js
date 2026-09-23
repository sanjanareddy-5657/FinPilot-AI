const fs = require('fs');
const path = require('path');

/**
 * Document Processor Service
 * Extracts content from PDF, Excel, and CSV files.
 */
class DocumentProcessor {

  /**
   * Process a document file and return extracted data.
   * @param {string} filePath - Absolute path to the file on disk
   * @param {string} fileType - PDF, XLSX, or CSV
   * @returns {Promise<Object>} - { extracted_text, extracted_json, statistics }
   */
  async process(filePath, fileType) {
    const startTime = Date.now();

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new ProcessingError('File not found on disk.', 'FILE_NOT_FOUND');
    }

    // Check for empty file
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new ProcessingError('The uploaded file is empty.', 'EMPTY_FILE');
    }

    // Check for very large files (> 50MB)
    if (stats.size > 50 * 1024 * 1024) {
      throw new ProcessingError('File exceeds the maximum processing size of 50MB.', 'FILE_TOO_LARGE');
    }

    let result;
    const type = fileType.toUpperCase();

    switch (type) {
      case 'PDF':
        result = await this.processPDF(filePath);
        break;
      case 'XLSX':
        result = await this.processExcel(filePath);
        break;
      case 'CSV':
        result = await this.processCSV(filePath);
        break;
      default:
        throw new ProcessingError(`Unsupported file type: ${fileType}`, 'UNSUPPORTED_TYPE');
    }

    const processingTime = Date.now() - startTime;

    return {
      extracted_text: result.extracted_text,
      extracted_json: result.extracted_json,
      statistics: result.statistics,
      processing_time: processingTime
    };
  }

  /**
   * Process PDF files using pdf-parse v1.x
   */
  async processPDF(filePath) {
    const pdfParse = require('pdf-parse');

    let dataBuffer;
    try {
      dataBuffer = fs.readFileSync(filePath);
    } catch (err) {
      throw new ProcessingError('Failed to read PDF file. The file may be corrupted.', 'READ_ERROR');
    }

    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer);
    } catch (err) {
      // Detect password-protected PDFs
      if (err.message && (err.message.toLowerCase().includes('password') || err.message.toLowerCase().includes('encrypted'))) {
        throw new ProcessingError('This PDF is password-protected and cannot be processed.', 'PASSWORD_PROTECTED');
      }
      throw new ProcessingError(
        'Failed to parse PDF. The file may be corrupted or in an unsupported format. Details: ' + err.message,
        'PARSE_ERROR'
      );
    }

    const text = pdfData.text || '';
    const isImageOnlyPDF = text.trim().length === 0;

    // Split into paragraphs (double newlines or single newlines with content)
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Word count
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // Build structured JSON from content
    const extracted_json = {
      type: 'PDF',
      total_pages: pdfData.numpages || 0,
      is_image_pdf: isImageOnlyPDF,
      note: isImageOnlyPDF
        ? 'This PDF appears to be a scanned image or contains no selectable text. OCR (Optical Character Recognition) would be required for full text extraction.'
        : null,
      metadata: {
        title: (pdfData.info && pdfData.info.Title) || null,
        author: (pdfData.info && pdfData.info.Author) || null,
        subject: (pdfData.info && pdfData.info.Subject) || null,
        creator: (pdfData.info && pdfData.info.Creator) || null,
        creation_date: (pdfData.info && pdfData.info.CreationDate) || null,
        pdf_version: pdfData.version || null
      },
      paragraphs: paragraphs
    };

    const statistics = {
      total_pages: pdfData.numpages || 0,
      total_words: words.length,
      total_paragraphs: paragraphs.length,
      total_characters: text.length,
      is_image_pdf: isImageOnlyPDF,
      file_size_bytes: fs.statSync(filePath).size
    };

    const displayText = isImageOnlyPDF
      ? `[Image-Only PDF]\n\nThis document (${pdfData.numpages || 0} page(s)) appears to be a scanned image and does not contain selectable text.\n\nTo extract text from scanned PDFs, OCR (Optical Character Recognition) software would be required.\n\nFile metadata:\n- Producer: ${(pdfData.info && pdfData.info.Producer) || 'Unknown'}\n- Pages: ${pdfData.numpages || 0}`
      : text;

    return {
      extracted_text: displayText,
      extracted_json,
      statistics
    };
  }

  /**
   * Process Excel (.xlsx) files
   */
  async processExcel(filePath) {
    const XLSX = require('xlsx');

    let workbook;
    try {
      workbook = XLSX.readFile(filePath);
    } catch (err) {
      if (err.message && err.message.includes('password')) {
        throw new ProcessingError('This Excel file is password-protected and cannot be processed.', 'PASSWORD_PROTECTED');
      }
      throw new ProcessingError('Failed to parse Excel file. The file may be corrupted.', 'PARSE_ERROR');
    }

    const sheetNames = workbook.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      throw new ProcessingError('The Excel file contains no worksheets.', 'EMPTY_FILE');
    }

    const sheets = {};
    let totalRows = 0;
    let totalColumns = 0;
    const allTextParts = [];

    sheetNames.forEach(name => {
      const worksheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const csvText = XLSX.utils.sheet_to_csv(worksheet);

      const rows = jsonData.length;
      const cols = jsonData.length > 0 ? Object.keys(jsonData[0]).length : 0;

      totalRows += rows;
      totalColumns = Math.max(totalColumns, cols);

      sheets[name] = {
        rows: rows,
        columns: cols,
        headers: jsonData.length > 0 ? Object.keys(jsonData[0]) : [],
        data: jsonData.slice(0, 500) // Limit to 500 rows per sheet for storage
      };

      allTextParts.push(`--- Sheet: ${name} ---`);
      allTextParts.push(csvText);
    });

    const extracted_text = allTextParts.join('\n\n');

    const extracted_json = {
      type: 'XLSX',
      total_sheets: sheetNames.length,
      sheet_names: sheetNames,
      sheets: sheets
    };

    const statistics = {
      total_sheets: sheetNames.length,
      total_rows: totalRows,
      total_columns: totalColumns,
      sheet_names: sheetNames,
      file_size_bytes: fs.statSync(filePath).size
    };

    return {
      extracted_text,
      extracted_json,
      statistics
    };
  }

  /**
   * Process CSV files
   */
  async processCSV(filePath) {
    let rawContent;
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new ProcessingError('Failed to read CSV file. The file may be corrupted.', 'READ_ERROR');
    }

    if (!rawContent.trim()) {
      throw new ProcessingError('The CSV file is empty.', 'EMPTY_FILE');
    }

    // Parse CSV manually (handles commas inside quotes)
    const rows = this.parseCSV(rawContent);

    if (rows.length === 0) {
      throw new ProcessingError('No data rows found in CSV.', 'EMPTY_FILE');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Convert to array of objects
    const jsonData = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header || `column_${i + 1}`] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });

    const extracted_json = {
      type: 'CSV',
      headers: headers,
      total_data_rows: jsonData.length,
      data: jsonData.slice(0, 500) // Limit to 500 rows for storage
    };

    const statistics = {
      total_rows: rows.length,
      total_data_rows: jsonData.length,
      total_columns: headers.length,
      headers: headers,
      file_size_bytes: fs.statSync(filePath).size
    };

    return {
      extracted_text: rawContent,
      extracted_json,
      statistics
    };
  }

  /**
   * Basic CSV parser that handles quoted fields
   */
  parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          if (char === '\r') i++; // Skip \n in \r\n
        } else {
          currentField += char;
        }
      }
    }

    // Push last field/row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }
}

/**
 * Custom error class for processing errors
 */
class ProcessingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProcessingError';
    this.code = code;
  }
}

module.exports = { DocumentProcessor, ProcessingError };
