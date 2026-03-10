import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import { downloadTextAsPdf, previewTextAsPdf } from '../utils/pdfExport';
import {
    RentInvoice, Payment, Property, Tenant, PaymentMethod, InvoiceStatus
} from '../types';
import { dataService } from '../services/dataService';
import { generateDunningLetter, analyzePaymentPattern } from '../services/geminiService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';
import {
    Receipt, CreditCard, TrendingUp, Plus, Loader2, Search, Filter,
    Send, AlertTriangle, CheckCircle2, Clock, XCircle, Download,
    ChevronDown, Eye, Trash2, FileText, Sparkles, RefreshCw,
    DollarSign, Users, Calendar, ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    draft: { label: 'Entwurf', color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock },
    sent: { label: 'Versendet', color: 'text-blue-600', bg: 'bg-blue-100', icon: Send },
    paid: { label: 'Bezahlt', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
    partial: { label: 'Teilzahlung', color: 'text-amber-600', bg: 'bg-amber-100', icon: ArrowDownRight },
    overdue: { label: 'Überfällig', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
    cancelled: { label: 'Storniert', color: 'text-slate-400', bg: 'bg-slate-50', icon: XCircle },
};

const CHART_COLORS = ['#059669', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPeriod(period: string): string {
    const [y, m] = period.split('-');
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

const Mietrechnungen: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading: coreLoading, reload } = useDataCore();
    const { t } = useTranslation();
    const invoices = propertyId ? data.invoices.filter(i => i.propertyId === propertyId) : data.invoices;
    const payments = data.payments;
    const properties = data.properties;
    const tenants = propertyId ? data.tenants.filter(t => t.propertyId === propertyId) : data.tenants;
    const isLoading = coreLoading;
    const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'analytics'>('invoices');

    // Filters
    const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all');
    const [filterTenant, setFilterTenant] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDunningModal, setShowDunningModal] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<RentInvoice | null>(null);
    const [selectedTenantId, setSelectedTenantId] = useState('');

    // Generation
    const [generatePeriod, setGeneratePeriod] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isGenerating, setIsGenerating] = useState(false);

    // Payment form
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Überweisung');
    const [paymentRef, setPaymentRef] = useState('');
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // Dunning
    const [dunningLevel, setDunningLevel] = useState<1 | 2 | 3>(1);
    const [dunningText, setDunningText] = useState('');
    const [isGeneratingDunning, setIsGeneratingDunning] = useState(false);

    // Analysis
    const [analysisText, setAnalysisText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // PDF Preview
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

    // Filtered invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
            if (filterTenant && inv.tenantId !== filterTenant) return false;
            if (searchQuery) {
                const tenant = tenants.find(t => t.id === inv.tenantId);
                const q = searchQuery.toLowerCase();
                if (!inv.invoiceNumber.toLowerCase().includes(q) &&
                    !(tenant?.name.toLowerCase().includes(q))) return false;
            }
            return true;
        });
    }, [invoices, filterStatus, filterTenant, searchQuery, tenants]);

    // Stats
    const stats = useMemo(() => {
        const totalOutstanding = invoices
            .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
            .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
        const totalPaid = invoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + i.totalAmount, 0);
        const overdueCount = invoices.filter(i => i.status === 'overdue').length;
        const paidRate = invoices.length > 0
            ? Math.round((invoices.filter(i => i.status === 'paid').length / invoices.length) * 100) : 0;
        return { totalOutstanding, totalPaid, overdueCount, paidRate };
    }, [invoices]);

    // Revenue by month (for analytics)
    const revenueByMonth = useMemo(() => {
        const map: Record<string, { earned: number; outstanding: number }> = {};
        invoices.forEach(inv => {
            if (!map[inv.period]) map[inv.period] = { earned: 0, outstanding: 0 };
            map[inv.period].earned += inv.paidAmount;
            map[inv.period].outstanding += Math.max(0, inv.totalAmount - inv.paidAmount);
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([period, data]) => ({
            period: formatPeriod(period),
            Einnahmen: data.earned,
            Ausstehend: data.outstanding,
        }));
    }, [invoices]);

    // Status distribution
    const statusDistribution = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach(inv => { map[inv.status] = (map[inv.status] || 0) + 1; });
        return Object.entries(map).map(([status, count]) => ({
            name: STATUS_CONFIG[status as InvoiceStatus]?.label || status,
            value: count,
        }));
    }, [invoices]);

    // --- ACTIONS ---
    const handleGenerateInvoices = async () => {
        setIsGenerating(true);
        try {
            const created = await dataService.generateMonthlyInvoices(tenants, generatePeriod);
            if (created.length === 0) {
                alert('Alle Rechnungen für diesen Zeitraum existieren bereits.');
            } else {
                await reload(['invoices']);
                alert(`✅ ${created.length} Rechnung(en) für ${formatPeriod(generatePeriod)} erstellt!`);
            }
            setShowGenerateModal(false);
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedInvoice || paymentAmount <= 0) return;
        setIsSavingPayment(true);
        try {
            await dispatch({
                type: 'payment:add', payload: {
                    invoiceId: selectedInvoice.id,
                    tenantId: selectedInvoice.tenantId,
                    amount: paymentAmount,
                    date: paymentDate,
                    method: paymentMethod,
                    reference: paymentRef || undefined,
                    isAutoMatched: false,
                    createdAt: new Date().toISOString(),
                }
            });

            // Update invoice
            const newPaidAmount = selectedInvoice.paidAmount + paymentAmount;
            const newStatus: InvoiceStatus = newPaidAmount >= selectedInvoice.totalAmount ? 'paid' :
                newPaidAmount > 0 ? 'partial' : selectedInvoice.status;
            await dispatch({
                type: 'invoice:update', id: selectedInvoice.id, payload: {
                    paidAmount: newPaidAmount,
                    paidDate: paymentDate,
                    status: newStatus,
                }
            });

            setShowPaymentModal(false);
            setSelectedInvoice(null);
            setPaymentAmount(0);
            setPaymentRef('');
        } catch (error: any) {
            alert(`Fehler bei Zahlung: ${error.message}`);
        } finally {
            setIsSavingPayment(false);
        }
    };

    const handleMarkOverdue = async () => {
        const today = new Date().toISOString().split('T')[0];
        let updated = 0;
        for (const inv of invoices) {
            if ((inv.status === 'sent' || inv.status === 'partial') && inv.dueDate < today) {
                await dispatch({ type: 'invoice:update', id: inv.id, payload: { status: 'overdue' } });
                updated++;
            }
        }
        if (updated > 0) {
            alert(`⚠️ ${updated} Rechnung(en) als überfällig markiert.`);
        } else {
            alert('Keine überfälligen Rechnungen gefunden.');
        }
    };

    const handleGenerateDunning = async () => {
        if (!selectedInvoice) return;
        const tenant = tenants.find(t => t.id === selectedInvoice.tenantId);
        const property = properties.find(p => p.id === selectedInvoice.propertyId);
        if (!tenant || !property) return;

        setIsGeneratingDunning(true);
        try {
            const letter = await generateDunningLetter(
                tenant.name,
                property.address,
                {
                    invoiceNumber: selectedInvoice.invoiceNumber,
                    period: formatPeriod(selectedInvoice.period),
                    totalAmount: selectedInvoice.totalAmount,
                    dueDate: formatDate(selectedInvoice.dueDate),
                    outstandingAmount: selectedInvoice.totalAmount - selectedInvoice.paidAmount,
                },
                dunningLevel,
                property.landlord?.name
            );
            setDunningText(letter);

            // Update reminder count
            await dispatch({
                type: 'invoice:update', id: selectedInvoice.id, payload: {
                    remindersSent: selectedInvoice.remindersSent + 1,
                    lastReminderDate: new Date().toISOString(),
                }
            });
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        } finally {
            setIsGeneratingDunning(false);
        }
    };

    const handleAnalyzeTenant = async (tenantId: string) => {
        const tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) return;
        setSelectedTenantId(tenantId);
        setShowAnalysisModal(true);
        setIsAnalyzing(true);
        setAnalysisText('');

        try {
            const tenantInvoices = invoices.filter(i => i.tenantId === tenantId);
            const history = tenantInvoices.map(i => ({
                period: i.period,
                dueDate: i.dueDate,
                paidDate: i.paidDate,
                amount: i.paidAmount,
                totalDue: i.totalAmount,
                status: i.status,
            }));
            const analysis = await analyzePaymentPattern(tenant.name, history);
            setAnalysisText(analysis);
        } catch (error: any) {
            setAnalysisText(`Fehler: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteInvoice = async (id: string) => {
        if (!window.confirm('Rechnung wirklich löschen?')) return;
        await dispatch({ type: 'invoice:delete', id });
    };

    // --- PDF GENERATION ---
    const generateInvoicePDF = (invoice: RentInvoice): jsPDF => {
        const tenant = tenants.find(t => t.id === invoice.tenantId);
        const property = properties.find(p => p.id === invoice.propertyId);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pageW = 210;
        const marginL = 20;
        const marginR = 20;
        const contentW = pageW - marginL - marginR;
        let y = 20;

        // --- HEADER: Company / Landlord ---
        doc.setFillColor(15, 82, 70); // aera-primary
        doc.rect(0, 0, pageW, 42, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('MIETRECHNUNG', marginL, y + 10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.invoiceNumber, marginL, y + 18);
        const ll = property?.landlord;
        const llName = ll?.name || 'AERA Hausverwaltung';
        const llAddr = ll ? `${ll.address}, ${ll.zipCode} ${ll.city}` : 'Musterstraße 1, 10115 Berlin';
        const llContact = ll?.email ? `${ll.phone ? 'Tel: ' + ll.phone + ' | ' : ''}${ll.email}` : 'Tel: +49 30 123456 | info@aera.de';
        doc.setFontSize(9);
        doc.text(llName, pageW - marginR, y + 5, { align: 'right' });
        doc.text(llAddr, pageW - marginR, y + 10, { align: 'right' });
        doc.text(llContact, pageW - marginR, y + 15, { align: 'right' });

        y = 52;

        // --- RECIPIENT ---
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.text(`${llName} · ${llAddr}`, marginL, y);
        y += 6;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(tenant?.name || 'Mieter', marginL, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(property?.address || 'Adresse', marginL, y);
        y += 5;

        // --- INVOICE META (right side) ---
        const metaX = pageW - marginR - 55;
        const metaYStart = 52;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(metaX - 5, metaYStart - 3, 60, 30, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Rechnungsnr.:', metaX, metaYStart + 3);
        doc.text('Rechnungsdatum:', metaX, metaYStart + 9);
        doc.text('Fällig bis:', metaX, metaYStart + 15);
        doc.text('Zeitraum:', metaX, metaYStart + 21);
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'bold');
        doc.text(invoice.invoiceNumber, metaX + 35, metaYStart + 3);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(invoice.createdAt), metaX + 35, metaYStart + 9);
        doc.text(formatDate(invoice.dueDate), metaX + 35, metaYStart + 15);
        doc.text(formatPeriod(invoice.period), metaX + 35, metaYStart + 21);

        y = 95;

        // --- SUBJECT ---
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Mietrechnung für ${formatPeriod(invoice.period)}`, marginL, y);
        y += 4;
        doc.setDrawColor(15, 82, 70);
        doc.setLineWidth(0.5);
        doc.line(marginL, y, marginL + contentW, y);
        y += 8;

        // --- GREETING ---
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Sehr geehrte/r ${tenant?.name || 'Mieter/in'},`, marginL, y);
        y += 6;
        doc.setFontSize(9);
        doc.text('hiermit stellen wir Ihnen die folgenden Mietkosten in Rechnung:', marginL, y);
        y += 10;

        // --- TABLE ---
        const colX = [marginL, marginL + 100, marginL + contentW];
        // Header
        doc.setFillColor(15, 82, 70);
        doc.rect(marginL, y, contentW, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Position', marginL + 3, y + 5.5);
        doc.text('Betrag', colX[2] - 3, y + 5.5, { align: 'right' });
        y += 8;

        // Rows
        doc.setTextColor(30, 30, 30);
        const rows = [
            { label: 'Kaltmiete (Nettomiete)', amount: invoice.kaltmiete },
            { label: 'Nebenkostenvorauszahlung', amount: invoice.nebenkostenVorauszahlung },
        ];

        rows.forEach((row, idx) => {
            const bgColor = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(marginL, y, contentW, 8, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(row.label, marginL + 3, y + 5.5);
            doc.text(formatCurrency(row.amount), colX[2] - 3, y + 5.5, { align: 'right' });
            y += 8;
        });

        // Separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(marginL, y, marginL + contentW, y);

        // Total
        doc.setFillColor(15, 82, 70);
        doc.rect(marginL, y, contentW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Gesamtbetrag', marginL + 3, y + 7);
        doc.text(formatCurrency(invoice.totalAmount), colX[2] - 3, y + 7, { align: 'right' });
        y += 18;

        // --- PAYMENT STATUS ---
        if (invoice.paidAmount > 0) {
            doc.setTextColor(5, 150, 105);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`✓ Bereits bezahlt: ${formatCurrency(invoice.paidAmount)}`, marginL, y);
            y += 5;
            if (invoice.totalAmount - invoice.paidAmount > 0) {
                doc.setTextColor(220, 38, 38);
                doc.text(`Offener Restbetrag: ${formatCurrency(invoice.totalAmount - invoice.paidAmount)}`, marginL, y);
                y += 5;
            }
            y += 3;
        }

        // --- PAYMENT INSTRUCTIONS ---
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Bitte überweisen Sie den Gesamtbetrag bis zum Fälligkeitsdatum auf folgendes Konto:', marginL, y);
        y += 8;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(marginL, y - 3, contentW, 24, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Bankverbindung', marginL + 3, y + 2);
        doc.setFont('helvetica', 'normal');
        doc.text(`Kontoinhaber: ${llName}`, marginL + 3, y + 8);
        doc.text(`IBAN: ${ll?.iban || 'DE89 3704 0044 0532 0130 00'}`, marginL + 3, y + 13);
        doc.text(`Verwendungszweck: ${invoice.invoiceNumber}`, marginL + 3, y + 18);
        y += 30;

        // --- FOOTER ---
        const footerY = 270;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(marginL, footerY, marginL + contentW, footerY);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.text(`${llName} · ${llAddr}`, pageW / 2, footerY + 4, { align: 'center' });
        doc.text('Diese Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.', pageW / 2, footerY + 8, { align: 'center' });
        doc.text(`Seite 1 von 1 | Erstellt am ${formatDate(new Date().toISOString())}`, pageW / 2, footerY + 12, { align: 'center' });

        return doc;
    };

    const handlePreviewPdf = (invoice: RentInvoice) => {
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        const doc = generateInvoicePDF(invoice);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setSelectedInvoice(invoice);
        setShowPdfPreview(true);
    };

    const handleDownloadPdf = (invoice: RentInvoice) => {
        const doc = generateInvoicePDF(invoice);
        doc.save(`${invoice.invoiceNumber}.pdf`);
    };

    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-aera-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Rechnungen werden geladen...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900">{t('invoices.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('invoices.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleMarkOverdue} className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl text-sm font-medium border border-amber-200 hover:bg-amber-100 transition-colors">
                        <AlertTriangle className="w-4 h-4" /> Überfällige prüfen
                    </button>
                    <button onClick={() => setShowGenerateModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-aera-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg">
                        <Plus className="w-4 h-4" /> Rechnungen generieren
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Ausstehend</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(stats.totalOutstanding)}</p>
                        </div>
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-red-600" /></div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Einnahmen</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.totalPaid)}</p>
                        </div>
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Überfällig</p>
                            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.overdueCount}</p>
                        </div>
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Zahlungsquote</p>
                            <p className="text-2xl font-bold text-aera-600 mt-1">{stats.paidRate}%</p>
                        </div>
                        <div className="w-10 h-10 bg-aera-100 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-aera-600" /></div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { key: 'invoices' as const, label: 'Rechnungen', icon: Receipt },
                    { key: 'payments' as const, label: 'Zahlungen', icon: CreditCard },
                    { key: 'analytics' as const, label: 'Analytics', icon: TrendingUp },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white shadow-sm text-aera-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB: RECHNUNGEN ===== */}
            {activeTab === 'invoices' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-slate-100 flex gap-3 items-center flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" placeholder="Suchen nach RE-Nr., Mieter..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none" />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-aera-600/20 outline-none">
                            <option value="all">Alle Status</option>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                            ))}
                        </select>
                        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-aera-600/20 outline-none">
                            <option value="">Alle Mieter</option>
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {filteredInvoices.length === 0 ? (
                        <div className="p-12 text-center">
                            <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-1">Keine Rechnungen vorhanden</h3>
                            <p className="text-sm text-slate-400 mb-6">Generieren Sie monatliche Mietrechnungen für alle aktiven Mieter.</p>
                            <button onClick={() => setShowGenerateModal(true)} className="inline-flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors">
                                <Plus className="w-4 h-4" /> Rechnungen generieren
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">RE-Nr.</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Mieter</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Zeitraum</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Kaltmiete</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">NK-Voraus.</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Gesamt</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Bezahlt</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map(inv => {
                                    const tenant = tenants.find(t => t.id === inv.tenantId);
                                    const statusCfg = STATUS_CONFIG[inv.status];
                                    const StatusIcon = statusCfg.icon;
                                    return (
                                        <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-5 py-3 font-mono text-xs font-medium text-slate-700">{inv.invoiceNumber}</td>
                                            <td className="px-5 py-3">
                                                <div className="font-medium text-slate-900">{tenant?.name || '—'}</div>
                                                <div className="text-xs text-slate-400">{properties.find(p => p.id === inv.propertyId)?.name}</div>
                                            </td>
                                            <td className="px-5 py-3 text-center text-slate-600">{formatPeriod(inv.period)}</td>
                                            <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(inv.kaltmiete)}</td>
                                            <td className="px-5 py-3 text-right text-slate-400">{formatCurrency(inv.nebenkostenVorauszahlung)}</td>
                                            <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={inv.paidAmount >= inv.totalAmount ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                                                    {formatCurrency(inv.paidAmount)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handlePreviewPdf(inv)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="PDF Vorschau">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDownloadPdf(inv)}
                                                        className="p-1.5 rounded-lg hover:bg-green-100 text-slate-400 hover:text-green-600 transition-colors" title="PDF herunterladen">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                        <button onClick={() => { setSelectedInvoice(inv); setPaymentAmount(inv.totalAmount - inv.paidAmount); setShowPaymentModal(true); }}
                                                            className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors" title="Zahlung erfassen">
                                                            <CreditCard className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {(inv.status === 'overdue' || inv.status === 'sent') && (
                                                        <button onClick={() => { setSelectedInvoice(inv); setDunningText(''); setShowDunningModal(true); }}
                                                            className="p-1.5 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors" title="Mahnung erstellen">
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleAnalyzeTenant(inv.tenantId)}
                                                        className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors" title="KI-Analyse">
                                                        <Sparkles className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteInvoice(inv.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors" title="Löschen">
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
                    {filteredInvoices.length > 0 && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between text-sm text-slate-500">
                            <span>{filteredInvoices.length} Rechnung(en)</span>
                            <span className="font-medium">Gesamt: {formatCurrency(filteredInvoices.reduce((sum, i) => sum + i.totalAmount, 0))}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB: ZAHLUNGEN ===== */}
            {activeTab === 'payments' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-aera-600" /> Zahlungseingänge</h3>
                        <span className="text-sm text-slate-500">{payments.length} Zahlungen</span>
                    </div>
                    {payments.length === 0 ? (
                        <div className="p-12 text-center">
                            <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-1">Noch keine Zahlungen</h3>
                            <p className="text-sm text-slate-400">Zahlungen werden über die Rechnungstabelle erfasst.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Datum</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Mieter</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Rechnung</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Betrag</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Methode</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Referenz</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(pay => {
                                    const tenant = tenants.find(t => t.id === pay.tenantId);
                                    const invoice = invoices.find(i => i.id === pay.invoiceId);
                                    return (
                                        <tr key={pay.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                                            <td className="px-5 py-3 text-slate-600">{formatDate(pay.date)}</td>
                                            <td className="px-5 py-3 font-medium text-slate-900">{tenant?.name || '—'}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{invoice?.invoiceNumber || '—'}</td>
                                            <td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatCurrency(pay.amount)}</td>
                                            <td className="px-5 py-3 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs">{pay.method}</span></td>
                                            <td className="px-5 py-3 text-slate-400 text-xs">{pay.reference || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ===== TAB: ANALYTICS ===== */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Revenue Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-aera-600" /> Monatliche Einnahmen</h3>
                            {revenueByMonth.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={revenueByMonth}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                                        <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                        <Legend />
                                        <Bar dataKey="Einnahmen" fill="#059669" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Ausstehend" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Keine Daten vorhanden</div>
                            )}
                        </div>

                        {/* Status Pie */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-aera-600" /> Statusverteilung</h3>
                            {statusDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                            {statusDistribution.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Keine Daten vorhanden</div>
                            )}
                        </div>
                    </div>

                    {/* Per-Tenant Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-aera-600" /> Mieter-Übersicht</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Mieter</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Rechnungen</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Bezahlt</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Ausstehend</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Quote</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">KI-Analyse</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map(t => {
                                    const tInvoices = invoices.filter(i => i.tenantId === t.id);
                                    const paid = tInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
                                    const outstanding = tInvoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
                                    const rate = tInvoices.length > 0 ? Math.round((tInvoices.filter(i => i.status === 'paid').length / tInvoices.length) * 100) : 0;
                                    return (
                                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                                            <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                                            <td className="px-5 py-3 text-right text-slate-600">{tInvoices.length}</td>
                                            <td className="px-5 py-3 text-right text-emerald-600 font-medium">{formatCurrency(paid)}</td>
                                            <td className="px-5 py-3 text-right text-red-600 font-medium">{formatCurrency(outstanding)}</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{rate}%</span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button onClick={() => handleAnalyzeTenant(t.id)} className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-500 hover:text-violet-700 transition-colors" title="KI-Analyse">
                                                    <Sparkles className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== MODAL: GENERATE INVOICES ===== */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-aera-600" /> Monatliche Rechnungen generieren</h2>
                        <p className="text-sm text-slate-500 mb-4">Erstellt automatisch Rechnungen für alle aktiven Mieter im gewählten Zeitraum.</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Abrechnungsmonat</label>
                            <input type="month" value={generatePeriod} onChange={e => setGeneratePeriod(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none" />
                        </div>
                        <div className="p-3 bg-aera-50 rounded-lg text-sm text-aera-700 mb-6">
                            <p className="font-medium mb-1">📋 Es werden {tenants.filter(t => t.status !== 'Notice Given').length} Rechnungen erstellt:</p>
                            <p className="text-xs text-aera-600">Kaltmiete + NK-Vorauszahlung (20%) für jeden aktiven Mieter</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowGenerateModal(false)} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium">Abbrechen</button>
                            <button onClick={handleGenerateInvoices} disabled={isGenerating}
                                className="flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors disabled:opacity-50">
                                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generiere...</> : <><Plus className="w-4 h-4" /> Generieren</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: RECORD PAYMENT ===== */}
            {showPaymentModal && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600" /> Zahlung erfassen</h2>
                        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Rechnung:</span><span className="font-mono font-medium">{selectedInvoice.invoiceNumber}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Offen:</span><span className="font-bold text-red-600">{formatCurrency(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}</span></div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Betrag (€)</label>
                                <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Zahlungsmethode</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none">
                                    <option value="Überweisung">Überweisung</option>
                                    <option value="Lastschrift">Lastschrift</option>
                                    <option value="Bar">Bar</option>
                                    <option value="Sonstige">Sonstige</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Referenz / Verwendungszweck</label>
                                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Optional"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none" />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium">Abbrechen</button>
                            <button onClick={handleRecordPayment} disabled={isSavingPayment || paymentAmount <= 0}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                {isSavingPayment ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</> : <><CheckCircle2 className="w-4 h-4" /> Zahlung buchen</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: DUNNING LETTER ===== */}
            {showDunningModal && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" /> KI-Mahnschreiben</h2>
                            <button onClick={() => { setShowDunningModal(false); setDunningText(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="flex gap-2 mb-4">
                                {([1, 2, 3] as const).map(level => (
                                    <button key={level} onClick={() => setDunningLevel(level)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dunningLevel === level ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}
                                    >
                                        {level === 1 ? '1. Erinnerung' : level === 2 ? '2. Mahnung' : '3. Letzte Mahnung'}
                                    </button>
                                ))}
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
                                <span className="text-slate-500">Rechnung {selectedInvoice.invoiceNumber} — Offen: </span>
                                <span className="font-bold text-red-600">{formatCurrency(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}</span>
                                <span className="text-slate-400 ml-2">({selectedInvoice.remindersSent} Mahnungen bisher)</span>
                            </div>
                            <button onClick={handleGenerateDunning} disabled={isGeneratingDunning}
                                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all mb-4 disabled:opacity-50">
                                {isGeneratingDunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Generiere...</> : <><Sparkles className="w-4 h-4" /> Mahnschreiben generieren</>}
                            </button>
                            {dunningText && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <button onClick={() => {
                                            const tenant = tenants.find(t => t.id === selectedInvoice.tenantId);
                                            const levelNames = { 1: 'Zahlungserinnerung', 2: 'Mahnung', 3: 'Letzte_Mahnung' };
                                            downloadTextAsPdf(dunningText, `${levelNames[dunningLevel]}_${selectedInvoice.invoiceNumber}_${tenant?.name || ''}.pdf`, {
                                                title: dunningLevel === 1 ? 'Zahlungserinnerung' : dunningLevel === 2 ? 'Mahnung' : 'Letzte Mahnung',
                                                subtitle: `${selectedInvoice.invoiceNumber} \u2014 ${tenant?.name || ''}`,
                                                headerColor: dunningLevel === 3 ? [180, 30, 30] : dunningLevel === 2 ? [200, 120, 0] : [15, 82, 70],
                                            });
                                        }} className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium">
                                            <Download className="w-4 h-4" /> PDF Download
                                        </button>
                                        <button onClick={() => {
                                            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
                                            const tenant = tenants.find(t => t.id === selectedInvoice.tenantId);
                                            const url = previewTextAsPdf(dunningText, {
                                                title: dunningLevel === 1 ? 'Zahlungserinnerung' : dunningLevel === 2 ? 'Mahnung' : 'Letzte Mahnung',
                                                subtitle: `${selectedInvoice.invoiceNumber} \u2014 ${tenant?.name || ''}`,
                                                headerColor: dunningLevel === 3 ? [180, 30, 30] : dunningLevel === 2 ? [200, 120, 0] : [15, 82, 70],
                                            });
                                            setPdfBlobUrl(url);
                                            setShowPdfPreview(true);
                                            setShowDunningModal(false);
                                        }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                                            <Eye className="w-4 h-4" /> PDF Vorschau
                                        </button>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-mono bg-white rounded-lg p-5 border border-slate-200">
                                        {dunningText}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: AI ANALYSIS ===== */}
            {showAnalysisModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-violet-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-violet-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-violet-600" /> KI-Zahlungsverhalten — {tenants.find(t => t.id === selectedTenantId)?.name}
                            </h2>
                            <button onClick={() => { setShowAnalysisModal(false); setAnalysisText(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {isAnalyzing ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-violet-600 mr-3" />
                                    <span className="text-slate-500">Analysiere Zahlungsverhalten...</span>
                                </div>
                            ) : analysisText ? (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <button onClick={() => {
                                            const tenant = tenants.find(t => t.id === selectedTenantId);
                                            downloadTextAsPdf(analysisText, `Zahlungsanalyse_${tenant?.name || ''}.pdf`, {
                                                title: 'Zahlungsverhalten-Analyse',
                                                subtitle: tenant?.name || '',
                                                headerColor: [109, 40, 217],
                                            });
                                        }} className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium">
                                            <Download className="w-4 h-4" /> PDF Download
                                        </button>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                        {analysisText}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
            {/* ===== MODAL: PDF PREVIEW ===== */}
            {showPdfPreview && pdfBlobUrl && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-aera-600" /> PDF Vorschau
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedInvoice.invoiceNumber} — {tenants.find(t => t.id === selectedInvoice.tenantId)?.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleDownloadPdf(selectedInvoice)}
                                    className="flex items-center gap-2 bg-aera-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-700 transition-colors">
                                    <Download className="w-4 h-4" /> Herunterladen
                                </button>
                                <button onClick={() => { setShowPdfPreview(false); if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
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

export default Mietrechnungen;
