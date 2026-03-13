import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Property } from '../types';
import { useDataCore } from '../core/DataCoreProvider';
import {
    Users, Wrench, Receipt, TrendingUp, Home, MapPin, Tag,
    AlertTriangle, CheckCircle2, ArrowUpRight, Clock, Building2
} from 'lucide-react';

interface AssetOverviewProps {
    property: Property;
}

const AssetOverview: React.FC<AssetOverviewProps> = ({ property }) => {
    const { data } = useDataCore();

    const kpis = useMemo(() => {
        const tenants = data.tenants.filter(t => t.propertyId === property.id);
        const tickets = data.tickets.filter(t => t.propertyId === property.id);
        const invoices = data.invoices.filter(i => i.propertyId === property.id);

        const totalUnits = property.units?.length || 0;
        const occupiedUnits = property.units?.filter(u => u.status === 'Occupied').length || 0;
        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

        const sollMiete = tenants.reduce((s, t) => s + t.monthlyRent, 0);
        const openTickets = tickets.filter(t => t.status !== 'Resolved').length;
        const criticalTickets = tickets.filter(t => t.priority === 'Emergency' && t.status !== 'Resolved').length;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthInvoices = invoices.filter(i => i.period === currentMonth);
        const invoiced = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
        const collected = monthInvoices.reduce((s, i) => s + i.paidAmount, 0);
        const overdue = invoices.filter(i => i.status === 'overdue').length;

        const leasesExpiring = tenants.filter(t => {
            const end = new Date(t.leaseEnd);
            const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            return diff > 0 && diff <= 90;
        }).length;

        return {
            tenantCount: tenants.length,
            totalUnits, occupiedUnits, occupancyRate,
            sollMiete, invoiced, collected,
            openTickets, criticalTickets, overdue,
            leasesExpiring
        };
    }, [data, property]);

    const statusConfig = {
        Occupied: { label: 'Vermietet', bg: 'bg-[#3D7A5A]', text: 'text-white', dot: 'bg-[#8BC9A0]' },
        Vacant: { label: 'Leerstand', bg: 'bg-[#C9883A]', text: 'text-white', dot: 'bg-[#E2C47A]' },
        'Under Maintenance': { label: 'In Sanierung', bg: 'bg-[#C94A3A]', text: 'text-white', dot: 'bg-red-300' },
    };
    const status = statusConfig[property.status as keyof typeof statusConfig] || statusConfig['Occupied'];

    const cards = [
        {
            label: 'Belegung',
            value: `${kpis.occupancyRate}%`,
            sub: `${kpis.occupiedUnits} / ${kpis.totalUnits} Einheiten belegt`,
            icon: Home,
            accent: 'from-forest to-forest-light',
            light: 'bg-cream-dark',
            iconColor: 'text-forest',
            alert: false,
        },
        {
            label: 'Mieter',
            value: String(kpis.tenantCount),
            sub: kpis.leasesExpiring > 0 ? `${kpis.leasesExpiring} Verträge laufen bald aus` : 'Alle Verträge aktiv',
            icon: Users,
            accent: 'from-forest-light to-forest',
            light: 'bg-cream-dark',
            iconColor: 'text-forest',
            alert: kpis.leasesExpiring > 0,
        },
        {
            label: 'Soll-Miete',
            value: `€${kpis.sollMiete.toLocaleString('de-DE')}`,
            sub: `Ist: €${kpis.collected.toLocaleString('de-DE')} eingegangen`,
            icon: TrendingUp,
            accent: 'from-gold to-gold-light',
            light: 'bg-cream-dark',
            iconColor: 'text-gold-dark',
            alert: false,
        },
        {
            label: 'Offene Tickets',
            value: String(kpis.openTickets),
            sub: kpis.criticalTickets > 0 ? `${kpis.criticalTickets} kritisch` : 'Keine dringenden Fälle',
            icon: Wrench,
            accent: kpis.criticalTickets > 0 ? 'from-[#C94A3A] to-red-400' : 'from-cream-deeper to-cream-dark',
            light: kpis.criticalTickets > 0 ? 'bg-red-50' : 'bg-cream-dark',
            iconColor: kpis.criticalTickets > 0 ? 'text-[#C94A3A]' : 'text-[#7A9589]',
            alert: kpis.criticalTickets > 0,
        },
        {
            label: 'Rechnungen (Monat)',
            value: `€${kpis.invoiced.toLocaleString('de-DE')}`,
            sub: kpis.overdue > 0 ? `${kpis.overdue} überfällig` : 'Alles im grünen Bereich',
            icon: Receipt,
            accent: 'from-gold-dark to-gold',
            light: 'bg-cream-dark',
            iconColor: 'text-gold-dark',
            alert: kpis.overdue > 0,
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-8">

            {/* ── Hero Banner ── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="relative h-52 rounded-2xl overflow-hidden shadow-lg group"
            >
                {/* Property image */}
                <img
                    src={property.image}
                    alt={property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />

                {/* Status pill */}
                <div className="absolute top-4 right-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text} shadow-lg`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
                        {status.label}
                    </span>
                </div>

                {/* Property name + address pinned to bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-6 py-4">
                    <h1 className="text-2xl font-bold text-white leading-tight tracking-tight drop-shadow-sm">
                        {property.name}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-white/70 shrink-0" />
                        <p className="text-sm text-white/75">{property.address}</p>
                    </div>
                    {property.type && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <Tag className="w-3 h-3 text-white/50" />
                            <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{property.type}</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {cards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                        className="bg-white rounded-2xl border border-cream-deeper p-4 shadow-soft hover:shadow-medium transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden"
                    >
                        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.accent}`} />

                        <div className="flex items-start justify-between mb-3">
                            <div className={`p-2 rounded-xl ${card.light}`}>
                                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                            </div>
                            {card.alert && (
                                <AlertTriangle className="w-3.5 h-3.5 text-[#C9883A] mt-0.5" />
                            )}
                        </div>
                        <p className="text-xs font-semibold text-[#7A9589] uppercase tracking-wider mb-1">{card.label}</p>
                        <div className="text-2xl font-bold text-[#1A2E25] leading-none" style={{ fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{card.value}</div>
                        <p className="text-xs text-[#7A9589] mt-1.5 leading-snug">{card.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Description + Landlord side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {property.description && (
                    <div className="bg-white rounded-2xl border border-cream-deeper p-5 shadow-soft">
                        <h3 className="text-sm font-bold text-[#1A2E25] mb-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-forest" />
                            Objektbeschreibung
                        </h3>
                        <p className="text-sm text-[#4A6358] leading-relaxed">{property.description}</p>
                    </div>
                )}

                {property.landlord?.name && (
                    <div className="bg-white rounded-2xl border border-cream-deeper p-5 shadow-soft">
                        <h3 className="text-sm font-bold text-[#1A2E25] mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-forest" />
                            Vermieter / Eigentümer
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[#7A9589]">Name</span>
                                <span className="font-semibold text-[#1A2E25]">{property.landlord.name}</span>
                            </div>
                            {property.landlord.address && (
                                <div className="flex justify-between">
                                    <span className="text-[#7A9589]">Adresse</span>
                                    <span className="text-[#4A6358] text-right">{property.landlord.address}, {property.landlord.zipCode} {property.landlord.city}</span>
                                </div>
                            )}
                            {property.landlord.email && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[#7A9589]">E-Mail</span>
                                    <a href={`mailto:${property.landlord.email}`} className="text-forest hover:text-forest-dark underline decoration-dotted flex items-center gap-1">
                                        {property.landlord.email}
                                        <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                            {property.landlord.iban && (
                                <div className="flex justify-between">
                                    <span className="text-[#7A9589]">IBAN</span>
                                    <span className="text-xs text-[#1A2E25] bg-cream-dark px-2 py-0.5 rounded-lg" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{property.landlord.iban}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Amenities ── */}
            {property.amenities && property.amenities.length > 0 && (
                <div className="bg-white rounded-2xl border border-cream-deeper p-5 shadow-soft">
                    <h3 className="text-sm font-bold text-[#1A2E25] mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#3D7A5A]" />
                        Ausstattungsmerkmale
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {property.amenities.map((a, i) => (
                            <span key={i} className="px-3 py-1 bg-cream-dark text-[#4A6358] rounded-full text-xs font-semibold hover:bg-gold/10 hover:text-gold-dark transition-colors border border-cream-deeper">
                                {a}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetOverview;
