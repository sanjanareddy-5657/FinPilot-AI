const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { DocumentProcessor, ProcessingError } = require('../services/documentProcessor');
const { FinancialAnalyzer } = require('../services/financialAnalyzer');

const router = express.Router();
const processor = new DocumentProcessor();
const analyzer = new FinancialAnalyzer();

// Define uploads directory path
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp + random characters + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (PDF, Excel, CSV)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.csv', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, CSV, and Excel (.xlsx) files are supported.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).array('files'); // Allow multiple file upload

// =============================================
// HELPER: Process a single document in background
// =============================================
function processDocumentAsync(documentId, filePath, fileType) {
  const fullPath = path.join(uploadsDir, filePath);

  // Mark as Processing, then start extraction only after DB writes finish.
  // (Avoids INSERT OR REPLACE races that can overwrite Completed results.)
  db.run(
    `UPDATE documents SET processing_status = 'Processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [documentId],
    (docErr) => {
      if (docErr) {
        console.error(`Failed to mark document ${documentId} as Processing:`, docErr.message);
      }

      db.run(
        `INSERT INTO document_extractions (document_id, processing_status, updated_at)
         VALUES (?, 'Processing', CURRENT_TIMESTAMP)
         ON CONFLICT(document_id) DO UPDATE SET
           processing_status = 'Processing',
           error_message = NULL,
           updated_at = CURRENT_TIMESTAMP`,
        [documentId],
        (extErr) => {
          if (extErr) {
            console.error(`Failed to init extraction for document ${documentId}:`, extErr.message);
            return;
          }

          processor.process(fullPath, fileType)
            .then((result) => {
              db.run(
                `UPDATE document_extractions SET
                   extracted_text = ?, extracted_json = ?, statistics = ?,
                   processing_status = 'Completed', processing_time = ?, error_message = NULL,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE document_id = ?`,
                [
                  result.extracted_text,
                  JSON.stringify(result.extracted_json),
                  JSON.stringify(result.statistics),
                  result.processing_time,
                  documentId
                ],
                (saveErr) => {
                  if (saveErr) {
                    console.error(`Failed to save extraction for document ${documentId}:`, saveErr.message);
                    return;
                  }

                  db.run(
                    `UPDATE documents SET processing_status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [documentId]
                  );
                  console.log(`Document ${documentId} processed successfully in ${result.processing_time}ms.`);
                  analyzeDocumentAsync(documentId, result.extracted_text, result.extracted_json, result.statistics, fileType);
                }
              );
            })
            .catch((err) => {
              const errorMessage = err instanceof ProcessingError ? err.message : (err.message || 'Unexpected error');
              const errorCode = err instanceof ProcessingError ? err.code : 'UNKNOWN';

              db.run(
                `UPDATE document_extractions SET
                   processing_status = 'Failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE document_id = ?`,
                [`[${errorCode}] ${errorMessage}`, documentId]
              );
              db.run(
                `UPDATE documents SET processing_status = 'Failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [documentId]
              );
              console.error(`Document ${documentId} processing failed: ${errorMessage}`);
            });
        }
      );
    }
  );
}

// =============================================
// HELPER: Run AI financial analysis in background
// =============================================
function analyzeDocumentAsync(documentId, extractedText, extractedJson, statistics, fileType) {
  const startTime = Date.now();

  // Mark as analyzing first, then write Completed via UPDATE so a late
  // Processing insert cannot wipe finished analysis results.
  db.run(
    `INSERT INTO document_analyses (document_id, analysis_status, updated_at)
     VALUES (?, 'Processing', CURRENT_TIMESTAMP)
     ON CONFLICT(document_id) DO UPDATE SET
       analysis_status = 'Processing',
       error_message = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [documentId],
    (initErr) => {
      if (initErr) {
        console.error(`Failed to init analysis for document ${documentId}:`, initErr.message);
        return;
      }

      try {
        const jsonData = typeof extractedJson === 'string' ? JSON.parse(extractedJson) : extractedJson;
        const statsData = typeof statistics === 'string' ? JSON.parse(statistics) : statistics;

        const result = analyzer.analyze(extractedText || '', jsonData || {}, statsData || {}, fileType);
        const analysisTime = Date.now() - startTime;

        db.run(
          `UPDATE document_analyses SET
             document_category = ?, executive_summary = ?, health_score = ?, health_label = ?, sentiment = ?,
             metrics = ?, insights = ?, risks = ?, recommendations = ?,
             analysis_status = 'Completed', analysis_time = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE document_id = ?`,
          [
            result.document_category,
            result.executive_summary,
            result.health_score,
            JSON.stringify(result.health_label),
            JSON.stringify(result.sentiment),
            JSON.stringify(result.metrics),
            JSON.stringify(result.insights),
            JSON.stringify(result.risks),
            JSON.stringify(result.recommendations),
            analysisTime,
            documentId
          ],
          (err) => {
            if (err) console.error(`Analysis DB save failed for doc ${documentId}:`, err.message);
            else console.log(`Document ${documentId} analyzed successfully in ${analysisTime}ms. Health: ${result.health_score}/100`);
          }
        );
      } catch (err) {
        console.error(`Analysis failed for doc ${documentId}:`, err.message);
        db.run(
          `UPDATE document_analyses SET
             analysis_status = 'Failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
           WHERE document_id = ?`,
          [err.message, documentId]
        );
      }
    }
  );
}

// =============================================
// 1. UPLOAD DOCUMENTS (auto-triggers processing)
// =============================================
router.post('/upload', authenticateToken, (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const ownerId = req.user.id;
    const insertedDocs = [];
    let completedCount = 0;
    let databaseError = null;

    req.files.forEach((file) => {
      const fileName = file.originalname;
      const filePath = file.filename; // store the saved filename (relative to uploads/)
      const fileSize = file.size;
      const fileType = path.extname(file.originalname).substring(1).toUpperCase(); // PDF, CSV, XLSX

      db.run(
        `INSERT INTO documents (owner_id, file_name, file_path, file_size, file_type, processing_status) 
         VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [ownerId, fileName, filePath, fileSize, fileType],
        function (err) {
          if (err) {
            databaseError = err;
          } else {
            const docId = this.lastID;
            insertedDocs.push({
              id: docId,
              file_name: fileName,
              file_size: fileSize,
              file_type: fileType,
              processing_status: 'Pending',
              upload_date: new Date().toISOString()
            });

            // Auto-trigger processing in background
            console.log(`STARTING PROCESS... id=${docId} path=${filePath} type=${fileType}`);
            processDocumentAsync(docId, filePath, fileType);
          }

          completedCount++;
          if (completedCount === req.files.length) {
            if (databaseError) {
              return res.status(500).json({ error: 'Database error occurred during upload saving.' });
            }
            res.status(201).json({
              message: 'Documents uploaded successfully. Processing started automatically.',
              documents: insertedDocs
            });
          }
        }
      );
    });
  });
});

// =============================================
// 2. MANUALLY TRIGGER PROCESSING
// =============================================
router.post('/:id/process', authenticateToken, (req, res) => {
  const docId = req.params.id;

  db.get(
    'SELECT * FROM documents WHERE id = ? AND owner_id = ?',
    [docId, req.user.id],
    (err, doc) => {
      if (err) return res.status(500).json({ error: 'Database query failed.' });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      // Start processing
      processDocumentAsync(doc.id, doc.file_path, doc.file_type);

      res.json({ 
        message: 'Processing started.',
        document_id: doc.id,
        processing_status: 'Processing'
      });
    }
  );
});

// =============================================
// 3. GET EXTRACTED DATA
// =============================================
router.get('/:id/extracted', authenticateToken, (req, res) => {
  const docId = req.params.id;

  // Verify ownership first
  db.get(
    'SELECT id FROM documents WHERE id = ? AND owner_id = ?',
    [docId, req.user.id],
    (err, doc) => {
      if (err) return res.status(500).json({ error: 'Database query failed.' });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      db.get(
        'SELECT * FROM document_extractions WHERE document_id = ?',
        [docId],
        (err, extraction) => {
          if (err) return res.status(500).json({ error: 'Failed to retrieve extraction data.' });
          if (!extraction) return res.status(404).json({ error: 'No extraction data found. Document may not have been processed yet.' });

          res.json({
            document_id: extraction.document_id,
            processing_status: extraction.processing_status,
            processing_time: extraction.processing_time,
            extracted_text: extraction.extracted_text,
            error_message: extraction.error_message,
            created_at: extraction.created_at,
            updated_at: extraction.updated_at
          });
        }
      );
    }
  );
});

// =============================================
// 4. GET EXTRACTED JSON
// =============================================
router.get('/:id/json', authenticateToken, (req, res) => {
  const docId = req.params.id;

  db.get(
    'SELECT id FROM documents WHERE id = ? AND owner_id = ?',
    [docId, req.user.id],
    (err, doc) => {
      if (err) return res.status(500).json({ error: 'Database query failed.' });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      db.get(
        'SELECT extracted_json, processing_status, error_message FROM document_extractions WHERE document_id = ?',
        [docId],
        (err, extraction) => {
          if (err) return res.status(500).json({ error: 'Failed to retrieve JSON data.' });
          if (!extraction) return res.status(404).json({ error: 'No extraction data found.' });

          if (extraction.processing_status !== 'Completed') {
            return res.json({
              document_id: parseInt(docId),
              processing_status: extraction.processing_status,
              error_message: extraction.error_message,
              extracted_json: null
            });
          }

          let parsed = null;
          try {
            parsed = JSON.parse(extraction.extracted_json);
          } catch (e) {
            parsed = extraction.extracted_json;
          }

          res.json({
            document_id: parseInt(docId),
            processing_status: 'Completed',
            extracted_json: parsed
          });
        }
      );
    }
  );
});

// =============================================
// 5. GET DOCUMENT STATISTICS
// =============================================
router.get('/:id/statistics', authenticateToken, (req, res) => {
  const docId = req.params.id;

  db.get(
    'SELECT id FROM documents WHERE id = ? AND owner_id = ?',
    [docId, req.user.id],
    (err, doc) => {
      if (err) return res.status(500).json({ error: 'Database query failed.' });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      db.get(
        'SELECT statistics, processing_status, processing_time, error_message FROM document_extractions WHERE document_id = ?',
        [docId],
        (err, extraction) => {
          if (err) return res.status(500).json({ error: 'Failed to retrieve statistics.' });
          if (!extraction) return res.status(404).json({ error: 'No extraction data found.' });

          if (extraction.processing_status !== 'Completed') {
            return res.json({
              document_id: parseInt(docId),
              processing_status: extraction.processing_status,
              error_message: extraction.error_message,
              statistics: null
            });
          }

          let stats = null;
          try {
            stats = JSON.parse(extraction.statistics);
          } catch (e) {
            stats = extraction.statistics;
          }

          // Add processing_time to stats
          if (stats && typeof stats === 'object') {
            stats.processing_time_ms = extraction.processing_time;
          }

          res.json({
            document_id: parseInt(docId),
            processing_status: 'Completed',
            statistics: stats
          });
        }
      );
    }
  );
});

// =============================================
// AI ANALYSIS: GET /api/documents/:id/analysis
// =============================================
router.get('/:id/analysis', authenticateToken, (req, res) => {
  const ownerId = req.user.id;
  const docId = req.params.id;

  // Verify ownership
  db.get(
    `SELECT id FROM documents WHERE id = ? AND owner_id = ?`,
    [docId, ownerId],
    (err, doc) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      db.get(
        `SELECT * FROM document_analyses WHERE document_id = ?`,
        [docId],
        (err, row) => {
          if (err) return res.status(500).json({ error: 'Database error.' });
          if (!row) {
            return res.json({ document_id: parseInt(docId), analysis_status: 'Not Started', message: 'Analysis has not been run yet. Upload or reprocess the document to trigger analysis.' });
          }

          const safeParse = (val) => { try { return val ? JSON.parse(val) : null; } catch { return val; } };

          return res.json({
            document_id: parseInt(docId),
            analysis_status: row.analysis_status,
            document_category: row.document_category,
            executive_summary: row.executive_summary,
            health_score: row.health_score,
            health_label: safeParse(row.health_label),
            sentiment: safeParse(row.sentiment),
            metrics: safeParse(row.metrics),
            insights: safeParse(row.insights),
            risks: safeParse(row.risks),
            recommendations: safeParse(row.recommendations),
            analysis_time: row.analysis_time,
            error_message: row.error_message,
            analyzed_at: row.updated_at
          });
        }
      );
    }
  );
});

// =============================================
// 6. GET WORKSPACE STATS
// =============================================
router.get('/stats', authenticateToken, (req, res) => {
  const ownerId = req.user.id;
  
  db.get(
    `SELECT 
       COUNT(*) as total_docs,
       COALESCE(SUM(file_size), 0) as storage_used,
       SUM(CASE WHEN processing_status IN ('Pending', 'Processing') THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN processing_status = 'Completed' THEN 1 ELSE 0 END) as completed_count
     FROM documents WHERE owner_id = ?`,
    [ownerId],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve stats.' });
      }
      
      res.json({
        total_docs: stats.total_docs || 0,
        storage_used: stats.storage_used || 0,
        pending_count: stats.pending_count || 0,
        completed_count: stats.completed_count || 0
      });
    }
  );
});

// =============================================
// 7. GET DOCUMENTS LIST (with Search, Filter, Sort, Pagination)
// =============================================
router.get('/', authenticateToken, (req, res) => {
  const ownerId = req.user.id;
  const search = req.query.search || '';
  const fileType = req.query.type || '';
  const status = req.query.status || '';
  const sortBy = req.query.sortBy || 'upload_date'; // upload_date, file_name, file_size
  const order = req.query.order || 'DESC'; // ASC, DESC
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  let query = 'FROM documents WHERE owner_id = ?';
  const params = [ownerId];

  if (search) {
    query += ' AND file_name LIKE ?';
    params.push(`%${search}%`);
  }

  if (fileType) {
    query += ' AND file_type = ?';
    params.push(fileType.toUpperCase());
  }

  if (status) {
    query += ' AND processing_status = ?';
    params.push(status);
  }

  // Count total for pagination
  db.get(`SELECT COUNT(*) as count ${query}`, params, (err, countRow) => {
    if (err) {
      return res.status(500).json({ error: 'Database pagination count failed.' });
    }

    const totalCount = countRow.count;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply sorting and limit/offset
    const validSortFields = ['upload_date', 'file_name', 'file_size'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'upload_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const selectQuery = `SELECT id, file_name, file_size, file_type, upload_date, processing_status ${query} 
                         ORDER BY ${sortField} ${sortOrder} 
                         LIMIT ? OFFSET ?`;
    
    params.push(limit, offset);

    db.all(selectQuery, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve documents.' });
      }

      res.json({
        documents: rows,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: page,
          limit: limit
        }
      });
    });
  });
});

// =============================================
// 8. GET SINGLE DOCUMENT (with extraction info)
// =============================================
router.get('/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM documents WHERE id = ? AND owner_id = ?',
    [req.params.id, req.user.id],
    (err, doc) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve document details.' });
      }
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      // Also get extraction info
      db.get(
        'SELECT processing_status, processing_time, error_message, created_at as extraction_created_at FROM document_extractions WHERE document_id = ?',
        [doc.id],
        (err, extraction) => {
          res.json({
            ...doc,
            extraction: extraction || null
          });
        }
      );
    }
  );
});

// =============================================
// 9. RENAME DOCUMENT
// =============================================
router.put('/:id', authenticateToken, (req, res) => {
  const { file_name } = req.body;
  if (!file_name || file_name.trim() === '') {
    return res.status(400).json({ error: 'File name cannot be empty.' });
  }

  db.get(
    'SELECT file_name FROM documents WHERE id = ? AND owner_id = ?',
    [req.params.id, req.user.id],
    (err, doc) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed.' });
      }
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      // Preserve original file extension if user changes it
      const originalExt = path.extname(doc.file_name);
      let newName = file_name.trim();
      if (!newName.toLowerCase().endsWith(originalExt.toLowerCase())) {
        newName += originalExt;
      }

      db.run(
        'UPDATE documents SET file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newName, req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to rename document.' });
          }
          res.json({ message: 'Document renamed successfully.', file_name: newName });
        }
      );
    }
  );
});

// =============================================
// 10. DELETE DOCUMENT
// =============================================
router.delete('/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT file_path FROM documents WHERE id = ? AND owner_id = ?',
    [req.params.id, req.user.id],
    (err, doc) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed.' });
      }
      if (!doc) {
        return res.status(404).json({ error: 'Document not found or access denied.' });
      }

      const filePathOnDisk = path.join(uploadsDir, doc.file_path);

      // 1. Delete related rows first (foreign keys)
      db.run('DELETE FROM document_analyses WHERE document_id = ?', [req.params.id], function () {
        db.run('DELETE FROM document_extractions WHERE document_id = ?', [req.params.id], function () {
          // 2. Delete from documents DB
          db.run('DELETE FROM documents WHERE id = ?', [req.params.id], function (err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to delete database record.' });
            }

            // 3. Delete file from disk
            if (fs.existsSync(filePathOnDisk)) {
              fs.unlink(filePathOnDisk, (unlinkErr) => {
                if (unlinkErr) {
                  console.error(`Failed to delete disk file: ${filePathOnDisk}`, unlinkErr);
                }
              });
            }
            res.json({ message: 'Document deleted successfully.' });
          });
        });
      });
    }
  );
});

// =============================================
// 11. DOWNLOAD DOCUMENT
// =============================================
router.get('/:id/download', authenticateToken, (req, res) => {
  db.get(
    'SELECT file_name, file_path FROM documents WHERE id = ? AND owner_id = ?',
    [req.params.id, req.user.id],
    (err, doc) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed.' });
      }
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const filePathOnDisk = path.join(uploadsDir, doc.file_path);
      
      if (!fs.existsSync(filePathOnDisk)) {
        return res.status(404).json({ error: 'File not found on disk.' });
      }

      res.download(filePathOnDisk, doc.file_name);
    }
  );
});

module.exports = router;
