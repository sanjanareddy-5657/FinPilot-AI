import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Upload, Search, Trash2, Edit3, Download, 
  X, ChevronLeft, ChevronRight, Filter, ArrowUpDown, RefreshCw, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { API_BASE_URL } from '../config';

const Documents = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('upload_date');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total_items: 0, total_pages: 1 });

  // Modal & Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Rename state
  const [renamingId, setRenamingId] = useState(null);
  const [newName, setNewName] = useState('');

  // Fetch Documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        type: typeFilter,
        status: statusFilter,
        sortBy,
        order: sortOrder,
        page,
        limit: 8
      });
      
      const response = await fetch(`${API_BASE_URL}/documents?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch documents.');
      }
      
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, statusFilter, token, typeFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    validateAndPrepareFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    validateAndPrepareFiles(files);
  };

  const validateAndPrepareFiles = (files) => {
    const allowedExtensions = ['.pdf', '.csv', '.xlsx'];
    const validFiles = [];
    let fileErrors = [];

    files.forEach(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        fileErrors.push(`"${file.name}" is not supported (PDF, CSV, XLSX only).`);
      } else if (file.size > 10 * 1024 * 1024) {
        fileErrors.push(`"${file.name}" exceeds the 10MB size limit.`);
      } else {
        validFiles.push(file);
      }
    });

    if (fileErrors.length > 0) {
      toast.error(fileErrors.join(' '));
    }
    
    if (validFiles.length > 0) {
      setUploadingFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Perform Upload
  const performUpload = async () => {
    if (uploadingFiles.length === 0) return;
    
    setUploadProgress(0);
    
    const formData = new FormData();
    uploadingFiles.forEach(file => {
      formData.append('files', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/documents/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 201) {
        toast.success('Files uploaded successfully!');
        setUploadingFiles([]);
        setUploadProgress(null);
        setIsUploadOpen(false);
        setPage(1);
        fetchDocuments();
      } else {
        const res = JSON.parse(xhr.responseText);
        toast.error(res.error || 'Upload failed.');
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => {
      toast.error('Network error during upload.');
      setUploadProgress(null);
    };

    xhr.send(formData);
  };

  // Delete document
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document? This will also remove the physical file from storage.')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete file.');
      
      toast.success('Document deleted.');
      fetchDocuments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Download document
  const handleDownload = async (id, filename) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Download failed.');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Rename document
  const handleRename = async (id) => {
    if (!newName.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_name: newName })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Rename failed.');
      
      toast.success('Document renamed.');
      setRenamingId(null);
      setNewName('');
      fetchDocuments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Helpers
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'var(--secondary)';
      case 'Processing': return '#F59E0B'; // Orange/Amber
      case 'Failed': return 'var(--accent)';
      default: return 'var(--text-muted)'; // Pending
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Documents</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage, upload, and organize your financial documents.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsUploadOpen(true)}>
          <Upload size={18} style={{ marginRight: '0.5rem' }} /> Upload Files
        </button>
      </div>

      {/* Toolbar / Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--surface-border)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Filter size={16} /> Filter:
            </div>
            
            {/* File Type */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--surface-border)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">All Formats</option>
              <option value="PDF">PDF</option>
              <option value="CSV">CSV</option>
              <option value="XLSX">Excel</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--surface-border)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {/* Sort controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <ArrowUpDown size={16} /> Sort by:
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--surface-border)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="upload_date">Upload Date</option>
              <option value="file_name">Name</option>
              <option value="file_size">Size</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
              className="btn btn-secondary"
              style={{ padding: '0.6rem', minWidth: 'auto', display: 'flex', justifyContent: 'center' }}
            >
              {sortOrder === 'ASC' ? 'ASC' : 'DESC'}
            </button>

            <button
              onClick={fetchDocuments}
              className="btn btn-secondary"
              style={{ padding: '0.6rem', minWidth: 'auto', display: 'flex', justifyContent: 'center' }}
              title="Refresh table"
            >
              <RefreshCw size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* Documents Table */}
      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', minHeight: '300px' }}>
        {loading ? (
          <div style={{ padding: '1rem 0' }}>
            <SkeletonLoader type="tableRow" count={5} />
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '3rem 1rem' }}>
            <EmptyState 
              icon={FileText} 
              title="No documents found" 
              description="Upload some files or adjust your search filters." 
              iconSize={40}
            />
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Name</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Format</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Size</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Upload Date</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', transition: 'background 0.2s' }}>
                    
                    {/* File Name (or Rename input) */}
                    <td style={{ padding: '1rem 1.5rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {renamingId === doc.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '0.25rem',
                              border: '1px solid var(--primary)',
                              background: 'rgba(15, 23, 42, 0.8)',
                              color: 'white',
                              fontSize: '0.875rem',
                              outline: 'none',
                              width: '200px'
                            }}
                          />
                          <button onClick={() => handleRename(doc.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>Save</button>
                          <button onClick={() => { setRenamingId(null); setNewName(''); }} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FileText size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, cursor: 'pointer' }} title={doc.file_name} onClick={() => navigate(`/documents/${doc.id}`)}>{doc.file_name}</span>
                        </div>
                      )}
                    </td>
                    
                    {/* Format */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-main)'
                      }}>
                        {doc.file_type}
                      </span>
                    </td>
                    
                    {/* Size */}
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {formatSize(doc.file_size)}
                    </td>
                    
                    {/* Upload Date */}
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {new Date(doc.upload_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    
                    {/* Status */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(doc.processing_status)
                        }} />
                        <span style={{ color: getStatusColor(doc.processing_status) }}>{doc.processing_status}</span>
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem', minWidth: 'auto' }}
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => { setRenamingId(doc.id); setNewName(doc.file_name.substring(0, doc.file_name.lastIndexOf('.'))); }}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem', minWidth: 'auto' }}
                          title="Rename file"
                        >
                          <Edit3 size={15} />
                        </button>
                        
                        <button
                          onClick={() => handleDownload(doc.id, doc.file_name)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem', minWidth: 'auto' }}
                          title="Download file"
                        >
                          <Download size={15} />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem', minWidth: 'auto', hover: { color: 'var(--accent)' } }}
                          title="Delete file"
                        >
                          <Trash2 size={15} color="var(--accent)" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination footer */}
            {pagination.total_pages > 1 && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <div>
                  Showing Page {pagination.current_page} of {pagination.total_pages} ({pagination.total_items} total items)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, pagination.total_pages))}
                    disabled={page === pagination.total_pages}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 8. UPLOAD MODAL */}
      {isUploadOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.5rem' }}>Upload Documents</h3>
              <button 
                onClick={() => { setIsUploadOpen(false); setUploadingFiles([]); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              style={{
                border: '2px dashed var(--surface-border)',
                borderRadius: '0.75rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.2s',
                hover: { borderColor: 'var(--primary)' }
              }}
            >
              <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Drag & Drop files here</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supported formats: PDF, CSV, Excel (Max 10MB per file)</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept=".pdf,.csv,.xlsx"
              />
            </div>

            {/* Uploading Files List */}
            {uploadingFiles.length > 0 && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Files ready for upload:</h4>
                {uploadingFiles.map((file, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <FileText size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{file.name}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(file.size)}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setUploadingFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', marginLeft: '0.5rem' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress indicator */}
            {uploadProgress !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.1s linear' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => { setIsUploadOpen(false); setUploadingFiles([]); }}
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={uploadProgress !== null}
              >
                Cancel
              </button>
              <button 
                onClick={performUpload}
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={uploadingFiles.length === 0 || uploadProgress !== null}
              >
                Upload {uploadingFiles.length > 0 ? `(${uploadingFiles.length} files)` : ''}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Documents;
