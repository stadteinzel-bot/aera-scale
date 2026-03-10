import React, { useState, useMemo, useEffect } from 'react';
import { Property, Tenant, PropertyDocument, DocumentType } from '../types';
import { dataService } from '../services/dataService';
import { useDataCore } from '../core/DataCoreProvider';
import { useOrg } from '../services/OrgContext';
import { useTranslation } from '../core/i18nProvider';
import { analyzeLeaseDocument } from '../services/geminiService';
import {
    getQuotaInfo, checkQuota, recordUpload, recordDelete,
    formatBytes, PLAN_LABELS, type QuotaInfo,
} from '../services/storageQuota';
import {
    FileText, Upload, Search, Trash2, Download, Eye, X,
    Building2, Users, Calendar, HardDrive, Sparkles, Loader2,
    FileCheck, FileClock, FileWarning, ExternalLink, Pencil, Save, XCircle, AlertTriangle,
} from 'lucide-react';

const DOCUMENT_TYPES: DocumentType[] = ['Mietvertrag', 'Energieausweis', 'Grundbuchauszug', 'Übergabeprotokoll', 'Nebenkostenabrechnung', 'Sonstige'];

const typeColors: Record<DocumentType, string> = {
    'Mietvertrag': 'bg-blue-100 text-blue-700',
    'Energieausweis': 'bg-green-100 text-green-700',
    'Grundbuchauszug': 'bg-purple-100 text-purple-700',
    'Übergabeprotokoll': 'bg-amber-100 text-amber-700',
    'Nebenkostenabrechnung': 'bg-rose-100 text-rose-700',
    'Sonstige': 'bg-slate-100 text-slate-700',
};

const typeIcons: Record<DocumentType, React.ReactNode> = {
    'Mietvertrag': <FileCheck className="w-4 h-4" />,
    'Energieausweis': <FileText className="w-4 h-4" />,
    'Grundbuchauszug': <FileText className="w-4 h-4" />,
    'Übergabeprotokoll': <FileText className="w-4 h-4" />,
    'Nebenkostenabrechnung': <FileText className="w-4 h-4" />,
    'Sonstige': <FileText className="w-4 h-4" />,
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getExpiryStatus(expiresAt?: string): { label: string; color: string; icon: React.ReactNode } | null {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: `Abgelaufen (${Math.abs(daysLeft)} Tage)`, color: 'bg-red-100 text-red-700 border-red-200', icon: <FileWarning className="w-3.5 h-3.5" /> };
    if (daysLeft <= 30) return { label: `${daysLeft} Tage`, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <FileClock className="w-3.5 h-3.5" /> };
    if (daysLeft <= 90) return { label: `${daysLeft} Tage`, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <FileClock className="w-3.5 h-3.5" /> };
    return { label: `${daysLeft} Tage`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <FileCheck className="w-3.5 h-3.5" /> };
}

function isImageMime(mime: string): boolean {
    return /^image\/(png|jpe?g|gif|webp|svg)/.test(mime);
}

function isPdfMime(mime: string): boolean {
    return mime === 'application/pdf';
}

