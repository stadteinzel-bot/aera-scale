
import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceTicket, Tenant, Property, Message } from '../types';
import { CreditCard, History, Plus, AlertCircle, FileText, Download, MessageCircle, Send, Sparkles, Home, LogOut, CheckCircle2, ChevronRight, Bell, DollarSign, Calendar, FolderOpen, File } from 'lucide-react';
import { getTenantAssistantResponse } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { dataService } from '../services/dataService';

const TenantPortal: React.FC = () => {
    // Loaded State
    const [user, setUser] = useState<Tenant | null>(null);
    const [property, setProperty] = useState<Property | null>(null);
    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'maintenance' | 'documents'>('overview');

    // Maintenance State
    const [myTickets, setMyTickets] = useState<MaintenanceTicket[]>([]);
    const [newTicketTitle, setNewTicketTitle] = useState('');
    const [newTicketDesc, setNewTicketDesc] = useState('');
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Payment State
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [paymentStep, setPaymentStep] = useState(1);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [tenantsData, ticketsData, msgsData, propsData] = await Promise.all([
                dataService.getTenants(),
                dataService.getTickets(),
                dataService.getMessages(),
                dataService.getProperties()
            ]);
            // Simulate logged-in user: first tenant
            const firstTenant = tenantsData[0];
            if (firstTenant) {
                setUser(firstTenant);
                setProperty(propsData.find(p => p.id === firstTenant.propertyId) || null);
                setMyTickets(ticketsData.filter(t => t.tenantId === firstTenant.id));
            }
            setAllMessages(msgsData);
            setIsLoading(false);
        };
        loadData();
    }, []);
    // --- Handlers ---

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const ticketData: Omit<MaintenanceTicket, 'id'> = {
            tenantId: user.id,
            propertyId: user.propertyId,
            title: newTicketTitle,
            description: newTicketDesc,
            priority: 'Medium',
            status: 'Open',
            dateCreated: new Date().toISOString().split('T')[0]
        };
        try {
            const saved = await dataService.addTicket(ticketData);
            setMyTickets([saved, ...myTickets]);
            setIsTicketModalOpen(false);
            setNewTicketTitle('');
            setNewTicketDesc('');
        } catch (error: any) {
            alert(`Failed to create ticket: ${error.message}`);
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        const newHistory = [...chatHistory, { role: 'user' as const, parts: [{ text: userMsg }] }];
        setChatHistory(newHistory);
        setChatInput('');
        setIsTyping(true);

        const responseText = await getTenantAssistantResponse(newHistory, userMsg);

        setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: responseText }] }]);
        setIsTyping(false);
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isChatOpen]);

    const handlePayRent = () => {
        setPaymentStep(2);
        setTimeout(() => {
            setPaymentStep(3);
            setTimeout(() => {
                setIsPayModalOpen(false);
                setPaymentStep(1);
                alert("Payment Successful! Receipt emailed.");
            }, 2000);
        }, 2000);
    };

    const handleDownloadDocument = (docName: string, content?: string) => {
        const text = content || `Sample content for ${docName}...`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${docName.replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Render Sections ---

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rent Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">Current</span>
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Next Payment Due</p>
                        <h3 className="text-3xl font-bold text-slate-900 mt-1">€{user.monthlyRent.toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 mt-2 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            Due: Nov 1, 2023
                        </p>
                        <button
                            onClick={() => setIsPayModalOpen(true)}
                            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Pay Now
                        </button>
                    </div>
                </div>

                {/* Maintenance Summary */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <span className="text-2xl font-bold text-slate-900">{myTickets.filter(t => t.status !== 'Resolved').length}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Active Requests</h3>
                        <p className="text-sm text-slate-500 mt-1">Maintenance tickets in progress</p>

                        <button
                            onClick={() => setActiveTab('maintenance')}
                            className="mt-8 text-sm text-amber-700 font-medium hover:underline flex items-center"
                        >
                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                </div>

                {/* Lease Status */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-800">
                                <FileText className="w-6 h-6" />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Lease Status</h3>
                        <p className="text-sm text-slate-500 mt-1">Active - Good Standing</p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 mb-2 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full w-[35%]"></div>
                        </div>
                        <p className="text-xs text-slate-400">Expires: {user.leaseEnd}</p>
                    </div>
                </div>
            </div>

            {/* Recent Announcements */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                    <Bell className="w-4 h-4 mr-2 text-aera-600" />
                    Community Updates
                </h3>
                <div className="space-y-4">
                    {allMessages.filter(m => m.receiverId === 'all').slice(0, 2).map(msg => (
                        <div key={msg.id} className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="bg-white p-2 rounded-full h-fit border border-slate-100">
                                <Sparkles className="w-4 h-4 text-aera-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-800 font-medium">{msg.content}</p>
                                <span className="text-xs text-slate-400 mt-1 block">{msg.timestamp}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderPayments = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-900 rounded-xl p-8 text-white flex justify-between items-center shadow-lg">
                <div>
                    <p className="text-emerald-200 text-sm font-medium mb-1">Total Balance Due</p>
                    <h2 className="text-4xl font-bold">€{user.monthlyRent.toLocaleString()}</h2>
                    <p className="text-xs text-emerald-300/80 mt-2">Invoice #INV-2023-11-001</p>
                </div>
                <button
                    onClick={() => setIsPayModalOpen(true)}
                    className="bg-white text-emerald-900 px-6 py-3 rounded-lg font-bold hover:bg-emerald-50 transition-colors shadow-md"
                >
                    Make Payment
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 flex items-center">
                        <History className="w-4 h-4 mr-2 text-slate-400" />
                        Payment History
                    </h3>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Description</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Amount</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                            <th className="px-6 py-3 font-medium text-slate-500 text-right">Receipt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-600">Oct 01, 2023</td>
                            <td className="px-6 py-4 text-slate-900 font-medium">Rent - October 2023</td>
                            <td className="px-6 py-4 text-slate-600">€{user.monthlyRent.toLocaleString()}</td>
                            <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium">Paid</span></td>
                            <td className="px-6 py-4 text-right"><button className="text-aera-600 hover:underline">Download</button></td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-600">Sep 01, 2023</td>
                            <td className="px-6 py-4 text-slate-900 font-medium">Rent - September 2023</td>
                            <td className="px-6 py-4 text-slate-600">€{user.monthlyRent.toLocaleString()}</td>
                            <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium">Paid</span></td>
                            <td className="px-6 py-4 text-right"><button className="text-aera-600 hover:underline">Download</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMaintenance = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Support Tickets</h2>
                <button
                    onClick={() => setIsTicketModalOpen(true)}
                    className="bg-aera-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-800 transition-colors flex items-center"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Report Issue
                </button>
            </div>

            <div className="space-y-4">
                {myTickets.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <h3 className="text-slate-900 font-medium">All Systems Go</h3>
                        <p className="text-slate-500 text-sm">You have no open maintenance requests.</p>
                    </div>
                ) : (
                    myTickets.map(ticket => (
                        <div key={ticket.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-aera-300 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg shrink-0 ${ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' :
                                    ticket.priority === 'Emergency' ? 'bg-red-50 text-red-600' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                    <WrenchIcon status={ticket.status} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{ticket.title}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-1">{ticket.description}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs">
                                        <span className="text-slate-400">ID: {ticket.id}</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-400">{ticket.dateCreated}</span>
                                    </div>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${ticket.status === 'Open' ? 'bg-red-50 text-red-700 border-red-100' :
                                ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                {ticket.status}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderDocuments = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: List of Documents */}
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                            <FolderOpen className="w-4 h-4 mr-2 text-aera-600" />
                            My Documents
                        </h3>
                        <div className="space-y-2">
                            <button className="w-full flex items-center justify-between p-3 bg-aera-50 border border-aera-200 rounded-lg text-sm text-aera-900 font-medium">
                                <div className="flex items-center">
                                    <FileText className="w-4 h-4 mr-3 text-aera-600" />
                                    Lease Agreement
                                </div>
                                <ChevronRight className="w-4 h-4 text-aera-400" />
                            </button>
                            {['Building Rules & Regulations', 'Insurance Certificate', 'Fire Safety Protocol'].map((doc, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleDownloadDocument(doc)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-sm text-slate-600 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <File className="w-4 h-4 mr-3 text-slate-400" />
                                        {doc}
                                    </div>
                                    <Download className="w-4 h-4 text-slate-300 hover:text-aera-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-900">Lease Agreement</h3>
                            <p className="text-xs text-slate-500">Signed on {user.leaseStart}</p>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handleDownloadDocument('Lease_Agreement', user.leaseContent || 'Lease agreement content...')}
                                className="text-xs bg-white border border-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                Download
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto bg-slate-50/30">
                        <div className="bg-white shadow-sm border border-slate-200 p-8 min-h-full text-slate-800 text-sm leading-relaxed font-serif">
                            <h1 className="text-center font-bold text-xl mb-8">COMMERCIAL LEASE AGREEMENT</h1>
                            <p className="mb-4">This Lease Agreement is made and entered into by and between <strong>AREA SCALE Business Parks</strong> ("Landlord") and <strong>{user.name}</strong> ("Tenant").</p>

                            <h4 className="font-bold uppercase text-xs mb-2 mt-6">1. Premises</h4>
                            <p className="mb-4">Landlord hereby leases to Tenant the premises located at {property?.address}, Unit 101.</p>

                            <h4 className="font-bold uppercase text-xs mb-2 mt-6">2. Term</h4>
                            <p className="mb-4">The term of this Lease shall commence on {user.leaseStart} and expire on {user.leaseEnd}.</p>

                            <h4 className="font-bold uppercase text-xs mb-2 mt-6">3. Rent</h4>
                            <p className="mb-4">Tenant agrees to pay Landlord base rent in the amount of €{user.monthlyRent.toLocaleString()} per month.</p>

                            <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between">
                                <div>
                                    <div className="h-10 border-b border-slate-900 w-48 mb-2"></div>
                                    <p className="text-xs uppercase">Landlord Signature</p>
                                </div>
                                <div>
                                    <div className="h-10 border-b border-slate-900 w-48 mb-2"></div>
                                    <p className="text-xs uppercase">Tenant Signature</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isLoading || !user) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-aera-200 border-t-aera-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 min-h-screen font-sans text-slate-900 flex flex-col">
            {/* Top Navigation */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-aera-900 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <span className="font-bold text-lg tracking-tight">AREA SCALE Tenant Portal</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-medium">Demo: {user.name}</span>
                </div>
                <div className="flex items-center gap-6">
                    <nav className="flex space-x-1">
                        {[
                            { id: 'overview', label: 'Overview', icon: Home },
                            { id: 'payments', label: 'Payments', icon: CreditCard },
                            { id: 'maintenance', label: 'Support', icon: AlertCircle },
                            { id: 'documents', label: 'Documents', icon: FileText },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === item.id
                                    ? 'bg-aera-50 text-aera-900'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                            >
                                <item.icon className="w-4 h-4 mr-2" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                            {user.name.substring(0, 2).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto w-full p-8 flex-1">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'payments' && renderPayments()}
                {activeTab === 'maintenance' && renderMaintenance()}
                {activeTab === 'documents' && renderDocuments()}
            </div>

            {/* AI Assistant FAB */}
            <div className="fixed bottom-8 right-8 z-30">
                {!isChatOpen && (
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="bg-aera-900 hover:bg-aera-800 text-white rounded-full p-4 shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-2"
                    >
                        <Sparkles className="w-5 h-5" />
                        <span className="font-medium pr-1">Ask Assistant</span>
                    </button>
                )}

                {isChatOpen && (
                    <div className="bg-white w-96 h-[500px] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className="bg-aera-900 p-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-aera-400" />
                                <span className="font-bold text-sm">Lease Assistant</span>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/10 rounded p-1 transition-colors">
                                <LogOut className="w-4 h-4 rotate-180" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-none text-sm shadow-sm max-w-[85%]">
                                    Hello! I'm your AI Lease Assistant. Ask me about your rent, building policies, or lease terms.
                                </div>
                            </div>
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] ${msg.role === 'user'
                                        ? 'bg-aera-600 text-white rounded-tr-none'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                        }`}>
                                        <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                            <input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Ask a question..."
                                className="flex-1 bg-slate-100 border-none rounded-full px-4 text-sm focus:ring-2 focus:ring-aera-600 outline-none"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isTyping}
                                className="bg-aera-900 text-white p-2 rounded-full hover:bg-aera-800 disabled:opacity-50 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Maintenance Request Modal */}
            {isTicketModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Report an Issue</h2>
                        <form onSubmit={handleCreateTicket} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Title</label>
                                <input
                                    required
                                    value={newTicketTitle}
                                    onChange={(e) => setNewTicketTitle(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-aera-600"
                                    placeholder="e.g. Light bulb out"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newTicketDesc}
                                    onChange={(e) => setNewTicketDesc(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-aera-600 resize-none"
                                    placeholder="Details about location and problem..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsTicketModalOpen(false)} className="text-slate-500 font-medium hover:text-slate-800">Cancel</button>
                                <button type="submit" className="bg-aera-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-aera-800">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Fake Payment Modal */}
            {isPayModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
                        {paymentStep === 1 && (
                            <>
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CreditCard className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Confirm Payment</h2>
                                <p className="text-slate-500 mb-6">Pay <span className="font-bold text-slate-900">€{user.monthlyRent.toLocaleString()}</span> for Nov 2023 Rent?</p>

                                <div className="bg-slate-50 p-4 rounded-lg text-left mb-6 border border-slate-100">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-500">Payment Method</span>
                                        <span className="font-medium">VISA •••• 4242</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Processing Fee</span>
                                        <span className="font-medium">€0.00</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setIsPayModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-lg font-medium hover:bg-slate-50">Cancel</button>
                                    <button onClick={handlePayRent} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg">Confirm Pay</button>
                                </div>
                            </>
                        )}
                        {paymentStep === 2 && (
                            <div className="py-8">
                                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="font-medium text-slate-900">Processing Secure Payment...</p>
                            </div>
                        )}
                        {paymentStep === 3 && (
                            <div className="py-4 animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
                                <p className="text-slate-500">Transaction ID: #TRX-882910</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Icon
const WrenchIcon = ({ status }: { status: string }) => {
    return <WrenchIconSVG className="w-5 h-5" />;
};
const WrenchIconSVG = (props: any) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        {...props}
    >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
);

export default TenantPortal;
