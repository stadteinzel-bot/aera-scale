import React, { useState, useMemo } from 'react';
import { Property, PropertyUnit, RentPayment, PropertyDocument } from '../types';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';
import {
    ArrowLeft, MapPin, Maximize, Euro, Building, Edit2, Save, X, Plus, Trash2,
    User, UserPlus, UserMinus, Phone, Mail, Calendar, CheckCircle2, ExternalLink,
    History, Receipt, Download, ChevronDown, Info, FileText, TrendingUp, Home,
    BarChart3, Users, DoorOpen, Layers
} from 'lucide-react';

type DetailTab = 'overview' | 'units' | 'financial' | 'documents';

interface PropertyDetailProps {
    property: Property;
    onBack: () => void;
}

const PropertyDetail: React.FC<PropertyDetailProps> = ({ property, onBack }) => {
    const { data, dispatch } = useDataCore();
    const { t } = useTranslation();
    const tenants = data.tenants;
    const allDocuments = data.documents;

    const [activeTab, setActiveTab] = useState<DetailTab>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Property>>({ ...property, landlord: property.landlord || { name: '', address: '', zipCode: '', city: '', email: '', iban: '' } });

    // Unit editing
    const [editingUnit, setEditingUnit] = useState<Partial<PropertyUnit> | null>(null);
    const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null);
    const [selectedTenantId, setSelectedTenantId] = useState('');

    // Payment form
    const [paymentUnitId, setPaymentUnitId] = useState<string | null>(null);
    const [newPayment, setNewPayment] = useState<Partial<RentPayment>>({ status: 'Paid', date: new Date().toISOString().split('T')[0] });

    // === COMPUTED ===
    const propertyTenants = useMemo(() =>
        tenants.filter(t => t.propertyId === property.id),
        [tenants, property.id]
    );

    const propertyDocuments = useMemo(() =>
        allDocuments.filter((d: PropertyDocument) => d.propertyId === property.id),
        [allDocuments, property.id]
    );

    const units = property.units || [];
    const occupiedUnits = units.filter(u => u.status === 'Occupied');
    const totalMonthlyRent = units.reduce((sum, u) => sum + u.rentMonthly, 0);
    const occupancyRate = units.length > 0 ? Math.round((occupiedUnits.length / units.length) * 100) : 0;

    // === HANDLERS ===
    const handleSaveProperty = async () => {
        try {
            await dispatch({ type: 'property:update', id: property.id, payload: editForm });
            setIsEditing(false);
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const handleSaveUnit = async () => {
        if (!editingUnit || !editingUnit.unitNumber) return;
        if (editingUnit.unitNumber.length > 10) {
            alert('Einheitennummer darf max. 10 Zeichen haben.');
            return;
        }
        try {
            let updatedUnits = [...(property.units || [])];
            if (editingUnit.id) {
                updatedUnits = updatedUnits.map(u => u.id === editingUnit.id ? { ...u, ...editingUnit } as PropertyUnit : u);
            } else {
                updatedUnits.push({
                    id: `u${Date.now()}`,
                    unitNumber: editingUnit.unitNumber,
                    sizeSqFt: Number(editingUnit.sizeSqFt) || 0,
                    rentMonthly: Number(editingUnit.rentMonthly) || 0,
                    status: (editingUnit.status as any) || 'Vacant',
                    floor: editingUnit.floor,
                    rentHistory: []
                });
            }
            await dispatch({ type: 'property:update', id: property.id, payload: { units: updatedUnits } });
            setEditingUnit(null);
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!window.confirm('Einheit wirklich löschen?')) return;
        const updatedUnits = (property.units || []).filter(u => u.id !== unitId);
        try {
            await dispatch({ type: 'property:update', id: property.id, payload: { units: updatedUnits } });
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const handleAssignTenant = async () => {
        if (!assigningUnitId || !selectedTenantId) return;
        const updatedUnits = (property.units || []).map(u =>
            u.id === assigningUnitId ? { ...u, status: 'Occupied' as const } : u
        );
        try {
            await dispatch({ type: 'property:update', id: property.id, payload: { units: updatedUnits } });
            await dispatch({ type: 'tenant:update', id: selectedTenantId, payload: { unitId: assigningUnitId, propertyId: property.id } });
            setAssigningUnitId(null);
            setSelectedTenantId('');
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const handleVacateUnit = async (unitId: string) => {
        if (!window.confirm('Mieter wirklich auschecken?')) return;
        const updatedUnits = (property.units || []).map(u =>
            u.id === unitId ? { ...u, status: 'Vacant' as const } : u
        );
        const linkedTenant = tenants.find(t => t.unitId === unitId);
        try {
            await dispatch({ type: 'property:update', id: property.id, payload: { units: updatedUnits } });
            if (linkedTenant) {
                await dispatch({ type: 'tenant:update', id: linkedTenant.id, payload: { unitId: '' } });
            }
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const addRentPayment = async () => {
        if (!paymentUnitId || !newPayment.period || !newPayment.amount) return;
        const payment: RentPayment = {
            id: `rp${Date.now()}`,
            date: newPayment.date || new Date().toISOString().split('T')[0],
            amount: Number(newPayment.amount),
            status: newPayment.status as any || 'Paid',
            period: newPayment.period
        };
        const updatedUnits = (property.units || []).map(u =>
            u.id === paymentUnitId ? { ...u, rentHistory: [payment, ...(u.rentHistory || [])] } : u
        );
        try {
            await dispatch({ type: 'property:update', id: property.id, payload: { units: updatedUnits } });
            setNewPayment({ status: 'Paid', date: new Date().toISOString().split('T')[0] });
            setPaymentUnitId(null);
        } catch (err: any) {
            alert(`Fehler: ${err.message}`);
        }
    };

    const tabs: { id: DetailTab; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'Übersicht', icon: Home },
        { id: 'units', label: 'Einheiten & Mieter', icon: Layers },
        { id: 'financial', label: 'Finanzen', icon: TrendingUp },
        { id: 'documents', label: 'Dokumente', icon: FileText },
    ];

    return (
        <div className="space-y-0 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Back + Hero */}
            <div className="relative rounded-2xl overflow-hidden mb-6 shadow-lg">
                <img src={property.image} alt={property.name} className="w-full h-56 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm text-slate-800 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white transition-all shadow-md"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end justify-between">
                        <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${property.status === 'Occupied' ? 'bg-emerald-500/90 text-white' :
                                property.status === 'Vacant' ? 'bg-red-500/90 text-white' :
                                    'bg-amber-500/90 text-white'
                                }`}>{property.status}</span>
                            <h1 className="text-3xl font-bold text-white">{property.name}</h1>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center text-white/80 text-sm mt-1 hover:text-white transition-colors"
                            >
                                <MapPin className="w-4 h-4 mr-1" />{property.address}
                            </a>
                        </div>
                        <span className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm font-medium">
                            {property.type}
                        </span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Einheiten', value: units.length, icon: Layers, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                    { label: 'Auslastung', value: `${occupancyRate}%`, icon: BarChart3, color: occupancyRate > 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100' },
                    { label: 'Monatl. Miete', value: `€${totalMonthlyRent.toLocaleString()}`, icon: Euro, color: 'bg-aera-50 text-aera-700 border-aera-100' },
                    { label: 'Mieter', value: propertyTenants.length, icon: Users, color: 'bg-violet-50 text-violet-700 border-violet-100' },
                ].map((kpi, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${kpi.color} flex items-center gap-3`}>
                        <div className="p-2 rounded-lg bg-white/60"><kpi.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                            <div className="text-xs font-medium opacity-70">{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 mb-6 shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id
                            ? 'bg-aera-900 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* === TAB: OVERVIEW === */}
            {activeTab === 'overview' && (
                <>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-aera-900">Objektdetails</h2>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <button onClick={() => { setIsEditing(false); setEditForm({ ...property, landlord: property.landlord || { name: '', address: '', zipCode: '', city: '', email: '', iban: '' } }); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Abbrechen</button>
                                    <button onClick={handleSaveProperty} className="px-4 py-1.5 text-sm bg-aera-900 text-white rounded-lg hover:bg-aera-800 transition-colors flex items-center gap-1.5 shadow-sm"><Save className="w-3.5 h-3.5" />Speichern</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200"><Edit2 className="w-3.5 h-3.5" />Bearbeiten</button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
                                {isEditing ? (
                                    <input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                ) : (
                                    <p className="text-sm font-medium text-slate-900">{property.name}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Adresse</label>
                                {isEditing ? (
                                    <input value={editForm.address || ''} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                ) : (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`} target="_blank" rel="noreferrer" className="text-sm text-aera-600 hover:underline flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{property.address}</a>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Typ</label>
                                {isEditing ? (
                                    <select value={editForm.type || 'Office'} onChange={e => setEditForm(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm bg-white">
                                        {['Office', 'Retail', 'Industrial', 'Mixed Use'].map(tp => <option key={tp} value={tp}>{tp}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-sm font-medium text-slate-900">{property.type}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Gesamtfläche</label>
                                {isEditing ? (
                                    <input type="number" value={editForm.sizeSqFt || ''} onChange={e => setEditForm(p => ({ ...p, sizeSqFt: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                ) : (
                                    <p className="text-sm font-medium text-slate-900">{property.sizeSqFt.toLocaleString()} m²</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mietpreis</label>
                                {isEditing ? (
                                    <input type="number" value={editForm.rentPerSqFt || ''} onChange={e => setEditForm(p => ({ ...p, rentPerSqFt: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                ) : (
                                    <p className="text-sm font-medium text-slate-900">€{property.rentPerSqFt}/m²</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                                {isEditing ? (
                                    <select value={editForm.status || 'Occupied'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm bg-white">
                                        <option value="Occupied">Belegt</option><option value="Vacant">Leer</option><option value="Maintenance">Wartung</option>
                                    </select>
                                ) : (
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${property.status === 'Occupied' ? 'bg-emerald-100 text-emerald-800' :
                                        property.status === 'Vacant' ? 'bg-red-100 text-red-800' :
                                            'bg-orange-100 text-orange-800'
                                        }`}>{property.status}</span>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Beschreibung</label>
                                {isEditing ? (
                                    <textarea value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm min-h-[80px]" />
                                ) : (
                                    <p className="text-sm text-slate-600 leading-relaxed">{property.description || 'Keine Beschreibung vorhanden.'}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ausstattung</label>
                                {isEditing ? (
                                    <input value={editForm.amenities?.join(', ') || ''} onChange={e => setEditForm(p => ({ ...p, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="z.B. Aufzug, Parkplatz, Klimaanlage" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(property.amenities && property.amenities.length > 0) ? property.amenities.map((a, i) => (
                                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                <CheckCircle2 className="w-3 h-3 mr-1 text-aera-600" />{a}
                                            </span>
                                        )) : <span className="text-sm text-slate-400 italic">Keine Ausstattung angegeben</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Vermieter & Bankverbindung */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-4 animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-aera-900 mb-5 flex items-center gap-2">
                            <User className="w-5 h-5" />Vermieter & Bankverbindung
                        </h2>
                        {(property.landlord?.name || isEditing) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Vermieter</label>
                                    {isEditing ? (
                                        <input value={editForm.landlord?.name || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, name: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-900">{property.landlord.name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Adresse</label>
                                    {isEditing ? (
                                        <input value={editForm.landlord?.address || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, address: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                    ) : (
                                        <p className="text-sm text-slate-900">{property.landlord.address}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">PLZ / Ort</label>
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <input value={editForm.landlord?.zipCode || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, zipCode: e.target.value } }))} placeholder="PLZ" className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            <input value={editForm.landlord?.city || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, city: e.target.value } }))} placeholder="Ort" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-900">{property.landlord.zipCode} {property.landlord.city}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">E-Mail</label>
                                    {isEditing ? (
                                        <input type="email" value={editForm.landlord?.email || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, email: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                    ) : (
                                        <a href={`mailto:${property.landlord.email}`} className="text-sm text-aera-600 hover:underline flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{property.landlord.email}</a>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Telefon</label>
                                    {isEditing ? (
                                        <input value={editForm.landlord?.phone || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, phone: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                    ) : (
                                        <p className="text-sm text-slate-900">{property.landlord.phone || '—'}</p>
                                    )}
                                </div>
                                {/* Bankverbindung */}
                                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bankverbindung</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-1">IBAN</label>
                                            {isEditing ? (
                                                <input value={editForm.landlord?.iban || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, iban: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm font-mono" />
                                            ) : (
                                                <p className="text-sm font-mono text-slate-900">{property.landlord.iban || '—'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-1">BIC</label>
                                            {isEditing ? (
                                                <input value={editForm.landlord?.bic || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, bic: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm font-mono" />
                                            ) : (
                                                <p className="text-sm font-mono text-slate-900">{property.landlord.bic || '—'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-1">Bankname</label>
                                            {isEditing ? (
                                                <input value={editForm.landlord?.bankName || ''} onChange={e => setEditForm(p => ({ ...p, landlord: { ...p.landlord!, bankName: e.target.value } }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            ) : (
                                                <p className="text-sm text-slate-900">{property.landlord.bankName || '—'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm font-medium">Kein Vermieter hinterlegt</p>
                                <p className="text-xs mt-1">Bearbeiten Sie das Objekt, um Vermieter-Daten hinzuzufügen.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* === TAB: UNITS & TENANTS === */}
            {
                activeTab === 'units' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-aera-900">Einheiten & Mieter</h2>
                            <button onClick={() => setEditingUnit({ status: 'Vacant' })} className="flex items-center gap-1.5 bg-aera-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-800 transition-colors shadow-sm">
                                <Plus className="w-4 h-4" />Einheit hinzufügen
                            </button>
                        </div>

                        {units.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-xl">
                                <Building className="w-12 h-12 text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">Noch keine Einheiten</p>
                                <p className="text-sm text-slate-400 mt-1">Erstellen Sie die erste Einheit für dieses Objekt.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {units.map(unit => {
                                    const linkedTenant = tenants.find(t => t.unitId === unit.id);
                                    return (
                                        <div key={unit.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-aera-200 transition-all overflow-hidden">
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-aera-50 rounded-xl flex items-center justify-center text-aera-800 font-bold text-lg border border-aera-100">{unit.unitNumber}</div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                            Einheit {unit.unitNumber}
                                                            {unit.floor && <span className="text-xs text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded">{unit.floor}</span>}
                                                        </div>
                                                        <div className="text-sm text-slate-500 flex gap-3 mt-0.5">
                                                            <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{unit.sizeSqFt.toLocaleString()} m²</span>
                                                            <span className="flex items-center gap-1"><Euro className="w-3 h-3" />€{unit.rentMonthly.toLocaleString()}/Mo</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${unit.status === 'Occupied' ? 'bg-emerald-100 text-emerald-800' :
                                                        unit.status === 'Vacant' ? 'bg-slate-100 text-slate-600' :
                                                            'bg-orange-100 text-orange-800'
                                                        }`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${unit.status === 'Occupied' ? 'bg-emerald-500' : unit.status === 'Vacant' ? 'bg-slate-400' : 'bg-orange-500'}`} />
                                                        {unit.status === 'Occupied' ? 'Belegt' : unit.status === 'Vacant' ? 'Leer' : 'Wartung'}
                                                    </span>
                                                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                                                        <button onClick={() => setEditingUnit({ ...unit })} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-aera-600 transition-all" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteUnit(unit.id)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-red-500 transition-all" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Tenant Section */}
                                            <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                                {linkedTenant ? (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-aera-100 border border-aera-200 flex items-center justify-center text-aera-800 text-sm font-bold">{linkedTenant.name.substring(0, 2).toUpperCase()}</div>
                                                            <div>
                                                                <div className="font-semibold text-sm text-slate-900">{linkedTenant.name}</div>
                                                                <div className="flex items-center text-xs text-slate-500 gap-4 mt-0.5">
                                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{linkedTenant.contactName}</span>
                                                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{linkedTenant.email}</span>
                                                                </div>
                                                                <div className="flex items-center text-xs text-slate-400 gap-4 mt-1">
                                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Vertrag: {linkedTenant.leaseStart} — {linkedTenant.leaseEnd}</span>
                                                                    <span className="flex items-center gap-1"><Euro className="w-3 h-3" />€{linkedTenant.monthlyRent.toLocaleString()}/Mo</span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${linkedTenant.status === 'Good Standing' ? 'bg-emerald-100 text-emerald-700' :
                                                                        linkedTenant.status === 'Late' ? 'bg-red-100 text-red-700' :
                                                                            'bg-amber-100 text-amber-700'
                                                                        }`}>{linkedTenant.status}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleVacateUnit(unit.id)} className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"><UserMinus className="w-3.5 h-3.5" />Auschecken</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-slate-400 italic flex items-center gap-2"><User className="w-4 h-4 opacity-50" />Kein Mieter zugewiesen</span>
                                                        <button onClick={() => { setAssigningUnitId(unit.id); setSelectedTenantId(''); }} className="text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-aera-900 hover:border-aera-600 px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" />Mieter zuweisen</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Edit Unit Modal */}
                        {editingUnit && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center mb-5">
                                        <h3 className="text-lg font-bold text-aera-900">{editingUnit.id ? 'Einheit bearbeiten' : 'Neue Einheit'}</h3>
                                        <button onClick={() => setEditingUnit(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Einheitennr. *</label>
                                                <input maxLength={10} value={editingUnit.unitNumber || ''} onChange={e => setEditingUnit(p => ({ ...p!, unitNumber: e.target.value }))} placeholder="z.B. 101" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Etage</label>
                                                <input value={editingUnit.floor || ''} onChange={e => setEditingUnit(p => ({ ...p!, floor: e.target.value }))} placeholder="z.B. 1. OG" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select value={editingUnit.status || 'Vacant'} onChange={e => setEditingUnit(p => ({ ...p!, status: e.target.value as any }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm bg-white">
                                                <option value="Vacant">Leer</option><option value="Occupied">Belegt</option><option value="Maintenance">Wartung</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Fläche (m²)</label>
                                                <input type="number" value={editingUnit.sizeSqFt || ''} onChange={e => setEditingUnit(p => ({ ...p!, sizeSqFt: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Monatsmiete (€)</label>
                                                <input type="number" value={editingUnit.rentMonthly || ''} onChange={e => setEditingUnit(p => ({ ...p!, rentMonthly: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                            </div>
                                        </div>
                                        <button onClick={handleSaveUnit} disabled={!editingUnit.unitNumber} className="w-full bg-aera-900 text-white py-2.5 rounded-lg font-medium hover:bg-aera-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"><Save className="w-4 h-4" />Speichern</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Assign Tenant Modal */}
                        {assigningUnitId && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center mb-5">
                                        <h3 className="text-lg font-bold text-aera-900">Mieter zuweisen</h3>
                                        <button onClick={() => setAssigningUnitId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
                                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-800">Einheit wird automatisch auf <strong>Belegt</strong> gesetzt.</p>
                                        </div>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <select value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 bg-white appearance-none text-sm">
                                                <option value="">— Mieter wählen —</option>
                                                {tenants.filter(t => !t.unitId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.contactName})</option>)}
                                            </select>
                                        </div>
                                        {tenants.filter(t => !t.unitId).length === 0 && <p className="text-xs text-slate-500 italic">Keine freien Mieter verfügbar.</p>}
                                        <button onClick={handleAssignTenant} disabled={!selectedTenantId} className="w-full bg-aera-900 text-white py-2.5 rounded-lg font-medium hover:bg-aera-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"><CheckCircle2 className="w-4 h-4" />Zuweisen</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* === TAB: FINANCIAL === */}
            {
                activeTab === 'financial' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-aera-900">Finanzen & Zahlungen</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Gesammelt</div>
                                <div className="text-2xl font-bold text-emerald-900">€{units.reduce((s, u) => s + (u.rentHistory || []).filter(p => p.status === 'Paid').reduce((a, p) => a + p.amount, 0), 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Ausstehend</div>
                                <div className="text-2xl font-bold text-amber-900">€{units.reduce((s, u) => s + (u.rentHistory || []).filter(p => p.status === 'Late' || p.status === 'Pending').reduce((a, p) => a + p.amount, 0), 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monatl. Sollmiete</div>
                                <div className="text-2xl font-bold text-slate-700">€{totalMonthlyRent.toLocaleString()}</div>
                            </div>
                        </div>

                        {units.map(unit => {
                            const history = unit.rentHistory || [];
                            const linkedTenant = tenants.find(t => t.unitId === unit.id);
                            return (
                                <div key={unit.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-aera-50 rounded-lg flex items-center justify-center text-aera-800 font-bold border border-aera-100">{unit.unitNumber}</div>
                                            <div>
                                                <span className="font-semibold text-sm text-slate-900">Einheit {unit.unitNumber}</span>
                                                {linkedTenant && <span className="text-xs text-slate-500 ml-2">• {linkedTenant.name}</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => setPaymentUnitId(paymentUnitId === unit.id ? null : unit.id)} className="text-xs font-medium text-aera-600 hover:text-aera-800 flex items-center gap-1">
                                            <Plus className="w-3 h-3" />{paymentUnitId === unit.id ? 'Ausblenden' : 'Zahlung erfassen'}
                                        </button>
                                    </div>

                                    {paymentUnitId === unit.id && (
                                        <div className="p-4 bg-aera-50/50 border-b border-slate-100">
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                <input type="text" placeholder="Zeitraum" value={newPayment.period || ''} onChange={e => setNewPayment(p => ({ ...p, period: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600" />
                                                <input type="date" value={newPayment.date || ''} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600" />
                                                <input type="number" placeholder="Betrag (€)" value={newPayment.amount || ''} onChange={e => setNewPayment(p => ({ ...p, amount: Number(e.target.value) }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600" />
                                                <select value={newPayment.status || 'Paid'} onChange={e => setNewPayment(p => ({ ...p, status: e.target.value as any }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600 bg-white">
                                                    <option value="Paid">Bezahlt</option><option value="Pending">Ausstehend</option><option value="Late">Verspätet</option>
                                                </select>
                                                <button onClick={addRentPayment} disabled={!newPayment.period || !newPayment.amount} className="bg-aera-900 text-white rounded-lg text-sm font-medium hover:bg-aera-800 disabled:opacity-50 transition-colors">Erfassen</button>
                                            </div>
                                        </div>
                                    )}

                                    {history.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                                <th className="px-4 py-2.5 text-left font-semibold">Datum</th>
                                                <th className="px-4 py-2.5 text-left font-semibold">Zeitraum</th>
                                                <th className="px-4 py-2.5 text-left font-semibold">Betrag</th>
                                                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {history.map(p => (
                                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-2.5 text-slate-900">{p.date}</td>
                                                        <td className="px-4 py-2.5 text-slate-600">{p.period}</td>
                                                        <td className="px-4 py-2.5 font-medium text-slate-900">€{p.amount.toLocaleString()}</td>
                                                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : p.status === 'Late' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.status}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-6 text-center text-sm text-slate-400 italic">Keine Zahlungshistorie</div>
                                    )}
                                </div>
                            );
                        })}
                        {units.length === 0 && <div className="text-center py-12 text-slate-400">Erstellen Sie zunächst Einheiten im Tab &quot;Einheiten &amp; Mieter&quot;.</div>}
                    </div>
                )
            }

            {/* === TAB: DOCUMENTS === */}
            {
                activeTab === 'documents' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-aera-900">Dokumente</h2>
                        {propertyDocuments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-xl">
                                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">Keine Dokumente</p>
                                <p className="text-sm text-slate-400 mt-1">Zu diesem Objekt sind keine Dokumente zugeordnet.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left font-semibold">Dokument</th>
                                        <th className="px-4 py-3 text-left font-semibold">Typ</th>
                                        <th className="px-4 py-3 text-left font-semibold">Datum</th>
                                        <th className="px-4 py-3 text-left font-semibold">Größe</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {propertyDocuments.map((doc: PropertyDocument) => (
                                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-aera-600" />{doc.name}</td>
                                                <td className="px-4 py-3 text-slate-600"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{doc.type}</span></td>
                                                <td className="px-4 py-3 text-slate-500">{doc.uploadedAt}</td>
                                                <td className="px-4 py-3 text-slate-500">{(doc.fileSize / 1024).toFixed(0)} KB</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default PropertyDetail;