const Documents: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading, reload } = useDataCore();
    const { orgId } = useOrg();
    const { t } = useTranslation();
    const documents = propertyId ? data.documents.filter(d => d.propertyId === propertyId) : data.documents;
    const properties = data.properties;
    const tenants = propertyId ? data.tenants.filter(t => t.propertyId === propertyId) : data.tenants;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<DocumentType | ''>('');
    const [filterProperty, setFilterProperty] = useState('');

    // Storage quota state
    const [quota, setQuota] = useState<QuotaInfo | null>(null);
    useEffect(() => {
        if (orgId) getQuotaInfo(orgId).then(setQuota).catch(() => { });
    }, [orgId]);

    // Upload Modal
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadData, setUploadData] = useState<{
        name: string; type: DocumentType; propertyId: string; tenantId: string;
        expiresAt: string; notes: string;
    }>({ name: '', type: 'Mietvertrag', propertyId: '', tenantId: '', expiresAt: '', notes: '' });
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [quotaError, setQuotaError] = useState<string | null>(null);

    // Detail Modal
    const [selectedDoc, setSelectedDoc] = useState<PropertyDocument | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editData, setEditData] = useState<{
        name: string; type: DocumentType; propertyId: string; tenantId: string;
        expiresAt: string; notes: string;
    }>({ name: '', type: 'Mietvertrag', propertyId: '', tenantId: '', expiresAt: '', notes: '' });

    const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || '—';
    const getTenantName = (id?: string) => id ? tenants.find(t => t.id === id)?.name || '—' : '—';

    const filteredDocs = useMemo(() => {
        return documents.filter(d => {
            if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase()) && !d.fileName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterType && d.type !== filterType) return false;
            if (filterProperty && d.propertyId !== filterProperty) return false;
            return true;
        }).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    }, [documents, searchTerm, filterType, filterProperty]);

    const expiringCount = useMemo(() => {
        const now = new Date();
        const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        return documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= sixtyDaysFromNow).length;
    }, [documents]);

    // --- Handlers ---

    const handleFileSelect = (file: File) => {
        setUploadFile(file);
        if (!uploadData.name) {
            setUploadData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadData.propertyId || !uploadData.name) return;
        setIsUploading(true);
        setQuotaError(null);
        try {
            // ── Quota check before upload ──
            if (orgId) {
                const { allowed, quota: q } = await checkQuota(orgId, uploadFile.size);
                if (!allowed) {
                    const limitLabel = q.limitGB === -1 ? '∞' : `${q.limitGB} GB`;
                    setQuotaError(`Speicherlimit erreicht (${q.usedGB} GB / ${limitLabel}). Bitte upgraden Sie Ihren Plan.`);
                    setIsUploading(false);
                    return;
                }
            }
            const storagePath = `documents/${orgId}/${uploadData.propertyId}/${Date.now()}_${uploadFile.name}`;
            const { url, storagePath: path } = await dataService.uploadFile(uploadFile, storagePath);
            await dispatch({
                type: 'document:add', payload: {
                    name: uploadData.name,
                    type: uploadData.type,
                    propertyId: uploadData.propertyId,
                    tenantId: uploadData.tenantId || '',
                    fileUrl: url,
                    storagePath: path,
                    fileName: uploadFile.name,
                    fileSize: uploadFile.size,
                    mimeType: uploadFile.type,
                    uploadedAt: new Date().toISOString(),
                    expiresAt: uploadData.expiresAt || '',
                    notes: uploadData.notes || '',
                }
            });
            // ── Record usage after successful upload ──
            if (orgId) {
                await recordUpload(orgId, uploadFile.size);
                getQuotaInfo(orgId).then(setQuota).catch(() => { });
            }
            setIsUploadOpen(false);
            setUploadFile(null);
            setUploadData({ name: '', type: 'Mietvertrag', propertyId: '', tenantId: '', expiresAt: '', notes: '' });
        } catch (error: any) {
            alert(`Upload fehlgeschlagen: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (doc: PropertyDocument) => {
        if (!window.confirm(`Dokument "${doc.name}" wirklich löschen? Die Datei wird unwiderruflich entfernt.`)) return;
        try {
            await dataService.deleteDocument(doc.id, doc.storagePath);
            // ── Record storage freed after delete ──
            if (orgId && doc.fileSize) {
                await recordDelete(orgId, doc.fileSize);
                getQuotaInfo(orgId).then(setQuota).catch(() => { });
            }
            await reload(['documents']);
            if (selectedDoc?.id === doc.id) { setIsDetailOpen(false); setIsEditing(false); }
        } catch (error: any) {
            alert(`Löschen fehlgeschlagen: ${error.message}`);
        }
    };

    const handleAIAnalyze = async (doc: PropertyDocument) => {
        setIsAnalyzing(true);
        try {
            const analysis = await analyzeLeaseDocument(doc.fileUrl);
            await dispatch({ type: 'document:update', id: doc.id, payload: { aiAnalysis: analysis } });
            setSelectedDoc({ ...doc, aiAnalysis: analysis });
        } catch (error: any) {
            alert(`AI-Analyse fehlgeschlagen: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const openDetail = (doc: PropertyDocument) => {
        setSelectedDoc(doc);
        setIsEditing(false);
        setIsDetailOpen(true);
    };

    const startEditing = () => {
        if (!selectedDoc) return;
        setEditData({
            name: selectedDoc.name,
            type: selectedDoc.type,
            propertyId: selectedDoc.propertyId,
            tenantId: selectedDoc.tenantId || '',
            expiresAt: selectedDoc.expiresAt || '',
            notes: selectedDoc.notes || '',
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        if (!selectedDoc || !editData.name || !editData.propertyId) return;
        setIsSaving(true);
        try {
            const updates: Partial<PropertyDocument> = {
                name: editData.name,
                type: editData.type,
                propertyId: editData.propertyId,
                tenantId: editData.tenantId,
                expiresAt: editData.expiresAt,
                notes: editData.notes,
            };
            await dispatch({ type: 'document:update', id: selectedDoc.id, payload: updates });
            setSelectedDoc({ ...selectedDoc, ...updates });
            setIsEditing(false);
        } catch (error: any) {
            alert(`Speichern fehlgeschlagen: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Document Preview Component ---
    const DocumentPreview: React.FC<{ doc: PropertyDocument }> = ({ doc }) => {
        if (isImageMime(doc.mimeType)) {
            return (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                        src={doc.fileUrl}
                        alt={doc.name}
                        className="w-full max-h-[400px] object-contain bg-white"
                        loading="lazy"
                    />
                </div>
            );
        }
        if (isPdfMime(doc.mimeType)) {
            return (
                <div className="rounded-xl overflow-hidden border border-slate-200">
                    <iframe
                        src={doc.fileUrl}
                        title={doc.name}
                        className="w-full h-[400px] bg-white"
                    />
                </div>
            );
        }
        // Fallback for non-previewable files
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">{doc.fileName}</p>
                <p className="text-xs text-slate-400 mt-1">{doc.mimeType || 'Unbekannter Dateityp'} · {formatFileSize(doc.fileSize)}</p>
                <p className="text-xs text-slate-400 mt-2">Keine Vorschau verfügbar — Datei herunterladen zum Ansehen.</p>
            </div>
        );
    };

    // --- RENDER ---

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-aera-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Dokumente werden geladen...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900">{t('documents.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('documents.subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl hover:bg-aera-700 transition-colors shadow-lg shadow-aera-600/20 font-medium text-sm"
                >
                    <Upload className="w-4 h-4" />
                    Dokument hochladen
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-aera-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-aera-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-aera-900">{documents.length}</p>
                            <p className="text-xs text-slate-500">Dokumente gesamt</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-aera-900">{documents.filter(d => d.type === 'Mietvertrag').length}</p>
                            <p className="text-xs text-slate-500">Mietverträge</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <FileClock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600">{expiringCount}</p>
                            <p className="text-xs text-slate-500">Bald ablaufend (&lt;60 Tage)</p>
                        </div>
                    </div>
                </div>
                {/* Storage Quota Card */}
                <div className={`bg-white rounded-xl p-4 border shadow-sm ${quota?.isAtLimit ? 'border-red-300 bg-red-50' :
                    quota?.isNearLimit ? 'border-amber-300 bg-amber-50' :
                        'border-slate-200'
                    }`}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${quota?.isAtLimit ? 'bg-red-100' : quota?.isNearLimit ? 'bg-amber-100' : 'bg-emerald-100'
                            }`}>
                            {quota?.isAtLimit
                                ? <AlertTriangle className="w-5 h-5 text-red-600" />
                                : <HardDrive className="w-5 h-5 text-emerald-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-aera-900 leading-none">
                                {quota ? `${quota.usedGB} GB` : formatBytes(documents.reduce((s, d) => s + d.fileSize, 0))}
                            </p>
                            <p className="text-xs text-slate-500">
                                {quota ? `von ${quota.limitGB === -1 ? '∞' : quota.limitGB + ' GB'} · ${PLAN_LABELS[quota.plan]}` : 'Speicher genutzt'}
                            </p>
                        </div>
                    </div>
                    {quota && quota.limitBytes !== -1 && (
                        <div className="space-y-1">
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${quota.isAtLimit ? 'bg-red-500' : quota.isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 text-right">{quota.percentUsed.toFixed(1)}% genutzt</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                        placeholder="Dokument suchen..."
                    />
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as DocumentType | '')}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                >
                    <option value="">Alle Typen</option>
                    {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                    value={filterProperty}
                    onChange={e => setFilterProperty(e.target.value)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                >
                    <option value="">Alle Immobilien</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {/* Document Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredDocs.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-600 mb-1">Keine Dokumente</h3>
                        <p className="text-sm text-slate-400 mb-6">{documents.length === 0 ? 'Laden Sie Ihr erstes Dokument hoch.' : 'Keine Dokumente für diese Filter.'}</p>
                        {documents.length === 0 && (
                            <button onClick={() => setIsUploadOpen(true)} className="inline-flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors">
                                <Upload className="w-4 h-4" /> Erstes Dokument hochladen
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Dokument</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Typ</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Immobilie</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Mieter</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Ablauf</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Größe</th>
                                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocs.map(doc => {
                                const expiry = getExpiryStatus(doc.expiresAt);
                                return (
                                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => openDetail(doc)}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                {/* Thumbnail preview */}
                                                {isImageMime(doc.mimeType) ? (
                                                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                                        <img src={doc.fileUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeColors[doc.type]}`}>
                                                        {typeIcons[doc.type]}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-slate-900 group-hover:text-aera-700 transition-colors">{doc.name}</p>
                                                    <p className="text-xs text-slate-400">{doc.fileName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[doc.type]}`}>
                                                {doc.type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{getPropertyName(doc.propertyId)}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{getTenantName(doc.tenantId)}</td>
                                        <td className="px-5 py-3.5">
                                            {expiry ? (
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${expiry.color}`}>
                                                    {expiry.icon} {expiry.label}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-500 text-xs">{formatFileSize(doc.fileSize)}</td>
                                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openDetail(doc)} className="p-2 rounded-lg hover:bg-aera-100 text-slate-500 hover:text-aera-700 transition-colors" title="Details & Vorschau">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => { setSelectedDoc(doc); startEditing(); setIsDetailOpen(true); }} className="p-2 rounded-lg hover:bg-blue-100 text-slate-500 hover:text-blue-700 transition-colors" title="Bearbeiten">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 transition-colors" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </a>
                                                <button onClick={() => handleDelete(doc)} className="p-2 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors" title="Löschen">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* UPLOAD MODAL */}
            {isUploadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-aera-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                            <h2 className="text-xl font-bold text-aera-900">Dokument hochladen</h2>
                            <button onClick={() => { setIsUploadOpen(false); setUploadFile(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Drop Zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragOver ? 'border-aera-500 bg-aera-50' : 'border-slate-300 hover:border-aera-400 hover:bg-slate-50'}`}
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <input
                                    id="file-input"
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                />
                                {uploadFile ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <FileCheck className="w-8 h-8 text-emerald-500" />
                                        <div className="text-left">
                                            <p className="font-medium text-slate-900">{uploadFile.name}</p>
                                            <p className="text-xs text-slate-500">{formatFileSize(uploadFile.size)} · {uploadFile.type || 'Unbekannt'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-600">Datei hierher ziehen oder klicken</p>
                                        <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, TXT, PNG, JPG (max. 10 MB)</p>
                                    </>
                                )}
                            </div>

                            {/* Form Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dokumentname *</label>
                                    <input value={uploadData.name} onChange={e => setUploadData(prev => ({ ...prev, name: e.target.value }))} placeholder="z.B. Mietvertrag Müller" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dokumenttyp *</label>
                                    <select value={uploadData.type} onChange={e => setUploadData(prev => ({ ...prev, type: e.target.value as DocumentType }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                        {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ablaufdatum</label>
                                    <input type="date" value={uploadData.expiresAt} onChange={e => setUploadData(prev => ({ ...prev, expiresAt: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Immobilie *</label>
                                    <select value={uploadData.propertyId} onChange={e => setUploadData(prev => ({ ...prev, propertyId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                        <option value="">Auswählen...</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Mieter</label>
                                    <select value={uploadData.tenantId} onChange={e => setUploadData(prev => ({ ...prev, tenantId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                        <option value="">Optional...</option>
                                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
                                    <input value={uploadData.notes} onChange={e => setUploadData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Optionale Notizen zum Dokument..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            {quotaError && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex-1 mr-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {quotaError}
                                </div>
                            )}
                            <button onClick={() => { setIsUploadOpen(false); setUploadFile(null); setQuotaError(null); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Abbrechen</button>
                            <button
                                onClick={handleUpload}
                                disabled={!uploadFile || !uploadData.propertyId || !uploadData.name || isUploading || quota?.isAtLimit === true}
                                className="flex items-center gap-2 bg-aera-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird hochgeladen...</> : <><Upload className="w-4 h-4" /> Hochladen</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL — with Preview + Edit */}
            {isDetailOpen && selectedDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-aera-100 max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-aera-50 shrink-0">
                            <h2 className="text-lg font-bold text-aera-900">
                                {isEditing ? 'Dokument bearbeiten' : 'Dokument-Details'}
                            </h2>
                            <div className="flex items-center gap-2">
                                {!isEditing && (
                                    <button onClick={startEditing} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-aera-700 px-3 py-1.5 rounded-lg hover:bg-aera-100 transition-colors" title="Bearbeiten">
                                        <Pencil className="w-4 h-4" /> Bearbeiten
                                    </button>
                                )}
                                <button onClick={() => { setIsDetailOpen(false); setIsEditing(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* DOCUMENT PREVIEW — always visible at top */}
                            <DocumentPreview doc={selectedDoc} />

                            {isEditing ? (
                                /* ===== EDIT MODE ===== */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Dokumentname *</label>
                                            <input value={editData.name} onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Dokumenttyp</label>
                                            <select value={editData.type} onChange={e => setEditData(prev => ({ ...prev, type: e.target.value as DocumentType }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Ablaufdatum</label>
                                            <input type="date" value={editData.expiresAt} onChange={e => setEditData(prev => ({ ...prev, expiresAt: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Immobilie *</label>
                                            <select value={editData.propertyId} onChange={e => setEditData(prev => ({ ...prev, propertyId: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                                <option value="">Auswählen...</option>
                                                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Mieter</label>
                                            <select value={editData.tenantId} onChange={e => setEditData(prev => ({ ...prev, tenantId: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                                <option value="">Keiner</option>
                                                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
                                            <textarea value={editData.notes} onChange={e => setEditData(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Notizen zum Dokument..." className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm resize-none" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ===== VIEW MODE ===== */
                                <>
                                    {/* File Info */}
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeColors[selectedDoc.type]} shrink-0`}>
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-slate-900">{selectedDoc.name}</h3>
                                            <p className="text-sm text-slate-500 mt-0.5">{selectedDoc.fileName} · {formatFileSize(selectedDoc.fileSize)}</p>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[selectedDoc.type]}`}>
                                                    {selectedDoc.type}
                                                </span>
                                                {getExpiryStatus(selectedDoc.expiresAt) && (() => {
                                                    const exp = getExpiryStatus(selectedDoc.expiresAt)!;
                                                    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${exp.color}`}>{exp.icon} {exp.label}</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metadata Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Building2 className="w-3.5 h-3.5" /> Immobilie</div>
                                            <p className="font-medium text-slate-900 text-sm">{getPropertyName(selectedDoc.propertyId)}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Users className="w-3.5 h-3.5" /> Mieter</div>
                                            <p className="font-medium text-slate-900 text-sm">{getTenantName(selectedDoc.tenantId)}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Calendar className="w-3.5 h-3.5" /> Hochgeladen</div>
                                            <p className="font-medium text-slate-900 text-sm">{new Date(selectedDoc.uploadedAt).toLocaleDateString('de-DE')}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Calendar className="w-3.5 h-3.5" /> Ablaufdatum</div>
                                            <p className="font-medium text-slate-900 text-sm">{selectedDoc.expiresAt ? new Date(selectedDoc.expiresAt).toLocaleDateString('de-DE') : '—'}</p>
                                        </div>
                                    </div>

                                    {selectedDoc.notes && (
                                        <div className="bg-slate-50 rounded-lg p-4">
                                            <p className="text-xs text-slate-500 mb-1 font-medium">Notizen</p>
                                            <p className="text-sm text-slate-700">{selectedDoc.notes}</p>
                                        </div>
                                    )}

                                    {/* AI Analysis */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-gradient-to-r from-aera-50 to-emerald-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-aera-600" />
                                                <span className="text-sm font-semibold text-aera-900">KI-Dokumentenanalyse</span>
                                            </div>
                                            <button
                                                onClick={() => handleAIAnalyze(selectedDoc)}
                                                disabled={isAnalyzing}
                                                className="flex items-center gap-1.5 bg-aera-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-aera-700 transition-colors disabled:opacity-50"
                                            >
                                                {isAnalyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyse läuft...</> : <><Sparkles className="w-3.5 h-3.5" /> Analysieren</>}
                                            </button>
                                        </div>
                                        <div className="p-4">
                                            {selectedDoc.aiAnalysis ? (
                                                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                                    {selectedDoc.aiAnalysis}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <Sparkles className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                                    <p className="text-sm text-slate-500">Klicken Sie auf "Analysieren", um dieses Dokument mit KI zu prüfen.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            {isEditing ? (
                                <>
                                    <button onClick={cancelEditing} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                                        <XCircle className="w-4 h-4" /> Abbrechen
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={!editData.name || !editData.propertyId || isSaving}
                                        className="flex items-center gap-2 bg-aera-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-aera-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</> : <><Save className="w-4 h-4" /> Änderungen speichern</>}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleDelete(selectedDoc)} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium transition-colors">
                                        <Trash2 className="w-4 h-4" /> Löschen
                                    </button>
                                    <div className="flex gap-3">
                                        <a href={selectedDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">
                                            <ExternalLink className="w-4 h-4" /> Öffnen
                                        </a>
                                        <a href={selectedDoc.fileUrl} download className="flex items-center gap-2 bg-aera-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-700 transition-colors">
                                            <Download className="w-4 h-4" /> Herunterladen
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documents;
