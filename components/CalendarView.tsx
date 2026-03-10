
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Coins, FileText, Wrench, X, Clock, Plus, Save, Calendar as CalendarIcon, User, Building2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { MaintenanceTicket, Tenant } from '../types';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';

interface CalendarEvent {
    id: string;
    dateStr: string; // YYYY-MM-DD
    title: string;
    type: 'Rent' | 'Lease' | 'Maintenance';
    description?: string;
    meta?: any;
}

const CalendarView: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // === DATA CORE ===
    const { data, dispatch } = useDataCore();
    const { t } = useTranslation();
    const tickets = propertyId ? data.tickets.filter(t => t.propertyId === propertyId) : data.tickets;
    const tenants = propertyId ? data.tenants.filter(t => t.propertyId === propertyId) : data.tenants;

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTicket, setNewTicket] = useState<{
        title: string;
        description: string;
        tenantId: string;
        priority: 'Low' | 'Medium' | 'High' | 'Emergency';
        date: string;
    }>({
        title: '',
        description: '',
        tenantId: '',
        priority: 'Medium',
        date: new Date().toISOString().split('T')[0]
    });

    // Constants
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Helper Functions
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const formatDate = (year: number, month: number, day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    const openAddTicketModal = () => {
        setNewTicket({
            title: '',
            description: '',
            tenantId: '',
            priority: 'Medium',
            date: selectedDate || new Date().toISOString().split('T')[0]
        });
        setIsAddModalOpen(true);
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicket.tenantId || !newTicket.title) return;

        const tenant = tenants.find(t => t.id === newTicket.tenantId);
        const ticketData: Omit<MaintenanceTicket, "id"> = {
            tenantId: newTicket.tenantId,
            propertyId: tenant?.propertyId || 'unknown',
            title: newTicket.title,
            description: newTicket.description,
            priority: newTicket.priority,
            status: 'Open',
            dateCreated: newTicket.date
        };

        await dispatch({ type: 'ticket:add', payload: ticketData });
        setIsAddModalOpen(false);
    };

    // Data Aggregation
    const events = useMemo(() => {
        const allEvents: CalendarEvent[] = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-indexed

        // 1. Rent Due Dates (Generate for current month)
        // Assuming Rent is due on the 1st of the month for all tenants
        const rentDueDateStr = formatDate(year, month, 1);
        tenants.forEach(tenant => {
            allEvents.push({
                id: `rent-${tenant.id}-${month}`,
                dateStr: rentDueDateStr,
                title: `Rent Due: ${tenant.name}`,
                type: 'Rent',
                description: `Monthly rent of €${tenant.monthlyRent.toLocaleString()}`,
                meta: { amount: tenant.monthlyRent, status: tenant.status }
            });
        });

        // 2. Lease Expirations (Or Starts)
        tenants.forEach(tenant => {
            if (tenant.leaseEnd) {
                // Only add if it falls in relevant range or if we want to show all (filtering happens later)
                allEvents.push({
                    id: `lease-end-${tenant.id}`,
                    dateStr: tenant.leaseEnd,
                    title: `Lease Expires: ${tenant.name}`,
                    type: 'Lease',
                    description: `Contract ending. Review required.`
                });
            }
            if (tenant.leaseStart) {
                allEvents.push({
                    id: `lease-start-${tenant.id}`,
                    dateStr: tenant.leaseStart,
                    title: `Lease Start: ${tenant.name}`,
                    type: 'Lease',
                    description: `Contract start date.`
                });
            }
        });

        // 3. Maintenance Tickets (Using local state)
        tickets.forEach(ticket => {
            if (ticket.dateCreated) {
                allEvents.push({
                    id: ticket.id,
                    dateStr: ticket.dateCreated,
                    title: `Maint: ${ticket.title}`,
                    type: 'Maintenance',
                    description: `Priority: ${ticket.priority} | Status: ${ticket.status}. ${ticket.description}`,
                    meta: { priority: ticket.priority, status: ticket.status }
                });
            }
        });

        return allEvents;
    }, [currentDate, tickets, tenants]);

    // Calendar Grid Generation
    const daysInMonth = getDaysInMonth(currentDate);
    const startDay = getFirstDayOfMonth(currentDate);

    const calendarDays = [];
    // Empty slots for previous month
    for (let i = 0; i < startDay; i++) {
        calendarDays.push(null);
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

    const getEventsForDay = (day: number) => {
        const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
        return events.filter(e => e.dateStr === dateStr);
    };

    const selectedEvents = selectedDate ? events.filter(e => e.dateStr === selectedDate) : [];

    return (
        <div className="h-[calc(100vh-2rem)] flex gap-6 animate-in fade-in duration-500">

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-aera-900">{t('calendar.title')}</h1>
                        <p className="text-slate-500 mt-1">Track payments, lease events, and maintenance schedules.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-aera-600 hover:text-aera-800 mr-2">
                            Today
                        </button>
                        <div className="flex items-center bg-aera-50 rounded-lg border border-slate-200 p-1">
                            <button onClick={prevMonth} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-slate-600">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="w-32 text-center font-bold text-aera-900 select-none">
                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </span>
                            <button onClick={nextMonth} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-slate-600">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid Header */}
                <div className="grid grid-cols-7 border-b border-slate-100 bg-aera-50/50">
                    {daysOfWeek.map(day => (
                        <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid Body */}
                <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-slate-50 gap-px border-b border-slate-200">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="bg-white min-h-[100px]" />;
                        }

                        const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dayEvents = getEventsForDay(day);
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                        const isSelected = selectedDate === dateStr;

                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedDate(dateStr)}
                                className={`bg-white min-h-[100px] p-2 relative cursor-pointer hover:bg-aera-50/30 transition-colors group ${isSelected ? 'ring-2 ring-inset ring-aera-600 z-10' : ''
                                    }`}
                            >
                                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-aera-900 text-white shadow-md' : 'text-slate-700'
                                    }`}>
                                    {day}
                                </span>

                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((evt, i) => (
                                        <div
                                            key={i}
                                            className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2 ${evt.type === 'Rent' ? 'bg-emerald-50 text-emerald-700 border-emerald-500' :
                                                evt.type === 'Lease' ? 'bg-indigo-50 text-indigo-700 border-indigo-500' :
                                                    'bg-amber-50 text-amber-700 border-amber-500'
                                                }`}
                                        >
                                            {evt.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[10px] text-slate-400 pl-1">
                                            + {dayEvents.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Side Panel Details */}
            <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-aera-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-aera-900">
                            {selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select Date'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {selectedEvents.length} Events
                        </p>
                    </div>
                    <button
                        onClick={openAddTicketModal}
                        className="p-2 bg-aera-900 text-white rounded-lg hover:bg-aera-800 transition-colors shadow-sm"
                        title="Add Maintenance Ticket"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedDate ? (
                        selectedEvents.length > 0 ? (
                            selectedEvents.map(evt => (
                                <div key={evt.id} className="p-3 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow bg-white">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${evt.type === 'Rent' ? 'bg-emerald-100 text-emerald-800' :
                                            evt.type === 'Lease' ? 'bg-indigo-100 text-indigo-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                            {evt.type}
                                        </span>
                                        {evt.type === 'Maintenance' && (
                                            <span className="text-[10px] text-slate-400">
                                                {evt.meta?.priority}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-800 mb-1 leading-tight">{evt.title}</h3>
                                    <p className="text-xs text-slate-500 mb-2">{evt.description}</p>

                                    <div className="flex items-center text-xs text-slate-400 pt-2 border-t border-slate-50">
                                        {evt.type === 'Rent' && <Coins className="w-3 h-3 mr-1" />}
                                        {evt.type === 'Lease' && <FileText className="w-3 h-3 mr-1" />}
                                        {evt.type === 'Maintenance' && <Wrench className="w-3 h-3 mr-1" />}
                                        <span>
                                            {evt.type === 'Rent' ? 'Automatic Reminder' :
                                                evt.type === 'Lease' ? 'Contract Event' :
                                                    'Ticket #' + evt.id}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-400">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Clock className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-sm">No events scheduled.</p>
                            </div>
                        )
                    ) : (
                        <div className="text-center py-10 text-slate-400">
                            <p className="text-sm">Click on a calendar day to view details or add a ticket.</p>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Legend</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center text-xs text-slate-600">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" /> Rent
                        </div>
                        <div className="flex items-center text-xs text-slate-600">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2" /> Lease
                        </div>
                        <div className="flex items-center text-xs text-slate-600">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" /> Maintenance
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Ticket Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-aera-900 flex items-center">
                                <Wrench className="w-5 h-5 mr-2 text-aera-600" />
                                Add Maintenance Ticket
                            </h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        required
                                        value={newTicket.date}
                                        onChange={(e) => setNewTicket({ ...newTicket, date: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tenant</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        required
                                        value={newTicket.tenantId}
                                        onChange={(e) => setNewTicket({ ...newTicket, tenantId: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                    >
                                        <option value="">Select Tenant...</option>
                                        {tenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Title</label>
                                <input
                                    required
                                    placeholder="e.g. Broken AC in Lobby"
                                    value={newTicket.title}
                                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                <select
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Emergency">Emergency</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Detailed description of the issue..."
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none resize-none"
                                />
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-aera-900 hover:bg-aera-800 rounded-lg transition-colors shadow-sm flex items-center"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Create Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;
