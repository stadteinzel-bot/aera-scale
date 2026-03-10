
import React, { useState, useRef, useEffect } from 'react';
import { analyzeLeaseDocument, generateLeaseDocument } from '../services/geminiService';
import { Tenant, Property } from '../types';
import { FileText, ShieldAlert, Sparkles, CheckCircle, UploadCloud, X, File as FileIcon, PenTool, Download, Copy, Printer, Eye } from 'lucide-react';
import { useDataCore } from '../core/DataCoreProvider';
import { downloadTextAsPdf, previewTextAsPdf } from '../utils/pdfExport';

const LeaseAnalyzer: React.FC<{ propertyId?: string }> = ({ propertyId: propId }) => {
    // Use centrally loaded data — no independent dataService calls needed
    const { data } = useDataCore();
    const properties = data.properties;
    const tenants = data.tenants;

    // Tab State
    const [activeTab, setActiveTab] = useState<'analyze' | 'draft'>('analyze');

    // Analysis State
    const [leaseText, setLeaseText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drafting State
    const [draftType, setDraftType] = useState('Neuer Mietvertrag');
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState(propId || '');
    const [draftDetails, setDraftDetails] = useState({
        termLength: '1 Year',
        rentIncrease: '3%',
        effectiveDate: new Date().toISOString().split('T')[0],
        additionalNotes: ''
    });
    const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // PDF Preview
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

    // Sync selected property when prop changes or properties load
    useEffect(() => {
        if (propId && properties.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(propId);
        }
    }, [propId, properties]);

    // --- ANALYSIS HANDLERS ---

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setLeaseText(''); // Clear text when file is selected
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
            setLeaseText('');
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleAnalyze = async () => {
        if (!leaseText.trim() && !selectedFile) return;
        setIsAnalyzing(true);

        let result;
        if (selectedFile) {
            try {
                const base64Str = await fileToBase64(selectedFile);
                // Remove data URL prefix (e.g., "data:application/pdf;base64,")
                const base64Data = base64Str.split(',')[1];
                result = await analyzeLeaseDocument({
                    mimeType: selectedFile.type,
                    data: base64Data
                });
            } catch (e) {
                result = "Error reading file.";
            }
        } else {
            result = await analyzeLeaseDocument(leaseText);
        }

        setAnalysis(result);
        setIsAnalyzing(false);
    };

    // --- DRAFTING HANDLERS ---

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    const filteredTenants = selectedPropertyId
        ? tenants.filter(t => t.propertyId === selectedPropertyId)
        : tenants;

    const handleGenerateDraft = async () => {
        if (!selectedTenantId || !selectedPropertyId) return;
        setIsGenerating(true);

        const tenant = tenants.find(t => t.id === selectedTenantId);
        const property = properties.find(p => p.id === selectedPropertyId);

        if (tenant && property) {
            const ll = property.landlord;
            const draft = await generateLeaseDocument(
                draftType,
                tenant.name,
                property.address,
                {
                    ...draftDetails,
                    propertyName: property.name,
                    propertyType: property.type,
                    currentRent: `€${tenant.monthlyRent.toLocaleString()}`,
                    leaseEnd: tenant.leaseEnd
                },
                ll ? {
                    name: ll.name,
                    address: `${ll.address}, ${ll.zipCode} ${ll.city}`,
                    email: ll.email,
                    iban: ll.iban,
                    bankName: ll.bankName,
                } : undefined
            );
            setGeneratedDraft(draft);
        }
        setIsGenerating(false);
    };

    const handleCopyToClipboard = () => {
        if (generatedDraft) {
            navigator.clipboard.writeText(generatedDraft);
            alert("Draft copied to clipboard!");
        }
    };

    // --- RENDER ---

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col animate-in fade-in duration-500">

            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900 flex items-center">
                        <Sparkles className="w-6 h-6 text-aera-600 mr-2" />
                        Lease AI
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Intelligent document processing and creation suite.
                    </p>
                </div>

                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mt-4 sm:mt-0">
                    <button
                        onClick={() => setActiveTab('analyze')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'analyze'
                            ? 'bg-white text-aera-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Analyze Document
                    </button>
                    <button
                        onClick={() => setActiveTab('draft')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'draft'
                            ? 'bg-white text-aera-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Draft Document
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex gap-6 min-h-0">

                {/* === ANALYZE TAB === */}
                {activeTab === 'analyze' && (
                    <>
                        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div
                                className={`p-6 flex-1 flex flex-col border-b border-slate-100 transition-all duration-200 ${isDragging
                                    ? 'bg-aera-50 border-aera-600 ring-4 ring-inset ring-aera-600/10'
                                    : selectedFile
                                        ? 'bg-aera-50'
                                        : 'hover:bg-slate-50'
                                    }`}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                {!selectedFile ? (
                                    <div className="flex-1 flex flex-col">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-xl flex-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group min-h-[200px] relative ${isDragging
                                                ? 'border-aera-600 bg-white scale-[0.99] shadow-lg shadow-aera-100'
                                                : 'border-slate-300 hover:border-aera-600 hover:bg-white hover:shadow-md'
                                                }`}
                                        >
                                            <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${isDragging ? 'bg-aera-100 scale-110 shadow-sm' : 'bg-slate-100 group-hover:bg-aera-50'
                                                }`}>
                                                <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-aera-700' : 'text-slate-400 group-hover:text-aera-600'
                                                    }`} />
                                            </div>
                                            <p className={`text-lg font-semibold transition-colors ${isDragging ? 'text-aera-900' : 'text-slate-700'}`}>
                                                {isDragging ? 'Drop Document Here' : 'Click to upload or drag & drop'}
                                            </p>
                                            <p className="text-sm text-slate-400 mt-2">PDF or DOCX (max 10MB)</p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.docx,.txt"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </div>

                                        <div className="relative flex items-center py-6">
                                            <div className="flex-grow border-t border-slate-200"></div>
                                            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400 uppercase">Or paste text</span>
                                            <div className="flex-grow border-t border-slate-200"></div>
                                        </div>

                                        <textarea
                                            className="flex-1 w-full p-4 resize-none rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 text-sm font-mono text-slate-800"
                                            placeholder="Paste lease agreement text here..."
                                            value={leaseText}
                                            onChange={(e) => setLeaseText(e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <div className="bg-white p-6 rounded-xl border border-aera-200 shadow-sm max-w-sm w-full">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2 bg-red-50 rounded-lg">
                                                    <FileIcon className="w-8 h-8 text-red-500" />
                                                </div>
                                                <button onClick={clearFile} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <p className="text-lg font-medium text-slate-900 truncate mb-1">{selectedFile.name}</p>
                                            <p className="text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <textarea
                                            className="w-full mt-6 p-4 resize-none rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-sm h-32"
                                            disabled
                                            value="File selected. Text input disabled."
                                        />
                                    </div>
                                )}

                                <div className="pt-6 mt-2">
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || (!leaseText && !selectedFile)}
                                        className="w-full bg-aera-900 hover:bg-aera-800 disabled:bg-slate-300 text-white py-3 rounded-lg font-medium shadow-md shadow-aera-100 transition-all flex items-center justify-center space-x-2 border border-transparent hover:border-aera-600"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Analyzing Document...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldAlert className="w-5 h-5" />
                                                <span>Analyze Risks & Clauses</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className="flex-1 lg:max-w-xl bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-aera-50">
                                <span className="text-sm font-medium text-slate-700 flex items-center">
                                    <ShieldAlert className="w-4 h-4 mr-2 text-aera-600" />
                                    Analysis Report
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {analysis ? (
                                    <div className="prose prose-sm prose-slate max-w-none">
                                        {/* Simple Markdown Rendering Fallback */}
                                        {analysis.split('\n').map((line, i) => {
                                            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-aera-900 mb-4 pb-2 border-b border-slate-100">{line.replace('# ', '')}</h1>
                                            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-aera-800 mt-6 mb-3">{line.replace('## ', '')}</h2>
                                            if (line.startsWith('### ')) return <h3 key={i} className="text-md font-semibold text-aera-800 mt-4 mb-2">{line.replace('### ', '')}</h3>
                                            if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-700 mb-1">{line.replace('- ', '')}</li>
                                            if (line.trim() === '') return <div key={i} className="h-2" />
                                            return <p key={i} className="text-slate-600 mb-2 leading-relaxed">{line}</p>
                                        })}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                        <div className="w-20 h-20 bg-aera-50 rounded-full flex items-center justify-center mb-6">
                                            <Sparkles className="w-10 h-10 text-aera-200" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-600 mb-2">Ready to Analyze</h3>
                                        <p className="text-center max-w-xs text-sm">
                                            Upload a PDF or paste text. The AI will extract key dates, financial obligations, and legal risks.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* === DRAFT TAB === */}
                {activeTab === 'draft' && (
                    <>
                        <div className="w-full lg:w-96 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-aera-50">
                                <h2 className="font-bold text-aera-900 flex items-center">
                                    <PenTool className="w-4 h-4 mr-2 text-aera-600" />
                                    Draft Configuration
                                </h2>
                            </div>

                            <div className="p-5 flex-1 overflow-y-auto space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dokumenttyp</label>
                                    <select
                                        value={draftType}
                                        onChange={(e) => setDraftType(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                    >
                                        <option value="Neuer Mietvertrag">Neuer Mietvertrag</option>
                                        <option value="Mietvertragsverlängerung">Mietvertragsverlängerung</option>
                                        <option value="Mieterhöhung">Mieterhöhungsschreiben</option>
                                        <option value="Kündigung">Kündigungsschreiben</option>
                                        <option value="Zahlungserinnerung">Zahlungserinnerung</option>
                                        <option value="Wartungsankündigung">Wartungsankündigung</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Objekt auswählen</label>
                                    <select
                                        value={selectedPropertyId}
                                        onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedTenantId(''); }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                    >
                                        <option value="">— Objekt wählen —</option>
                                        {properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedProperty && (
                                    <div className="bg-aera-50 border border-aera-100 rounded-lg p-3 space-y-1">
                                        <p className="text-[10px] font-bold text-aera-800 uppercase tracking-wider">Vermieter</p>
                                        {selectedProperty.landlord?.name ? (
                                            <>
                                                <p className="text-sm font-medium text-slate-900">{selectedProperty.landlord.name}</p>
                                                <p className="text-xs text-slate-500">{selectedProperty.landlord.address}, {selectedProperty.landlord.zipCode} {selectedProperty.landlord.city}</p>
                                                {selectedProperty.landlord.email && <p className="text-xs text-aera-600">{selectedProperty.landlord.email}</p>}
                                            </>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">Kein Vermieter hinterlegt</p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Mieter auswählen</label>
                                    <select
                                        value={selectedTenantId}
                                        onChange={(e) => setSelectedTenantId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                    >
                                        <option value="">— Mieter wählen —</option>
                                        {filteredTenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} (€{t.monthlyRent}/Monat)</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1">Vermieter- und Objektdaten werden automatisch eingefügt.</p>
                                </div>

                                <div className="border-t border-slate-100 pt-4 space-y-4">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Specific Terms</label>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Effective Date</label>
                                        <input
                                            type="date"
                                            value={draftDetails.effectiveDate}
                                            onChange={(e) => setDraftDetails({ ...draftDetails, effectiveDate: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-aera-600 outline-none"
                                        />
                                    </div>

                                    {(draftType.includes('Lease') || draftType.includes('Renewal')) && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Term Length</label>
                                                <input
                                                    type="text"
                                                    value={draftDetails.termLength}
                                                    onChange={(e) => setDraftDetails({ ...draftDetails, termLength: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-aera-600 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Rent Increase / Rate</label>
                                                <input
                                                    type="text"
                                                    value={draftDetails.rentIncrease}
                                                    onChange={(e) => setDraftDetails({ ...draftDetails, rentIncrease: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-aera-600 outline-none"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Additional Notes / Clauses</label>
                                        <textarea
                                            value={draftDetails.additionalNotes}
                                            onChange={(e) => setDraftDetails({ ...draftDetails, additionalNotes: e.target.value })}
                                            placeholder="Any specific requirements..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-aera-600 outline-none h-20 resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleGenerateDraft}
                                        disabled={isGenerating || !selectedTenantId || !selectedPropertyId}
                                        className="w-full bg-aera-900 text-white py-3 rounded-lg font-medium shadow-md hover:bg-aera-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                Drafting...
                                            </>
                                        ) : (
                                            "Generate Document"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-aera-50 flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-700 flex items-center">
                                    <FileText className="w-4 h-4 mr-2 text-aera-600" />
                                    Document Preview
                                </span>
                                {generatedDraft && (
                                    <div className="flex space-x-2">
                                        <button onClick={handleCopyToClipboard} className="p-1.5 text-slate-500 hover:text-aera-900 hover:bg-white rounded transition-colors" title="Copy Text">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => {
                                            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
                                            const tenant = tenants.find(t => t.id === selectedTenantId);
                                            const url = previewTextAsPdf(generatedDraft, {
                                                title: draftType,
                                                subtitle: tenant ? `${tenant.name} — ${draftDetails.effectiveDate}` : undefined,
                                            });
                                            setPdfBlobUrl(url);
                                            setShowPdfPreview(true);
                                        }} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors" title="PDF Vorschau">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => {
                                            const tenant = tenants.find(t => t.id === selectedTenantId);
                                            downloadTextAsPdf(generatedDraft, `${draftType.replace(/\s+/g, '_')}_${tenant?.name || ''}.pdf`, {
                                                title: draftType,
                                                subtitle: tenant ? `${tenant.name} — ${draftDetails.effectiveDate}` : undefined,
                                            });
                                        }} className="p-1.5 text-slate-500 hover:text-aera-900 hover:bg-white rounded transition-colors" title="PDF Download">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                                {generatedDraft ? (
                                    <textarea
                                        value={generatedDraft}
                                        onChange={(e) => setGeneratedDraft(e.target.value)}
                                        className="w-full h-full p-8 bg-white shadow-sm border border-slate-200 text-slate-800 font-serif leading-relaxed text-sm resize-none focus:outline-none focus:ring-1 focus:ring-aera-200"
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                        <FileText className="w-16 h-16 mb-4 text-slate-300" />
                                        <p className="text-sm">Configure parameters and click Generate to see the draft.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ===== MODAL: PDF PREVIEW ===== */}
            {showPdfPreview && pdfBlobUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-aera-600" /> PDF Vorschau
                            </h2>
                            <button onClick={() => { setShowPdfPreview(false); if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-200 p-0">
                            <iframe src={pdfBlobUrl} className="w-full h-full border-0" title="PDF Vorschau" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaseAnalyzer;
