import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, FileText, Clock, Cpu, AlertCircle, CheckCircle,
  RefreshCw, Download, BarChart3, FileCode, Type, Loader,
  Table, Hash, Columns, BookOpen, HardDrive, Layers, XCircle,
  Brain, TrendingUp, TrendingDown, Minus, ShieldAlert,
  Lightbulb, Target, Activity, Copy, FileDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import SkeletonLoader from '../components/SkeletonLoader';
import { exportAnalysisPDF } from '../utils/exportPDF';
import { API_BASE_URL } from '../config';

const DocumentDetails = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [jsonData, setJsonData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [reprocessing, setReprocessing] = useState(false);

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch document.');
      setDocument(data);
    } catch (err) {
      toast.error(err.message);
    }
  }, [id, token]);

  const fetchExtraction = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/extracted`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExtraction(data);
      }
    } catch {
      // Silently fail - extraction may not exist yet
    }
  }, [id, token]);

  const fetchJson = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/json`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJsonData(data);
      }
    } catch { /* silent */ }
  }, [id, token]);

  const fetchStatistics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/statistics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatistics(data);
      }
    } catch { /* silent */ }
  }, [id, token]);

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/analysis`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch { /* silent */ }
  }, [id, token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchDocument();
    await fetchExtraction();
    await fetchJson();
    await fetchStatistics();
    await fetchAnalysis();
    setLoading(false);
  }, [fetchDocument, fetchExtraction, fetchJson, fetchStatistics, fetchAnalysis]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh while processing
  useEffect(() => {
    if (document?.processing_status === 'Processing' || document?.processing_status === 'Pending') {
      const interval = setInterval(() => {
        fetchAll();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [document?.processing_status, fetchAll]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger processing.');
      toast.success('Document queued for processing.');
      // Refresh data
      setTimeout(() => fetchAll(), 1000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReprocessing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document?.file_name || 'document';
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Helpers
  const formatSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Completed':
        return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: <CheckCircle size={16} />, label: 'Completed' };
      case 'Processing':
        return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', icon: <Loader size={16} className="spin-icon" />, label: 'Processing...' };
      case 'Failed':
        return { color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)', icon: <XCircle size={16} />, label: 'Failed' };
      default:
        return { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', icon: <Clock size={16} />, label: 'Pending' };
    }
  };

  const getFileTypeIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'PDF': return { color: '#EF4444', label: 'PDF Document' };
      case 'XLSX': return { color: '#22C55E', label: 'Excel Spreadsheet' };
      case 'CSV': return { color: '#3B82F6', label: 'CSV Data File' };
      default: return { color: '#94A3B8', label: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', minHeight: '60vh' }}>
        <SkeletonLoader type="card" count={1} style={{ marginBottom: '1.5rem', height: '150px' }} />
        <SkeletonLoader type="rectangular" count={1} style={{ height: '300px' }} />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--accent)" style={{ marginBottom: '1rem' }} />
        <h3>Document Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>The document you're looking for doesn't exist or you don't have access.</p>
        <button className="btn btn-primary" onClick={() => navigate('/documents')} style={{ marginTop: '1.5rem' }}>
          <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Documents
        </button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(document.processing_status);
  const fileTypeConfig = getFileTypeIcon(document.file_type);
  const processingStatus = document.processing_status;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'analysis', label: 'AI Analysis', icon: <Brain size={16} /> },
    { id: 'text', label: 'Extracted Text', icon: <Type size={16} /> },
    { id: 'json', label: 'JSON Preview', icon: <FileCode size={16} /> },
    { id: 'statistics', label: 'Statistics', icon: <Table size={16} /> },
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>

      {/* Back Button */}
      <button
        onClick={() => navigate('/documents')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'transparent', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1.5rem',
          padding: '0.5rem 0', transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.color = 'var(--text-main)'}
        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={18} /> Back to Documents
      </button>



      {/* Document Header Card */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          {/* Left: File Info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flex: 1 }}>
            {/* File Type Badge */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '1rem',
              background: `${fileTypeConfig.color}15`,
              border: `1px solid ${fileTypeConfig.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <FileText size={28} color={fileTypeConfig.color} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                {document.file_name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                <span style={{
                  background: `${fileTypeConfig.color}20`, color: fileTypeConfig.color,
                  padding: '0.2rem 0.6rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem'
                }}>
                  {document.file_type}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <HardDrive size={14} /> {formatSize(document.file_size)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} /> {formatDate(document.upload_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Status + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            {/* Status Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: statusConfig.bg, color: statusConfig.color,
              padding: '0.5rem 1rem', borderRadius: '2rem',
              fontSize: '0.875rem', fontWeight: 600
            }}>
              {statusConfig.icon}
              {statusConfig.label}
            </div>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleDownload} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                <Download size={14} style={{ marginRight: '0.4rem' }} /> Download
              </button>
              <button
                onClick={handleReprocess}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                disabled={reprocessing || processingStatus === 'Processing'}
              >
                <RefreshCw size={14} style={{ marginRight: '0.4rem' }} className={reprocessing ? 'spin-icon' : ''} />
                {reprocessing ? 'Processing...' : 'Reprocess'}
              </button>
            </div>
          </div>
        </div>

        {/* Processing Animation */}
        {(processingStatus === 'Processing' || processingStatus === 'Pending') && (
          <div style={{
            marginTop: '1.5rem', padding: '1.25rem', borderRadius: '0.75rem',
            background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Cpu size={20} color="#F59E0B" className="spin-icon" />
              <span style={{ color: '#F59E0B', fontWeight: 600, fontSize: '0.95rem' }}>
                {processingStatus === 'Processing' ? 'AI is extracting document content...' : 'Waiting in processing queue...'}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="processing-bar" style={{ height: '100%', background: '#F59E0B', borderRadius: '2px' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              This page refreshes automatically. Extraction usually completes in a few seconds.
            </p>
          </div>
        )}

        {/* Failed Error Message */}
        {processingStatus === 'Failed' && document.extraction?.error_message && (
          <div style={{
            marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem',
            background: 'rgba(244, 63, 94, 0.06)', border: '1px solid rgba(244, 63, 94, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.35rem' }}>
              <XCircle size={16} /> Processing Failed
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {document.extraction.error_message}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        background: 'rgba(15, 23, 42, 0.5)', padding: '0.35rem',
        borderRadius: '0.75rem', border: '1px solid var(--surface-border)',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.65rem 1.25rem', borderRadius: '0.5rem',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontFamily: 'inherit',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-panel" style={{ minHeight: '300px' }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Document Overview</h3>
            
            {/* Stats Grid */}
            {statistics?.statistics && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {renderStatCards(statistics.statistics, document.file_type)}
              </div>
            )}

            {/* Extraction Summary */}
            {extraction && extraction.processing_status === 'Completed' && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 600, marginBottom: '0.75rem' }}>
                  <CheckCircle size={18} /> Extraction Complete
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <span><strong style={{ color: 'var(--text-main)' }}>Processing Time:</strong> {extraction.processing_time}ms</span>
                  <span><strong style={{ color: 'var(--text-main)' }}>Processed At:</strong> {formatDate(extraction.updated_at)}</span>
                </div>
              </div>
            )}

            {/* Document Properties Table */}
            <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Properties</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                ['Document ID', `#${document.id}`],
                ['File Name', document.file_name],
                ['File Type', document.file_type],
                ['File Size', formatSize(document.file_size)],
                ['Upload Date', formatDate(document.upload_date)],
                ['Processing Status', processingStatus],
                ['Processing Time', extraction?.processing_time ? `${extraction.processing_time}ms` : 'N/A'],
                ['Last Updated', formatDate(document.updated_at)]
              ].map(([label, value], idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem',
                  borderLeft: '3px solid var(--primary)'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</span>
                  <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXTRACTED TEXT TAB */}
        {activeTab === 'text' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Extracted Text</h3>
              {extraction?.extracted_text && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {extraction.extracted_text.length.toLocaleString()} characters
                </span>
              )}
            </div>
            {processingStatus !== 'Completed' ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                {processingStatus === 'Processing' || processingStatus === 'Pending' ? (
                  <>
                    <Loader size={36} className="spin-icon" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>Document is being processed. Text will appear here once extraction is complete.</p>
                  </>
                ) : (
                  <>
                    <XCircle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>Extraction failed. Try reprocessing the document.</p>
                  </>
                )}
              </div>
            ) : extraction?.extracted_text ? (
              <pre style={{
                background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)',
                borderRadius: '0.75rem', padding: '1.25rem', maxHeight: '600px',
                overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                fontSize: '0.825rem', lineHeight: '1.7', color: 'var(--text-main)'
              }}>
                {extraction.extracted_text}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <Type size={36} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>No text was extracted from this document.</p>
              </div>
            )}
          </div>
        )}

        {/* JSON PREVIEW TAB */}
        {activeTab === 'json' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>JSON Preview</h3>
              {jsonData?.extracted_json && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(jsonData.extracted_json, null, 2));
                    toast.success('JSON copied to clipboard!');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                >
                  <Copy size={14} /> Copy JSON
                </button>
              )}
            </div>
            {processingStatus !== 'Completed' ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                {processingStatus === 'Processing' || processingStatus === 'Pending' ? (
                  <>
                    <Loader size={36} className="spin-icon" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>JSON will be available after processing completes.</p>
                  </>
                ) : (
                  <>
                    <XCircle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>Extraction failed. Try reprocessing the document.</p>
                  </>
                )}
              </div>
            ) : jsonData?.extracted_json ? (
              <pre style={{
                background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)',
                borderRadius: '0.75rem', padding: '1.25rem', maxHeight: '600px',
                overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                fontSize: '0.8rem', lineHeight: '1.7', color: '#A5B4FC'
              }}>
                {JSON.stringify(jsonData.extracted_json, null, 2)}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <FileCode size={36} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>No structured JSON data was extracted.</p>
              </div>
            )}
          </div>
        )}

        {/* STATISTICS TAB */}
        {activeTab === 'statistics' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Document Statistics</h3>
            {processingStatus !== 'Completed' ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                {processingStatus === 'Processing' || processingStatus === 'Pending' ? (
                  <>
                    <Loader size={36} className="spin-icon" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>Statistics will be available after processing completes.</p>
                  </>
                ) : (
                  <>
                    <XCircle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p>Extraction failed. No statistics available.</p>
                  </>
                )}
              </div>
            ) : statistics?.statistics ? (
              <div>
                {/* Big Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {renderStatCards(statistics.statistics, document.file_type)}
                </div>

                {/* Raw Stats JSON */}
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Raw Statistics Data
                </h4>
                <pre style={{
                  background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)',
                  borderRadius: '0.75rem', padding: '1.25rem', maxHeight: '300px',
                  overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: '0.8rem', lineHeight: '1.6', color: '#86EFAC'
                }}>
                  {JSON.stringify(statistics.statistics, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <BarChart3 size={36} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>No statistics available.</p>
              </div>
            )}
          </div>
        )}

        {/* AI ANALYSIS TAB */}
        {activeTab === 'analysis' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Brain size={24} color="var(--primary)" />
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>AI Financial Analysis</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {analysis?.analyzed_at && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Analyzed {new Date(analysis.analyzed_at).toLocaleString()}
                  </span>
                )}
                {analysis?.analysis_status === 'Completed' && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={async () => {
                      try {
                        await exportAnalysisPDF(analysis, document);
                        toast.success('PDF report downloaded!');
                      } catch (err) {
                        toast.error('Failed to generate PDF: ' + err.message);
                      }
                    }}
                  >
                    <FileDown size={14} /> Download Report
                  </button>
                )}
              </div>
            </div>

            {(!analysis || analysis.analysis_status === 'Not Started') && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                <Brain size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p style={{ marginBottom: '0.5rem' }}>AI analysis hasn't run yet.</p>
                <p style={{ fontSize: '0.85rem' }}>Upload or reprocess the document to trigger automatic analysis.</p>
              </div>
            )}

            {analysis?.analysis_status === 'Processing' && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                <Cpu size={48} color="var(--primary)" className="spin-icon" style={{ marginBottom: '1rem' }} />
                <p>AI analysis is running...</p>
              </div>
            )}

            {analysis?.analysis_status === 'Failed' && (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                <XCircle size={48} style={{ marginBottom: '1rem', color: 'var(--accent)', opacity: 0.6 }} />
                <p style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Analysis Failed</p>
                <p style={{ fontSize: '0.85rem' }}>{analysis.error_message || 'An error occurred during analysis.'}</p>
              </div>
            )}

            {analysis?.analysis_status === 'Completed' && (() => {
              const metrics = analysis.metrics || {};
              const insights = analysis.insights || [];
              const risks = analysis.risks || [];
              const recs = analysis.recommendations || [];
              const score = analysis.health_score || 0;
              const healthLabel = analysis.health_label || {};
              const sentiment = analysis.sentiment || {};
              const scoreColor = healthLabel.color || '#94A3B8';

              const radius = 52;
              const circumference = 2 * Math.PI * radius;
              const dashOffset = circumference - (score / 100) * circumference;

              const metricKeys = Object.keys(metrics).filter(k =>
                !k.includes('ratio') && !k.includes('pct') && !k.includes('margin') && !k.includes('count') && metrics[k] > 0
              );
              const ratioKeys = Object.keys(metrics).filter(k =>
                k.includes('ratio') || k.includes('pct') || k.includes('margin')
              );
              const maxMetricVal = Math.max(...metricKeys.map(k => metrics[k]), 1);

              const fmtName = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const fmtVal = (k, v) => {
                if (k.includes('pct') || k.includes('margin')) return `${v}%`;
                if (k.includes('ratio')) return Number(v).toFixed(3);
                if (k.includes('count')) return v;
                if (v >= 10000000) return `₹${(v/10000000).toFixed(2)} Cr`;
                if (v >= 100000) return `₹${(v/100000).toFixed(2)} L`;
                if (v >= 1000) return `₹${Number(v).toLocaleString('en-IN')}`;
                return `₹${v}`;
              };

              const sentIcon = sentiment.label === 'Positive' ? <TrendingUp size={13}/> :
                               sentiment.label === 'Negative' ? <TrendingDown size={13}/> : <Minus size={13}/>;
              const sentColor = sentiment.label === 'Positive' ? '#10B981' :
                                sentiment.label === 'Negative' ? '#EF4444' : '#94A3B8';

              const riskCol   = (s) => s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#10B981';
              const riskBg    = (s) => s === 'high' ? 'rgba(239,68,68,0.07)' : s === 'medium' ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)';
              const riskBd    = (s) => s === 'high' ? 'rgba(239,68,68,0.2)' : s === 'medium' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)';
              const insCol    = (t) => t === 'positive' ? '#10B981' : t === 'negative' ? '#EF4444' : '#94A3B8';
              const insBg     = (t) => t === 'positive' ? 'rgba(16,185,129,0.07)' : t === 'negative' ? 'rgba(239,68,68,0.07)' : 'rgba(148,163,184,0.07)';
              const insBd     = (t) => t === 'positive' ? 'rgba(16,185,129,0.2)' : t === 'negative' ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.2)';
              const insIcon   = (t) => t === 'positive' ? <TrendingUp size={15}/> : t === 'negative' ? <TrendingDown size={15}/> : <Minus size={15}/>;
              const priCol    = (p) => p === 'high' ? '#EF4444' : p === 'medium' ? '#F59E0B' : '#10B981';
              const barColors = ['#6366F1','#22C55E','#EF4444','#F59E0B','#14B8A6','#EC4899','#8B5CF6','#0EA5E9'];

              return (
                <div>
                  {/* Hero Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>
                    {/* Health Score Ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--surface-border)', borderRadius: '1rem', padding: '1.5rem 2rem' }}>
                      <svg width={130} height={130} viewBox="0 0 130 130">
                        <circle cx={65} cy={65} r={radius} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={10}/>
                        <circle cx={65} cy={65} r={radius} fill="none" stroke={scoreColor} strokeWidth={10} strokeLinecap="round"
                          strokeDasharray={circumference} strokeDashoffset={dashOffset}
                          style={{ transform:'rotate(-90deg)', transformOrigin:'65px 65px', transition:'stroke-dashoffset 1s ease' }}
                        />
                        <text x="65" y="60" textAnchor="middle" fill="white" fontSize="24" fontWeight="700" fontFamily="inherit">{score}</text>
                        <text x="65" y="78" textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="inherit">out of 100</text>
                      </svg>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: scoreColor }}>{healthLabel.label || 'N/A'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Financial Health</span>
                    </div>

                    {/* Summary Panel */}
                    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--surface-border)', borderRadius: '1rem', padding: '1.25rem', height: '100%', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>Executive Summary</span>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                            {analysis.document_category}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: `${sentColor}18`, color: sentColor, padding: '0.2rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                            {sentIcon} {sentiment.label}
                          </span>
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.75', margin: 0 }}>
                        {analysis.executive_summary}
                      </p>
                    </div>
                  </div>

                  {/* Metrics */}
                  {Object.keys(metrics).length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Activity size={18} color="var(--primary)" />
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>Detected Financial Metrics</h4>
                      </div>
                      {ratioKeys.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                          {ratioKeys.map(k => (
                            <div key={k} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtName(k)}</span>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#818CF8' }}>{fmtVal(k, metrics[k])}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {metricKeys.length > 0 && (
                        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--surface-border)', borderRadius: '1rem', padding: '1.25rem' }}>
                          {metricKeys.map((k, i) => {
                            const col = barColors[i % barColors.length];
                            const pct = Math.max(3, (metrics[k] / maxMetricVal) * 100);
                            return (
                              <div key={k} style={{ marginBottom: i < metricKeys.length - 1 ? '1rem' : 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtName(k)}</span>
                                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: col }}>{fmtVal(k, metrics[k])}</span>
                                </div>
                                <div style={{ height: '8px', background: 'rgba(148,163,184,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${col}70, ${col})`, borderRadius: '4px' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Insights */}
                  {insights.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Lightbulb size={18} color="#F59E0B" />
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>Key Insights</h4>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {insights.map((ins, i) => (
                          <div key={i} style={{ background: insBg(ins.type), border: `1px solid ${insBd(ins.type)}`, borderLeft: `3px solid ${insCol(ins.type)}`, borderRadius: '0.75rem', padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: insCol(ins.type) }}>
                              {insIcon(ins.type)}
                              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ins.title}</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.65', margin: 0 }}>{ins.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {risks.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <ShieldAlert size={18} color="#EF4444" />
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>Risk Factors</h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {risks.map((risk, i) => (
                          <div key={i} style={{ background: riskBg(risk.severity), border: `1px solid ${riskBd(risk.severity)}`, borderRadius: '0.75rem', padding: '0.9rem 1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '50px' }}>
                              <ShieldAlert size={18} color={riskCol(risk.severity)} />
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: riskCol(risk.severity), letterSpacing: '0.04em' }}>{risk.severity}</span>
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, margin: '0 0 0.25rem', fontSize: '0.875rem', color: riskCol(risk.severity) }}>{risk.title}</p>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.65', margin: 0 }}>{risk.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {recs.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Target size={18} color="#22C55E" />
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>AI Recommendations</h4>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {recs.map((rec, i) => (
                          <div key={i} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--surface-border)', borderRadius: '0.75rem', padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rec.title}</span>
                              <span style={{ background: `${priCol(rec.priority)}15`, color: priCol(rec.priority), padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{rec.priority}</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.65', margin: 0 }}>{rec.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      </div>

      {/* Inline CSS for animations */}
      <style>{`
        .spin-icon {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .processing-bar {
          animation: processingPulse 2s ease-in-out infinite;
          width: 40%;
        }
        @keyframes processingPulse {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};

// ===============================
// Stat Card Renderer
// ===============================
function renderStatCards(stats, _fileType) {
  const cards = [];

  const cardStyle = (color) => ({
    background: `${color}08`,
    border: `1px solid ${color}20`,
    borderRadius: '0.75rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  });

  const labelStyle = { color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const valueStyle = (color) => ({ fontSize: '1.75rem', fontWeight: 700, color: color });

  // PDF stats
  if (stats.total_pages !== undefined) {
    cards.push(
      <div key="pages" style={cardStyle('#818CF8')}>
        <BookOpen size={20} color="#818CF8" />
        <span style={labelStyle}>Total Pages</span>
        <span style={valueStyle('#818CF8')}>{stats.total_pages}</span>
      </div>
    );
  }

  if (stats.total_words !== undefined) {
    cards.push(
      <div key="words" style={cardStyle('#F59E0B')}>
        <Type size={20} color="#F59E0B" />
        <span style={labelStyle}>Total Words</span>
        <span style={valueStyle('#F59E0B')}>{stats.total_words.toLocaleString()}</span>
      </div>
    );
  }

  if (stats.total_paragraphs !== undefined) {
    cards.push(
      <div key="paras" style={cardStyle('#10B981')}>
        <Layers size={20} color="#10B981" />
        <span style={labelStyle}>Paragraphs</span>
        <span style={valueStyle('#10B981')}>{stats.total_paragraphs}</span>
      </div>
    );
  }

  if (stats.total_characters !== undefined) {
    cards.push(
      <div key="chars" style={cardStyle('#3B82F6')}>
        <Hash size={20} color="#3B82F6" />
        <span style={labelStyle}>Characters</span>
        <span style={valueStyle('#3B82F6')}>{stats.total_characters.toLocaleString()}</span>
      </div>
    );
  }

  // Excel / CSV stats
  if (stats.total_sheets !== undefined) {
    cards.push(
      <div key="sheets" style={cardStyle('#22C55E')}>
        <Layers size={20} color="#22C55E" />
        <span style={labelStyle}>Worksheets</span>
        <span style={valueStyle('#22C55E')}>{stats.total_sheets}</span>
      </div>
    );
  }

  if (stats.total_rows !== undefined) {
    cards.push(
      <div key="rows" style={cardStyle('#818CF8')}>
        <Table size={20} color="#818CF8" />
        <span style={labelStyle}>Total Rows</span>
        <span style={valueStyle('#818CF8')}>{stats.total_rows.toLocaleString()}</span>
      </div>
    );
  }

  if (stats.total_data_rows !== undefined && stats.total_rows === undefined) {
    cards.push(
      <div key="data-rows" style={cardStyle('#818CF8')}>
        <Table size={20} color="#818CF8" />
        <span style={labelStyle}>Data Rows</span>
        <span style={valueStyle('#818CF8')}>{stats.total_data_rows.toLocaleString()}</span>
      </div>
    );
  }

  if (stats.total_columns !== undefined) {
    cards.push(
      <div key="cols" style={cardStyle('#F59E0B')}>
        <Columns size={20} color="#F59E0B" />
        <span style={labelStyle}>Columns</span>
        <span style={valueStyle('#F59E0B')}>{stats.total_columns}</span>
      </div>
    );
  }

  // File size (common)
  if (stats.file_size_bytes !== undefined) {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(stats.file_size_bytes) / Math.log(k));
    const formattedSize = parseFloat((stats.file_size_bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    cards.push(
      <div key="size" style={cardStyle('#EC4899')}>
        <HardDrive size={20} color="#EC4899" />
        <span style={labelStyle}>File Size</span>
        <span style={valueStyle('#EC4899')}>{formattedSize}</span>
      </div>
    );
  }

  // Processing time
  if (stats.processing_time_ms !== undefined) {
    cards.push(
      <div key="time" style={cardStyle('#14B8A6')}>
        <Clock size={20} color="#14B8A6" />
        <span style={labelStyle}>Processing Time</span>
        <span style={valueStyle('#14B8A6')}>{stats.processing_time_ms}ms</span>
      </div>
    );
  }

  return cards;
}

export default DocumentDetails;
