import React, { useState } from 'react';

import { Property, PropertyUnit, RentPayment, Tenant, Landlord } from '../types';
import { MapPin, Maximize, Euro, Plus, X, Search, ExternalLink, Building, Sparkles, Loader2, Info, CheckCircle2, ArrowLeft, ArrowRight, Edit2, Trash2, Save, History, Receipt, Download, UserPlus, UserMinus, User, Phone, Mail, Calendar, ChevronDown } from 'lucide-react';
import { findPropertyDetails } from '../services/geminiService';
import { dataService } from '../services/dataService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';


const PROPERTY_TYPES = ['Office', 'Retail', 'Industrial', 'Mixed Use'];

interface PropertiesProps {
    onSelectAsset?: (propertyId: string) => void;
}

const Properties: React.FC<PropertiesProps> = ({ onSelectAsset }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading: coreLoading, reload } = useDataCore();
    const properties = data.properties;
    const tenants = data.tenants;
    const isLoading = coreLoading;
    const { t } = useTranslation();
    const [filter, setFilter] = useState<'All' | 'Occupied' | 'Vacant'>('All');



    // Modal State (for Add Property form only)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [modalView, setModalView] = useState<'details' | 'manage-units' | 'edit-unit' | 'unit-history' | 'assign-tenant'>('details');
    const [editingUnit, setEditingUnit] = useState<Partial<PropertyUnit>>({});
    const [viewingUnitHistory, setViewingUnitHistory] = useState<PropertyUnit | null>(null);

    // Assign Tenant State
    const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null);
    const [selectedTenantId, setSelectedTenantId] = useState<string>('');

    // New Rent Payment Form State
    const [newPayment, setNewPayment] = useState<Partial<RentPayment>>({ status: 'Paid', date: new Date().toISOString().split('T')[0] });

    const [formData, setFormData] = useState<Partial<Property>>({
        status: 'Occupied',
        type: 'Office',
        image: '',
        amenities: [],
        landlord: { name: '', address: '', zipCode: '', city: '', email: '', iban: '' }
    });

    // Auto-Fill State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isAddressSearching, setIsAddressSearching] = useState(false);

    const filteredProperties = properties.filter(p => {
        if (filter === 'All') return true;
        return p.status === filter;
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAmenitiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, amenities: val.split(',').map(s => s.trim()).filter(Boolean) }));
    };

    const handleAddressSearch = () => {
        if (formData.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`, '_blank');
        }
    };

    const validatePropertyType = (type?: string): string => {
        return type && PROPERTY_TYPES.includes(type) ? type : 'Office';
    };

    const handleAutoFill = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);

        try {
            const details = await findPropertyDetails(searchQuery);

            if (details) {
                setFormData(prev => ({
                    ...prev,
                    name: details.name || prev.name,
                    address: details.address || prev.address,
                    type: validatePropertyType(details.type) as any,
                    description: details.description || prev.description,
                    amenities: details.amenities || prev.amenities,
                    rentPerSqFt: details.marketRent || prev.rentPerSqFt
                }));
            } else {
                throw new Error("No details returned from AI.");
            }
        } catch (error) {
            console.error("Auto-fill Error:", error);
            const msg = error instanceof Error ? error.message : "Unknown error";
            alert(`AI Search Failed: ${msg}. \nPlease ensure your Google Cloud 'Vertex AI API' is enabled and you have granted 'vertex-ai-user' permissions.`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddressLookup = async () => {
        if (!formData.address?.trim()) return;
        setIsAddressSearching(true);

        try {
            const details = await findPropertyDetails(formData.address);

            if (details) {
                setFormData(prev => ({
                    ...prev,
                    name: (!prev.name) ? (details.name || prev.name) : prev.name,
                    address: details.address || prev.address,
                    type: (!prev.type) ? (validatePropertyType(details.type) as any) : prev.type,
                    description: (!prev.description) ? (details.description || '') : prev.description,
                    amenities: (!prev.amenities || prev.amenities.length === 0) ? (details.amenities || []) : prev.amenities,
                    rentPerSqFt: (!prev.rentPerSqFt) ? (details.marketRent || 0) : prev.rentPerSqFt
                }));
            }
        } catch (error) {
            console.error("Address Lookup Error:", error);
            // Optional: alert user or just log since this is often background verification
            const msg = error instanceof Error ? error.message : "Unknown error";
            alert(`Address Verification Failed: ${msg}`);
        } finally {
            setIsAddressSearching(false);
        }
    };


    const handleDeleteProperty = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this property and all its data? This action cannot be undone.')) {
            try {
                await dispatch({ type: 'property:delete', id });
                if (selectedProperty?.id === id) {
                    setSelectedProperty(null);
                }
            } catch (error: any) {
                alert(`Failed to delete property: ${error.message}`);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.address) {
            alert('Please fill in Property Name and Address before creating.');
            return;
        }

        let imageUrl = formData.image;
        if (!imageUrl) {
            const seed = Math.floor(Math.random() * 1000);
            imageUrl = `https://picsum.photos/400/300?random=${seed}`;
        }

        const landlordData: Landlord | undefined = formData.landlord?.name ? {
            name: formData.landlord.name,
            address: formData.landlord.address || '',
            zipCode: formData.landlord.zipCode || '',
            city: formData.landlord.city || '',
            email: formData.landlord.email || '',
            phone: formData.landlord.phone || '',
            iban: formData.landlord.iban || '',
            bic: formData.landlord.bic || '',
            bankName: formData.landlord.bankName || '',
        } : undefined;

        const newPropertyData: Omit<Property, "id"> = {
            name: formData.name,
            address: formData.address,
            type: (formData.type as any) || 'Office',
            sizeSqFt: Number(formData.sizeSqFt) || 0,
            rentPerSqFt: Number(formData.rentPerSqFt) || 0,
            status: (formData.status as any) || 'Vacant',
            image: imageUrl,
            description: formData.description || '',
            amenities: formData.amenities || [],
            units: [],
            landlord: landlordData
        };

        try {
            console.log('Saving property to Firestore...', newPropertyData);
            await dispatch({ type: 'property:add', payload: newPropertyData });
            console.log('Property saved successfully via DataCore');

            setIsModalOpen(false);
            setFormData({ status: 'Occupied', type: 'Office', image: '', amenities: [], landlord: { name: '', address: '', zipCode: '', city: '', email: '', iban: '' } });
            setSearchQuery('');
        } catch (error: any) {
            console.error('Failed to save property:', error);
            alert(`Failed to save property: ${error.code || ''} ${error.message || error}`);
        }
    };

    // Unit Management Functions
    const openManageUnits = () => {
        setModalView('manage-units');
    };

    const openEditUnit = (unit?: PropertyUnit) => {
        if (unit) {
            setEditingUnit(unit);
        } else {
            setEditingUnit({ status: 'Vacant' });
        }
        setModalView('edit-unit');
    };

    const openHistory = (unit: PropertyUnit) => {
        setViewingUnitHistory(unit);
        setNewPayment({ status: 'Paid', date: new Date().toISOString().split('T')[0], amount: unit.rentMonthly });
        setModalView('unit-history');
    };

    const deleteUnit = async (unitId: string) => {
        if (!selectedProperty) return;
        const updatedUnits = selectedProperty.units?.filter(u => u.id !== unitId) || [];
        try {
            await dispatch({ type: 'property:update', id: selectedProperty.id, payload: { units: updatedUnits } });
            setSelectedProperty({ ...selectedProperty, units: updatedUnits });
        } catch (error: any) {
            alert(`Failed to delete unit: ${error.message}`);
        }
    };

    const saveUnit = async () => {
        if (!selectedProperty || !editingUnit.unitNumber) return;

        if (editingUnit.unitNumber.length > 10) {
            alert("Unit Number cannot exceed 10 characters.");
            return;
        }

        let updatedUnits = [...(selectedProperty.units || [])];

        if (editingUnit.id) {
            updatedUnits = updatedUnits.map(u => u.id === editingUnit.id ? { ...u, ...editingUnit } as PropertyUnit : u);
        } else {
            const newUnit: PropertyUnit = {
                id: `u${Date.now()}`,
                unitNumber: editingUnit.unitNumber!,
                sizeSqFt: Number(editingUnit.sizeSqFt) || 0,
                rentMonthly: Number(editingUnit.rentMonthly) || 0,
                status: (editingUnit.status as any) || 'Vacant',
                floor: editingUnit.floor,
                rentHistory: []
            };
            updatedUnits.push(newUnit);
        }

        setModalView('manage-units');
        try {
            await dispatch({ type: 'property:update', id: selectedProperty.id, payload: { units: updatedUnits } });
            setSelectedProperty({ ...selectedProperty, units: updatedUnits });
        } catch (error: any) {
            alert(`Failed to save unit: ${error.message}`);
        }
    };

    const addRentPayment = async () => {
        if (!selectedProperty || !viewingUnitHistory) return;
        if (!newPayment.amount || !newPayment.period) return;

        const payment: RentPayment = {
            id: `rp${Date.now()}`,
            date: newPayment.date || new Date().toISOString().split('T')[0],
            amount: Number(newPayment.amount),
            status: newPayment.status as any || 'Paid',
            period: newPayment.period
        };

        const updatedUnits = selectedProperty.units?.map(u => {
            if (u.id === viewingUnitHistory.id) {
                return {
                    ...u,
                    rentHistory: [payment, ...(u.rentHistory || [])]
                };
            }
            return u;
        }) || [];

        const updatedProperty = { ...selectedProperty, units: updatedUnits };
        const updatedUnit = updatedUnits.find(u => u.id === viewingUnitHistory.id) || null;

        setViewingUnitHistory(updatedUnit as PropertyUnit);
        setNewPayment(prev => ({ ...prev, period: '', status: 'Paid' }));
        try {
            await dispatch({ type: 'property:update', id: selectedProperty.id, payload: { units: updatedUnits } });
            setSelectedProperty({ ...selectedProperty, units: updatedUnits });
        } catch (error: any) {
            alert(`Failed to save rent payment: ${error.message}`);
        }
    };

    const handleSeedData = async () => {
        if (window.confirm("⚠️ This will RESET ALL DATA to demo defaults. All your changes will be lost. Continue?")) {
            const success = await dataService.seedDatabase(true);
            if (success) {
                await reload();
            } else {
                alert("Failed to seed database. Check console for errors.");
            }
        }
    };

    // --- TENANT ASSIGNMENT FUNCTIONS ---

    const handleVacateUnit = async (unitId: string) => {
        if (!window.confirm("Are you sure you want to remove the tenant from this unit?")) return;
        if (!selectedProperty) return;

        const updatedUnits = selectedProperty.units?.map(u => u.id === unitId ? { ...u, status: 'Vacant' as const } : u) || [];
        const linkedTenant = tenants.find(t => t.unitId === unitId);

        try {
            await dispatch({ type: 'property:update', id: selectedProperty.id, payload: { units: updatedUnits } });
            setSelectedProperty({ ...selectedProperty, units: updatedUnits });
            if (linkedTenant) {
                await dispatch({ type: 'tenant:update', id: linkedTenant.id, payload: { unitId: '' } });
            }
        } catch (error: any) {
            alert(`Failed to vacate unit: ${error.message}`);
        }
    };

    const handleAssignTenant = async () => {
        if (!selectedProperty || !assigningUnitId || !selectedTenantId) return;

        const updatedUnits = selectedProperty.units?.map(u => u.id === assigningUnitId ? { ...u, status: 'Occupied' as const } : u) || [];
        const tenantIdToAssign = selectedTenantId;

        setModalView('manage-units');
        setAssigningUnitId(null);
        setSelectedTenantId('');

        try {
            await dispatch({ type: 'property:update', id: selectedProperty.id, payload: { units: updatedUnits } });
            setSelectedProperty({ ...selectedProperty, units: updatedUnits });
            await dispatch({ type: 'tenant:update', id: tenantIdToAssign, payload: { unitId: assigningUnitId!, propertyId: selectedProperty.id } });
        } catch (error: any) {
            alert(`Failed to assign tenant: ${error.message}`);
        }
    };

    const openAssignModal = (unitId: string) => {
        setAssigningUnitId(unitId);
        setModalView('assign-tenant');
        setSelectedTenantId('');
    };

    const handleDownloadInvoice = (payment: RentPayment) => {
        alert("Downloading Invoice for " + payment.period);
    };



    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900">{t('properties.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('properties.subtitle')}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        {['All', 'Occupied', 'Vacant'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === f ? 'bg-aera-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-aera-600 hover:bg-aera-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Property
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aera-900"></div>
                </div>
            ) : filteredProperties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                    <Building className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No properties found</h3>
                    <p className="text-slate-500 mt-2 mb-6 max-w-sm text-center">
                        It looks like your portfolio is empty. Get started by adding a property or seeding sample data.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-aera-600 hover:bg-aera-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Property
                        </button>
                        <button
                            onClick={handleSeedData}
                            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
                        >
                            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                            Seed Sample Data
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                    {filteredProperties.map((property) => (
                        <div key={property.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                            <div className="relative h-48 overflow-hidden shrink-0">
                                <img
                                    src={property.image}
                                    alt={property.name}
                                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute top-4 right-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${property.status === 'Occupied'
                                        ? 'bg-aera-900/90 text-aera-600'
                                        : property.status === 'Vacant'
                                            ? 'bg-red-900/90 text-white'
                                            : 'bg-orange-500/90 text-white'
                                        }`}>
                                        {property.status}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5 space-y-4 flex-1 flex flex-col">
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-aera-900 group-hover:text-aera-600 transition-colors">
                                            {property.name}
                                        </h3>
                                        <button
                                            onClick={(e) => handleDeleteProperty(e, property.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1.5 -mt-1 -mr-2 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                            title="Delete Property"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center text-slate-500 text-sm mt-1 hover:text-aera-600 transition-colors group/map"
                                    >
                                        <MapPin className="w-4 h-4 mr-1 text-aera-600 group-hover/map:animate-bounce" />
                                        <span className="truncate underline decoration-dotted decoration-slate-300 underline-offset-2 group-hover/map:decoration-aera-600">
                                            {property.address}
                                        </span>
                                    </a>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
                                    <div>
                                        <div className="flex items-center text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                                            <Maximize className="w-3 h-3 mr-1" />
                                            Size
                                        </div>
                                        <div className="text-aera-900 font-semibold">
                                            {property.sizeSqFt.toLocaleString()} m²
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                                            <Euro className="w-3 h-3 mr-1" />
                                            Rent
                                        </div>
                                        <div className="text-aera-900 font-semibold">
                                            €{property.rentPerSqFt}/m²
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-aera-50 text-aera-800">
                                        {property.type}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectAsset?.(property.id);
                                            }}
                                            className="text-xs font-medium text-slate-400 hover:text-aera-600 flex items-center transition-colors hover:bg-slate-50 px-2 py-1 rounded"
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            Add Unit
                                        </button>
                                        <button
                                            onClick={() => onSelectAsset?.(property.id)}
                                            className="text-sm font-medium text-aera-600 hover:text-aera-800 hover:underline flex items-center"
                                        >
                                            Details
                                            <ArrowRight className="w-3 h-3 ml-1" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}



            {/* View Property Details Modal */}
            {selectedProperty && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                        {modalView === 'details' && (
                            <>
                                {/* Image Side */}
                                <div className="w-full md:w-1/3 bg-slate-100 relative h-48 md:h-auto">
                                    <img src={selectedProperty.image} alt={selectedProperty.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                                        <div>
                                            <h2 className="text-white font-bold text-2xl">{selectedProperty.name}</h2>
                                            <p className="text-white/80 text-sm flex items-center mt-1">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                {selectedProperty.address}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Side */}
                                <div className="flex-1 p-8 overflow-y-auto">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${selectedProperty.status === 'Occupied'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : selectedProperty.status === 'Vacant'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                }`}>
                                                {selectedProperty.status}
                                            </span>
                                            <h3 className="text-lg font-bold text-aera-900">Property Overview</h3>
                                        </div>
                                        <button onClick={() => setSelectedProperty(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                        {selectedProperty.description || "No description available for this property."}
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="p-4 bg-aera-50 rounded-lg border border-aera-100">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Size</div>
                                            <div className="text-xl font-bold text-aera-900">{selectedProperty.sizeSqFt.toLocaleString()} m²</div>
                                        </div>
                                        <div className="p-4 bg-aera-50 rounded-lg border border-aera-100">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Est. Rent</div>
                                            <div className="text-xl font-bold text-aera-900">€{selectedProperty.rentPerSqFt}/m²</div>
                                        </div>
                                    </div>

                                    {selectedProperty.amenities && selectedProperty.amenities.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="text-sm font-bold text-slate-900 mb-3">Amenities & Features</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {selectedProperty.amenities.map((amenity, i) => (
                                                    <div key={i} className="flex items-center text-sm text-slate-600">
                                                        <CheckCircle2 className="w-4 h-4 text-aera-600 mr-2" />
                                                        {amenity}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-slate-100 flex justify-end space-x-3">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProperty.address)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            View on Maps
                                        </a>
                                        <button
                                            onClick={openManageUnits}
                                            className="px-4 py-2 bg-aera-900 text-white font-medium rounded-lg text-sm hover:bg-aera-800 transition-colors shadow-md"
                                        >
                                            Manage Units ({selectedProperty.units?.length || 0})
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {modalView === 'manage-units' && (
                            <div className="flex-1 flex flex-col h-full min-h-[500px]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => setModalView('details')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <ArrowLeft className="w-5 h-5 text-aera-900" />
                                        </button>
                                        <div>
                                            <h2 className="text-lg font-bold text-aera-900">Manage Units</h2>
                                            <p className="text-xs text-slate-500">{selectedProperty.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => openEditUnit()}
                                            className="flex items-center space-x-1 bg-aera-900 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-aera-800 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Unit</span>
                                        </button>
                                        <button onClick={() => setSelectedProperty(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                                    {!selectedProperty.units || selectedProperty.units.length === 0 ? (
                                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            <Building className="w-12 h-12 mb-3 opacity-20" />
                                            <p>No units added yet.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {selectedProperty.units.map(unit => {
                                                // Find linked tenant
                                                const linkedTenant = tenants.find(t => t.unitId === unit.id);

                                                return (
                                                    <div key={unit.id} className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col hover:border-aera-300 transition-colors overflow-hidden">
                                                        {/* Unit Header */}
                                                        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <div className="h-10 w-10 bg-aera-50 rounded-lg flex items-center justify-center text-aera-800 font-bold border border-aera-100">
                                                                    {unit.unitNumber}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-900 flex items-center">
                                                                        Unit {unit.unitNumber}
                                                                        {unit.floor && <span className="ml-2 text-xs text-slate-400 font-normal">({unit.floor})</span>}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 flex space-x-2 mt-0.5">
                                                                        <span>{unit.sizeSqFt.toLocaleString()} m²</span>
                                                                        <span className="text-slate-300">|</span>
                                                                        <span>€{unit.rentMonthly.toLocaleString()}/mo</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center ${unit.status === 'Occupied' ? 'bg-emerald-100 text-emerald-800' :
                                                                    unit.status === 'Vacant' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-800'
                                                                    }`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${unit.status === 'Occupied' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                                                    {unit.status}
                                                                </span>

                                                                {/* Actions Menu */}
                                                                <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                                                                    <button
                                                                        onClick={() => openHistory(unit)}
                                                                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-aera-600 transition-all"
                                                                        title="Rent History"
                                                                    >
                                                                        <History className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openEditUnit(unit)}
                                                                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-aera-600 transition-all"
                                                                        title="Edit Unit Details"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteUnit(unit.id)}
                                                                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-red-500 transition-all"
                                                                        title="Delete Unit"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Tenant Connection Area */}
                                                        <div className="bg-slate-50/50 p-3 px-4 flex items-center justify-between">
                                                            {linkedTenant ? (
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className="flex items-center space-x-3">
                                                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-aera-900 text-xs font-bold shadow-sm">
                                                                            {linkedTenant.name.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-aera-900">{linkedTenant.name}</div>
                                                                            <div className="flex items-center text-xs text-slate-500 gap-3">
                                                                                <span className="flex items-center"><User className="w-3 h-3 mr-1" /> {linkedTenant.contactName}</span>
                                                                                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> Expires: {linkedTenant.leaseEnd}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleVacateUnit(unit.id)}
                                                                        className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                                                                    >
                                                                        <UserMinus className="w-3 h-3 mr-1.5" />
                                                                        Vacate
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span className="text-sm text-slate-400 italic flex items-center">
                                                                        <User className="w-4 h-4 mr-2 opacity-50" />
                                                                        No tenant assigned
                                                                    </span>
                                                                    <button
                                                                        onClick={() => openAssignModal(unit.id)}
                                                                        className="text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-aera-900 hover:border-aera-600 px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center"
                                                                    >
                                                                        <UserPlus className="w-3 h-3 mr-1.5" />
                                                                        Assign Tenant
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {modalView === 'assign-tenant' && (
                            <div className="flex-1 flex flex-col h-full min-h-[500px]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => setModalView('manage-units')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <ArrowLeft className="w-5 h-5 text-aera-900" />
                                        </button>
                                        <div>
                                            <h2 className="text-lg font-bold text-aera-900">Assign Tenant</h2>
                                            <p className="text-xs text-slate-500">
                                                Select a tenant to move into Unit {selectedProperty.units?.find(u => u.id === assigningUnitId)?.unitNumber}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 p-8 overflow-y-auto">
                                    <div className="max-w-md mx-auto space-y-6">
                                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                                            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                            <div className="text-sm text-blue-800">
                                                Assigning a tenant will automatically update the unit status to <strong>Occupied</strong> and link the tenant's profile to this location.
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Tenant</label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <select
                                                    value={selectedTenantId}
                                                    onChange={(e) => setSelectedTenantId(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 bg-white appearance-none"
                                                >
                                                    <option value="">-- Choose a Tenant --</option>
                                                    {tenants.filter(t => !t.unitId).map(tenant => (
                                                        <option key={tenant.id} value={tenant.id}>
                                                            {tenant.name} ({tenant.contactName})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                </div>
                                            </div>
                                            {tenants.filter(t => !t.unitId).length === 0 && (
                                                <p className="text-xs text-slate-500 mt-2 italic">
                                                    No unassigned tenants available. Go to Tenants tab to create one.
                                                </p>
                                            )}
                                        </div>

                                        {selectedTenantId && (
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Selected Tenant Details</h4>
                                                {(() => {
                                                    const t = tenants.find(t => t.id === selectedTenantId);
                                                    return t ? (
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{t.name}</span></div>
                                                            <div className="flex justify-between"><span className="text-slate-500">Contact:</span> <span className="text-slate-900">{t.contactName}</span></div>
                                                            <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-slate-900">{t.email}</span></div>
                                                            <div className="flex justify-between"><span className="text-slate-500">Current Lease:</span> <span className="text-slate-900">{t.leaseEnd}</span></div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleAssignTenant}
                                            disabled={!selectedTenantId}
                                            className="w-full bg-aera-900 text-white py-3 rounded-lg font-medium hover:bg-aera-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center"
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Confirm Assignment
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {modalView === 'unit-history' && viewingUnitHistory && (
                            <div className="flex-1 flex flex-col h-full min-h-[500px]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => setModalView('manage-units')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <ArrowLeft className="w-5 h-5 text-aera-900" />
                                        </button>
                                        <div>
                                            <h2 className="text-lg font-bold text-aera-900">Rent History</h2>
                                            <p className="text-xs text-slate-500">Unit {viewingUnitHistory.unitNumber} • {viewingUnitHistory.rentHistory?.length || 0} Records</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => alert("Downloading CSV Report...")}
                                        className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Export CSV</span>
                                    </button>
                                </div>

                                <div className="flex-1 p-6 overflow-y-auto">
                                    {/* Summary Card */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Total Collected</div>
                                            <div className="text-2xl font-bold text-emerald-900">
                                                €{viewingUnitHistory.rentHistory?.reduce((sum, p) => p.status === 'Paid' ? sum + p.amount : sum, 0).toLocaleString() || '0'}
                                            </div>
                                        </div>
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Outstanding / Late</div>
                                            <div className="text-2xl font-bold text-amber-900">
                                                €{viewingUnitHistory.rentHistory?.reduce((sum, p) => p.status === 'Late' ? sum + p.amount : sum, 0).toLocaleString() || '0'}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Monthly Rent</div>
                                            <div className="text-2xl font-bold text-slate-700">
                                                €{viewingUnitHistory.rentMonthly.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-slate-200 mb-6 shadow-sm">
                                        <h3 className="text-sm font-bold text-aera-900 mb-4 flex items-center">
                                            <Receipt className="w-4 h-4 mr-2 text-aera-600" />
                                            Log New Payment
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Period</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Oct 2023"
                                                    value={newPayment.period || ''}
                                                    onChange={(e) => setNewPayment(prev => ({ ...prev, period: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600 focus:ring-1 focus:ring-aera-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                                                <input
                                                    type="date"
                                                    value={newPayment.date || ''}
                                                    onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600 focus:ring-1 focus:ring-aera-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Amount (€)</label>
                                                <input
                                                    type="number"
                                                    value={newPayment.amount || ''}
                                                    onChange={(e) => setNewPayment(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-aera-600 focus:ring-1 focus:ring-aera-600"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <button
                                                    onClick={addRentPayment}
                                                    disabled={!newPayment.period || !newPayment.amount}
                                                    className="w-full bg-aera-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-aera-800 transition-colors disabled:opacity-50 shadow-sm"
                                                >
                                                    Log Payment
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                                    <th className="px-4 py-3 font-semibold">Date</th>
                                                    <th className="px-4 py-3 font-semibold">Period</th>
                                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                                    <th className="px-4 py-3 font-semibold">Status</th>
                                                    <th className="px-4 py-3 font-semibold text-center w-20">Invoice</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(!viewingUnitHistory.rentHistory || viewingUnitHistory.rentHistory.length === 0) ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No payment history recorded.</td>
                                                    </tr>
                                                ) : (
                                                    viewingUnitHistory.rentHistory.map(payment => (
                                                        <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 text-slate-900">{payment.date}</td>
                                                            <td className="px-4 py-3 text-slate-600">{payment.period}</td>
                                                            <td className="px-4 py-3 font-medium text-slate-900">€{payment.amount.toLocaleString()}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                                                    payment.status === 'Late' ? 'bg-red-100 text-red-800' :
                                                                        'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                    {payment.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => handleDownloadInvoice(payment)}
                                                                    className="p-2 text-slate-400 hover:text-aera-600 hover:bg-slate-100 rounded-full transition-colors group relative"
                                                                    title="Download Invoice"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">Get PDF</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {modalView === 'edit-unit' && (
                            <div className="flex-1 flex flex-col h-full min-h-[500px]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => setModalView('manage-units')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <ArrowLeft className="w-5 h-5 text-aera-900" />
                                        </button>
                                        <h2 className="text-lg font-bold text-aera-900">
                                            {editingUnit.id ? 'Edit Unit' : 'Add New Unit'}
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex-1 p-8 overflow-y-auto">
                                    <div className="space-y-4 max-w-lg mx-auto">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Number *</label>
                                                <input
                                                    maxLength={10}
                                                    value={editingUnit.unitNumber || ''}
                                                    onChange={(e) => setEditingUnit(prev => ({ ...prev, unitNumber: e.target.value }))}
                                                    placeholder="e.g. 101"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1 text-right">Max 10 chars</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Floor (Optional)</label>
                                                <input
                                                    value={editingUnit.floor || ''}
                                                    onChange={(e) => setEditingUnit(prev => ({ ...prev, floor: e.target.value }))}
                                                    placeholder="e.g. 1st Floor"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select
                                                value={editingUnit.status || 'Vacant'}
                                                onChange={(e) => setEditingUnit(prev => ({ ...prev, status: e.target.value as any }))}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                            >
                                                <option value="Vacant">Vacant</option>
                                                <option value="Occupied">Occupied</option>
                                                <option value="Maintenance">Maintenance</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Size (m²)</label>
                                                <input
                                                    type="number"
                                                    value={editingUnit.sizeSqFt || ''}
                                                    onChange={(e) => setEditingUnit(prev => ({ ...prev, sizeSqFt: Number(e.target.value) }))}
                                                    placeholder="0"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rent (€)</label>
                                                <input
                                                    type="number"
                                                    value={editingUnit.rentMonthly || ''}
                                                    onChange={(e) => setEditingUnit(prev => ({ ...prev, rentMonthly: Number(e.target.value) }))}
                                                    placeholder="0.00"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-6">
                                            <button
                                                onClick={saveUnit}
                                                disabled={!editingUnit.unitNumber || editingUnit.unitNumber.length > 10}
                                                className="w-full bg-aera-900 text-white py-3 rounded-lg font-medium hover:bg-aera-800 transition-colors disabled:opacity-50 flex justify-center items-center"
                                            >
                                                <Save className="w-4 h-4 mr-2" />
                                                Save Unit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Add Property Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-aera-100 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50 shrink-0">
                            <div className="flex items-center space-x-2">
                                <Building className="w-5 h-5 text-aera-900" />
                                <h2 className="text-xl font-bold text-aera-900">Add New Property</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* AI Auto-Fill Section */}
                                <div className="bg-aera-50 p-4 rounded-lg border border-aera-200 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-aera-900 flex items-center">
                                            <Sparkles className="w-3 h-3 mr-1 text-aera-600" />
                                            AI Smart Auto-Fill
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search Google Maps (e.g. 'Salesforce Tower San Francisco')"
                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAutoFill}
                                            disabled={isSearching || !searchQuery}
                                            className="bg-aera-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-800 disabled:opacity-70 transition-colors flex items-center whitespace-nowrap"
                                        >
                                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                            {isSearching ? 'Searching...' : 'Find & Fill'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 flex items-center">
                                        <Info className="w-3 h-3 mr-1" />
                                        <span>Type a place name (e.g. "Salesforce Tower") to auto-fill details below.</span>
                                    </p>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-slate-200" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-xs text-slate-500 uppercase tracking-wider font-semibold">Property Details</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Property Name *</label>
                                        <input
                                            name="name"
                                            required
                                            value={formData.name || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g. AERA Tech Hub"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Address with Google Maps Verification */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    name="address"
                                                    required
                                                    value={formData.address || ''}
                                                    onChange={handleInputChange}
                                                    placeholder="Enter address or place name..."
                                                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddressLookup}
                                                    disabled={isAddressSearching || !formData.address}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-aera-600 disabled:opacity-50"
                                                    title="Search location details"
                                                >
                                                    {isAddressSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddressSearch}
                                                title="Verify on Google Maps"
                                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Type a location name (e.g. "Apple Park") and click the search icon to auto-complete the address.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                        <select
                                            name="type"
                                            value={formData.type}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all"
                                        >
                                            {PROPERTY_TYPES.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all"
                                        >
                                            <option value="Occupied">Occupied</option>
                                            <option value="Vacant">Vacant</option>
                                            <option value="Maintenance">Maintenance</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Size (m²)</label>
                                        <input
                                            name="sizeSqFt"
                                            type="number"
                                            value={formData.sizeSqFt || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Est. Rent (€/m²)</label>
                                        <input
                                            name="rentPerSqFt"
                                            type="number"
                                            value={formData.rentPerSqFt || ''}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                        <textarea
                                            name="description"
                                            value={formData.description || ''}
                                            onChange={handleInputChange}
                                            placeholder="Enter property highlights and details..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all min-h-[80px]"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Amenities (Comma separated)</label>
                                        <input
                                            name="amenities"
                                            value={formData.amenities?.join(', ') || ''}
                                            onChange={handleAmenitiesChange}
                                            placeholder="e.g. Parking, Gym, Security, Balcony"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                                        />
                                    </div>

                                    {/* === VERMIETER SECTION === */}
                                    <div className="col-span-2 border-t border-slate-200 pt-4 mt-2">
                                        <h4 className="text-sm font-bold text-aera-900 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Vermieter
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Name (Firma / Person)</label>
                                                <input
                                                    value={formData.landlord?.name || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, name: e.target.value } }))}
                                                    placeholder="z.B. Müller Immobilien GmbH"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Straße + Nr.</label>
                                                <input
                                                    value={formData.landlord?.address || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, address: e.target.value } }))}
                                                    placeholder="Musterstraße 1"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">PLZ</label>
                                                    <input
                                                        value={formData.landlord?.zipCode || ''}
                                                        onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, zipCode: e.target.value } }))}
                                                        placeholder="10115"
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Ort</label>
                                                    <input
                                                        value={formData.landlord?.city || ''}
                                                        onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, city: e.target.value } }))}
                                                        placeholder="Berlin"
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">E-Mail</label>
                                                <input
                                                    type="email"
                                                    value={formData.landlord?.email || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, email: e.target.value } }))}
                                                    placeholder="vermieter@example.de"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                                                <input
                                                    value={formData.landlord?.phone || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, phone: e.target.value } }))}
                                                    placeholder="+49 30 123456"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* === BANKVERBINDUNG SECTION === */}
                                    <div className="col-span-2 border-t border-slate-200 pt-4 mt-2">
                                        <h4 className="text-sm font-bold text-aera-900 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                            Bankverbindung (Vermieter)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-slate-600 mb-1">IBAN</label>
                                                <input
                                                    value={formData.landlord?.iban || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, iban: e.target.value } }))}
                                                    placeholder="DE89 3704 0044 0532 0130 00"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">BIC (optional)</label>
                                                <input
                                                    value={formData.landlord?.bic || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, bic: e.target.value } }))}
                                                    placeholder="COBADEFFXXX"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Bankname (optional)</label>
                                                <input
                                                    value={formData.landlord?.bankName || ''}
                                                    onChange={(e) => setFormData(p => ({ ...p, landlord: { ...p.landlord!, bankName: e.target.value } }))}
                                                    placeholder="Commerzbank"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (Optional)</label>
                                        <input name="image" onChange={handleInputChange} placeholder="https://..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all" />
                                        <p className="text-[10px] text-slate-400 mt-1">If left blank, a random architecture image will be assigned.</p>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-aera-900 hover:bg-aera-800 rounded-lg transition-colors shadow-sm border border-transparent hover:border-aera-600">
                                        Create Property
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Properties;
