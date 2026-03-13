
import React, { useState, useMemo } from 'react';
import { Property, Tenant, RentPayment, Message } from '../types';
import { Mail, Phone, Calendar, CheckCircle, AlertCircle, Plus, X, Search, MoreHorizontal, Edit2, Trash2, Building2, ExternalLink, FileText, Clock, Euro, History, MessageSquare, Receipt, ArrowUpRight, ArrowDownRight, Sparkles, Loader2, Upload, Paperclip, ArrowUpDown, Download, DoorOpen } from 'lucide-react';

import { getLeaseSuggestions } from '../services/geminiService';
import { dataService } from '../services/dataService';
import ReactMarkdown from 'react-markdown';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';

const Tenants: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading } = useDataCore();
    const { t } = useTranslation();
    const tenants = propertyId ? data.tenants.filter(t => t.propertyId === propertyId) : data.tenants;
    const properties = data.properties;
    const messages = data.messages;
    const [searchTerm, setSearchTerm] = useState('');

    // Suggestion State
    const [showSuggestion, setShowSuggestion] = useState(true);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'communications' | 'lease' | 'contact_history'>('overview');

    // Contact History Sort State
    const [contactSortOrder, setContactSortOrder] = useState<'asc' | 'desc'>('desc');

    // AI Suggestions State
    const [isAnalyzingLease, setIsAnalyzingLease] = useState(false);
    const [leaseSuggestions, setLeaseSuggestions] = useState<string | null>(null);

    // Selection States
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState<Partial<Tenant>>({
        status: 'Good Standing'
    });

    // Filter Tenants based on Search
    const filteredTenants = useMemo(() => {
        return tenants.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tenants, searchTerm]);

    // Helper to find property name
    const getPropertyName = (id: string) => {
        return properties.find(p => p.id === id)?.name || 'Unassigned Property';
    };

    // Helper to find unit number
    const getUnitNumber = (propertyId: string, unitId?: string) => {
        if (!unitId) return null;
        const property = properties.find(p => p.id === propertyId);
        const unit = property?.units?.find(u => u.id === unitId);
        return unit ? unit.unitNumber : null;
    };

    // Helper to get rent history for tenant's property (Aggregated from units for demo)
    const getTenantRentHistory = (tenantId: string, propertyId: string): RentPayment[] => {
        const property = properties.find(p => p.id === propertyId);
        if (!property || !property.units) return [];

        const history: RentPayment[] = [];
        property.units.forEach(u => {
            if (u.rentHistory) {
                history.push(...u.rentHistory);
            }
        });
        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // Helper to get messages (Chat View)
    const getTenantMessages = (tenantId: string) => {
        return messages.filter(m =>
            (m.senderId === tenantId || m.receiverId === tenantId) && m.receiverId !== 'all'
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    // Helper to get sorted communications (History Log View)
    const getSortedCommunications = (tenantId: string) => {
        const msgs = messages.filter(m =>
            (m.senderId === tenantId || m.receiverId === tenantId) && m.receiverId !== 'all'
        );

        return msgs.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return contactSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            // If property changes, reset unit selection to avoid mismatches
            if (name === 'propertyId' && value !== prev.propertyId) {
                return { ...prev, [name]: value, unitId: '', monthlyRent: 0 };
            }
            // If unit changes, auto-fill monthlyRent from the unit's rentMonthly
            if (name === 'unitId') {
                const prop = properties.find(p => p.id === prev.propertyId);
                const unit = prop?.units?.find(u => u.id === value);
                return { ...prev, unitId: value, monthlyRent: unit?.rentMonthly ?? prev.monthlyRent ?? 0 };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleLeaseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Update form with filename
            const updatedData = { ...formData, leaseFileName: file.name };

            // If text file, read content for AI features
            if (file.type === 'text/plain') {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setFormData({
                        ...updatedData,
                        leaseContent: event.target?.result as string
                    });
                };
                reader.readAsText(file);
            } else {
                // For PDFs/Docs, we just store the name in this mock.
                // In real implementation, we'd upload to server/blob storage.
                setFormData(updatedData);
            }
        }
    };

    const openAddModal = () => {
        setFormData({ status: 'Good Standing' });
        setIsEditMode(false);
        setIsFormOpen(true);
    };

    const openEditModal = (tenant: Tenant) => {
        setFormData(tenant);
        setIsEditMode(true);
        setIsFormOpen(true);
    };

    const openDetailModal = (tenant: Tenant, tab: 'overview' | 'history' | 'communications' | 'lease' | 'contact_history' = 'overview') => {
        setSelectedTenant(tenant);
        setActiveTab(tab);
        setLeaseSuggestions(null); // Reset analysis
        setIsDetailOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to remove this tenant? This action cannot be undone.')) {
            try {
                await dispatch({ type: 'tenant:delete', id });
                if (selectedTenant?.id === id) setIsDetailOpen(false);
            } catch (error: any) {
                alert(`Failed to delete tenant: ${error.message}`);
            }
        }
    };

    const handleGenerateSuggestions = async () => {
        if (!selectedTenant?.leaseContent) return;
        setIsAnalyzingLease(true);
        const suggestions = await getLeaseSuggestions(selectedTenant.leaseContent);
        setLeaseSuggestions(suggestions);
        setIsAnalyzingLease(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.propertyId) return;

        // Auto-derive monthlyRent from the assigned property unit (single source of truth)
        const prop = properties.find(p => p.id === formData.propertyId);
        const unit = prop?.units?.find(u => u.id === formData.unitId);
        const derivedRent = unit?.rentMonthly ?? Number(formData.monthlyRent) ?? 0;

        try {
            if (isEditMode && formData.id) {
                const { id, ...updateData } = formData;
                const finalUpdateData = { ...updateData, monthlyRent: derivedRent };
                await dispatch({ type: 'tenant:update', id: formData.id, payload: finalUpdateData });
                if (selectedTenant?.id === formData.id) {
                    setSelectedTenant({ ...selectedTenant, ...formData, monthlyRent: derivedRent } as Tenant);
                }
            } else {
                const newTenantData: Omit<Tenant, 'id'> = {
                    name: formData.name || '',
                    contactName: formData.contactName || '',
                    email: formData.email || '',
                    phone: formData.phone || '',
                    propertyId: formData.propertyId || '',
                    unitId: formData.unitId || '',
                    leaseStart: formData.leaseStart || '',
                    leaseEnd: formData.leaseEnd || '',
                    monthlyRent: derivedRent,
                    status: (formData.status as any) || 'Good Standing',
                    leaseContent: formData.leaseContent || '',
                    leaseFileName: formData.leaseFileName || ''
                };
                await dispatch({ type: 'tenant:add', payload: newTenantData });
            }

            setIsFormOpen(false);
            setFormData({ status: 'Good Standing' });
        } catch (error: any) {
            alert(`Failed to save tenant: ${error.message}`);
        }
    };

    // Calculate Lease Progress for Detail View
    const calculateLeaseProgress = (start?: string, end?: string) => {
        if (!start || !end) return 0;
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime();

        // Safety Check for Invalid Dates
        if (isNaN(startDate) || isNaN(endDate) || startDate >= endDate) return 0;

        const today = new Date().getTime();
        const total = endDate - startDate;
        const elapsed = today - startDate;
        const percentage = Math.min(Math.max((elapsed / total) * 100, 0), 100);
        return percentage;
    };

    // Dynamic Units for Form
    const selectedPropertyUnits = useMemo(() => {
        const prop = properties.find(p => p.id === formData.propertyId);
        return prop?.units || [];
    }, [formData.propertyId, properties]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-3xl font-bold text-[#1A2E25]">{t('tenants.title')}</h1>
                    <p className="text-[#7A9589] mt-1 text-sm">{t('tenants.subtitle')}</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9589]" />
                        <input
                            type="text"
                            placeholder="Mieter suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-cream-deeper rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold bg-white"
                        />
                    </div>
                    <button
                        onClick={openAddModal}
                        className="btn-gold px-4 py-2 text-sm font-semibold flex items-center gap-2 whitespace-nowrap shadow-soft"
                        style={{ width: 'auto', borderRadius: '10px' }}
                    >
                        <Plus className="w-4 h-4" />
                        Mieter hinzufügen
                    </button>
                </div>
            </div>

            {/* AI Suggestion Banner */}
            {showSuggestion && filteredTenants.length > 0 && (
                <div className="bg-gradient-to-r from-cream to-white border border-gold/20 rounded-2xl p-4 shadow-soft flex items-start justify-between animate-in slide-in-from-top-2 fade-in duration-500">
                    <div className="flex gap-4">
                        <div className="p-2.5 bg-cream-dark rounded-xl shrink-0">
                            <Sparkles className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#1A2E25] flex items-center gap-2">
                                KI Portfolio Insight
                                <span className="text-[10px] bg-gold/10 text-gold-dark px-2 py-0.5 rounded-full font-semibold border border-gold/20">Auto-Generated</span>
                            </h3>
                            <p className="text-sm text-[#4A6358] mt-1 max-w-xl leading-relaxed">
                                Basierend auf aktueller Aktivität empfehlen wir, <strong>{filteredTenants[0].name}</strong> zu überprüfen. Ihr Profil hat offene Mietoptimierungspotenziale.
                            </p>
                            <button
                                onClick={() => openDetailModal(filteredTenants[0])}
                                className="mt-3 flex items-center gap-1 text-xs font-semibold text-forest hover:text-forest-dark bg-white border border-cream-deeper hover:border-gold/30 px-3 py-1.5 rounded-lg transition-all shadow-soft group"
                            >
                                Details ansehen
                                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSuggestion(false)}
                        className="text-[#7A9589] hover:text-[#4A6358] transition-colors p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tenant Table */}
            <div className="bg-white rounded-2xl border border-cream-deeper shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-cream border-b border-cream-deeper">
                                <th className="px-6 py-4 text-xs font-semibold text-[#7A9589] uppercase tracking-wider">Mieter</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#7A9589] uppercase tracking-wider">Objekt &amp; Einheit</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#7A9589] uppercase tracking-wider">Kontakt</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#7A9589] uppercase tracking-wider">Mietstatus</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[#7A9589] uppercase tracking-wider text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream">
                            {filteredTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        No tenants found matching "{searchTerm}"
                                    </td>
                                </tr>
                            ) : (
                                filteredTenants.map((tenant) => {
                                    const unitNum = getUnitNumber(tenant.propertyId, tenant.unitId);

                                    return (
                                        <tr key={tenant.id} className="hover:bg-cream/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-9 h-9 rounded-xl bg-cream-dark flex items-center justify-center text-forest font-bold mr-3 text-xs border border-cream-deeper" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                                        {tenant.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-[#1A2E25]">{tenant.name}</div>
                                                        <div className="text-xs text-[#7A9589] mt-0.5" style={{ fontFamily: '"JetBrains Mono", monospace' }}>€{tenant.monthlyRent.toLocaleString()}/mo</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[#4A6358]">
                                                <div className="flex flex-col justify-center">
                                                    <div className="flex items-center font-semibold text-[#1A2E25]">
                                                        <Building2 className="w-3.5 h-3.5 mr-2 text-[#7A9589]" />
                                                        {getPropertyName(tenant.propertyId)}
                                                    </div>
                                                    {unitNum && (
                                                        <div className="flex items-center mt-1 ml-5 text-xs text-forest bg-cream-dark w-fit px-2 py-0.5 rounded-lg border border-cream-deeper">
                                                            <DoorOpen className="w-3 h-3 mr-1" />
                                                            Einheit {unitNum}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-1">
                                                    <div className="flex items-center text-xs text-[#4A6358]">
                                                        <Mail className="w-3 h-3 mr-1.5 text-forest" />
                                                        {tenant.email}
                                                    </div>
                                                    <div className="flex items-center text-xs text-[#4A6358]">
                                                        <Phone className="w-3 h-3 mr-1.5 text-forest" />
                                                        {tenant.phone}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => openDetailModal(tenant, 'lease')}
                                                    className="group/status relative focus:outline-none text-left"
                                                >
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                        tenant.status === 'Good Standing'
                                                        ? 'bg-[#EAF4EE] text-[#2D7A4A]'
                                                        : tenant.status === 'Notice Given'
                                                            ? 'bg-amber-50 text-amber-700'
                                                            : 'bg-red-50 text-red-700'
                                                    }`}>
                                                        {tenant.status === 'Good Standing' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                                                        {tenant.status}
                                                    </span>
                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/status:block px-2 py-1 bg-forest text-white text-[10px] rounded-lg whitespace-nowrap z-10 shadow-soft">
                                                        Vertrag ansehen
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openDetailModal(tenant)}
                                                        className="p-1.5 hover:bg-cream-dark rounded-lg text-[#7A9589] hover:text-forest" title="Details">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(tenant)}
                                                        className="p-1.5 hover:bg-cream-dark rounded-lg text-[#7A9589] hover:text-forest" title="Bearbeiten">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(tenant.id)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg text-[#7A9589] hover:text-red-500" title="Löschen">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ADD / EDIT MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-strong w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-cream-deeper max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-cream-deeper flex justify-between items-center geo-pattern shrink-0">
                            <h2 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-2xl font-bold text-white">{isEditMode ? 'Mieter bearbeiten' : 'Neuer Mieter'}</h2>
                            <button onClick={() => setIsFormOpen(false)} className="text-white/60 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                                        <input name="name" value={formData.name || ''} required onChange={handleInputChange} placeholder="e.g. Acme Corp" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person *</label>
                                        <input name="contactName" value={formData.contactName || ''} required onChange={handleInputChange} placeholder="e.g. Jane Doe" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                        <input name="email" value={formData.email || ''} type="email" required onChange={handleInputChange} placeholder="e.g. jane@company.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                        <input name="phone" value={formData.phone || ''} onChange={handleInputChange} placeholder="e.g. (555) 123-4567" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>

                                    {/* Property Assignment Logic */}
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign Property *</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                name="propertyId"
                                                value={formData.propertyId || ''}
                                                required
                                                onChange={handleInputChange}
                                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all appearance-none"
                                            >
                                                <option value="">Select Building...</option>
                                                {properties.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Unit Assignment Logic */}
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Assign Unit
                                            {formData.propertyId && (
                                                <span className="ml-2 text-xs font-normal text-slate-400">
                                                    ({selectedPropertyUnits.length} available)
                                                </span>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                name="unitId"
                                                value={formData.unitId || ''}
                                                onChange={(e) => {
                                                    handleInputChange(e);
                                                    // Auto-fill rent from selected unit
                                                    const unit = selectedPropertyUnits.find(u => u.id === e.target.value);
                                                    if (unit?.rentMonthly) {
                                                        setFormData(prev => ({ ...prev, unitId: e.target.value, monthlyRent: unit.rentMonthly }));
                                                    }
                                                }}
                                                disabled={!formData.propertyId || selectedPropertyUnits.length === 0}
                                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-400"
                                            >
                                                <option value="">Select Unit...</option>
                                                {selectedPropertyUnits.length > 0 ? (
                                                    selectedPropertyUnits.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            Unit {u.unitNumber} {u.floor ? `(${u.floor})` : ''} — €{u.rentMonthly?.toLocaleString()}/mo — {u.status}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option value="" disabled>No units — add units in Properties first</option>
                                                )}
                                            </select>
                                        </div>
                                        {formData.propertyId && selectedPropertyUnits.length === 0 && (
                                            <p className="mt-1 text-xs text-amber-600">
                                                ⚠️ This property has no units. Add units via Properties → Manage Units first.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Lease Start</label>
                                        <input name="leaseStart" value={formData.leaseStart || ''} type="date" required onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Lease End</label>
                                        <input name="leaseEnd" value={formData.leaseEnd || ''} type="date" required onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rent (€)</label>
                                        <input name="monthlyRent" value={formData.monthlyRent || ''} type="number" required onChange={handleInputChange} placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all">
                                            <option value="Good Standing">Good Standing</option>
                                            <option value="Late">Late</option>
                                            <option value="Notice Given">Notice Given</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end space-x-3 border-t border-cream-deeper mt-4">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#4A6358] hover:bg-cream-dark rounded-xl transition-colors">
                                        Abbrechen
                                    </button>
                                    <button type="submit" className="btn-gold px-5 py-2 text-sm font-semibold shadow-soft" style={{ width: 'auto', borderRadius: '10px' }}>
                                        {isEditMode ? 'Speichern' : 'Mieter anlegen'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL VIEW MODAL */}
            {isDetailOpen && selectedTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-strong w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="h-24 geo-pattern relative shrink-0">
                            <button onClick={() => setIsDetailOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                            <div className="absolute -bottom-10 left-6">
                                <div className="w-20 h-20 bg-white rounded-xl shadow-medium flex items-center justify-center border-4 border-white">
                                    <div className="w-full h-full bg-cream-dark rounded-lg flex items-center justify-center text-forest font-bold text-2xl" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                        {selectedTenant.name.substring(0, 2).toUpperCase()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-12 px-6 pb-2 shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-2xl font-bold text-[#1A2E25]">{selectedTenant.name}</h2>
                                    <p className="text-sm text-[#7A9589]">{selectedTenant.contactName}</p>
                                </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                    selectedTenant.status === 'Good Standing'
                                    ? 'bg-[#EAF4EE] text-[#2D7A4A]'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                    {selectedTenant.status}
                                </span>
                            </div>

                            <div className="flex border-b border-cream-deeper space-x-6">
                                <button onClick={() => setActiveTab('overview')} className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'overview' ? 'text-forest border-b-2 border-forest' : 'text-[#7A9589]'}`}>Overview</button>
                                <button onClick={() => setActiveTab('lease')}    className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'lease'    ? 'text-forest border-b-2 border-forest' : 'text-[#7A9589]'}`}>Lease</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-cream">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <div className="bg-white p-4 rounded-xl shadow-soft border border-cream-deeper">
                                        <h3 className="text-xs font-bold text-[#7A9589] uppercase tracking-wider mb-3">Objektzuweisung</h3>
                                        <div className="flex items-start space-x-3">
                                            <div className="p-2 bg-cream-dark rounded-xl border border-cream-deeper"><Building2 className="w-5 h-5 text-forest" /></div>
                                            <div>
                                                <div className="font-semibold text-[#1A2E25]">{getPropertyName(selectedTenant.propertyId)}</div>
                                                <div className="text-xs text-[#7A9589] mt-1">
                                                    {selectedTenant.unitId && <span className="font-bold text-forest mr-1">Einheit {getUnitNumber(selectedTenant.propertyId, selectedTenant.unitId)}</span>}
                                                    €{selectedTenant.monthlyRent.toLocaleString()}/Monat
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'lease' && (
                                <div className="bg-white p-6 rounded-xl shadow-soft border border-cream-deeper">
                                    <h3 className="text-lg font-bold text-[#1A2E25] mb-4" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Mietvertrag</h3>
                                    <div className="prose prose-sm max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-[#4A6358]">{selectedTenant.leaseContent || 'Kein Vertragsinhalt vorhanden.'}</pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-cream-deeper flex justify-between items-center bg-white shrink-0">
                            <button onClick={() => { setIsDetailOpen(false); handleDelete(selectedTenant.id); }} className="text-red-600 hover:text-red-700 text-sm font-semibold flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Entfernen</button>
                            <div className="flex space-x-3">
                                <button onClick={() => { setIsDetailOpen(false); openEditModal(selectedTenant); }} className="flex items-center gap-1.5 px-4 py-2 border border-cream-deeper rounded-xl text-sm font-medium hover:bg-cream-dark transition-colors text-[#4A6358]">Bearbeiten</button>
                                <button onClick={() => setIsDetailOpen(false)} className="btn-gold px-5 py-2 text-sm font-semibold shadow-soft" style={{ width: 'auto', borderRadius: '10px' }}>Schließen</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tenants;
