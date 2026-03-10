
import React, { useState, useRef } from 'react';
import { MaintenanceTicket, Tenant, Property } from '../types';
import { AlertCircle, Clock, CheckCircle2, MessageSquare, Sparkles, Send, Scale, ShieldCheck, AlertTriangle, Plus, X, Calendar, Building2, User, Camera, Loader2, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { draftMaintenanceResponse, determineMaintenanceLiability, LiabilityResult, analyzeMaintenanceImage } from '../services/geminiService';
import { dataService } from '../services/dataService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';

const Maintenance: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
   // === DATA CORE ===
   const { data, dispatch } = useDataCore();
   const { t } = useTranslation();
   const tickets = propertyId ? data.tickets.filter(t => t.propertyId === propertyId) : data.tickets;
   const tenants = propertyId ? data.tenants.filter(t => t.propertyId === propertyId) : data.tenants;
   const properties = data.properties;

   // Selection & UI State
   const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

   // AI Feature State
   const [draftResponse, setDraftResponse] = useState('');
   const [isDrafting, setIsDrafting] = useState(false);
   const [tone, setTone] = useState<'Professional' | 'Empathetic' | 'Firm'>('Professional');
   const [liabilityAnalysis, setLiabilityAnalysis] = useState<LiabilityResult | null>(null);
   const [isAnalyzingLiability, setIsAnalyzingLiability] = useState(false);

   // New Ticket State
   const [newTicketData, setNewTicketData] = useState<Partial<MaintenanceTicket>>({
      priority: 'Medium',
      title: '',
      description: ''
   });

   // Image Upload State
   const [uploadedImage, setUploadedImage] = useState<string | null>(null);
   const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
   const [isAiPopulated, setIsAiPopulated] = useState(false);
   const [isDragging, setIsDragging] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const getPriorityColor = (priority: string) => {
      switch (priority) {
         case 'Emergency': return 'text-red-600 bg-red-50 border-red-100';
         case 'High': return 'text-orange-600 bg-orange-50 border-orange-100';
         case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
         default: return 'text-aera-600 bg-aera-50 border-aera-100';
      }
   };

   const handleTicketSelect = (ticket: MaintenanceTicket) => {
      setSelectedTicket(ticket);
      setDraftResponse('');
      setLiabilityAnalysis(null);
   };

   const handleDraftResponse = async () => {
      if (!selectedTicket) return;
      setIsDrafting(true);
      const draft = await draftMaintenanceResponse(
         `Issue: ${selectedTicket.title}. Description: ${selectedTicket.description}. Priority: ${selectedTicket.priority}`,
         tone
      );
      setDraftResponse(draft);
      setIsDrafting(false);
   };

   const handleCheckLiability = async () => {
      if (!selectedTicket) return;
      setIsAnalyzingLiability(true);
      const result = await determineMaintenanceLiability(selectedTicket.title, selectedTicket.description);
      setLiabilityAnalysis(result);
      setIsAnalyzingLiability(false);
   };

   const processFile = async (file: File) => {
      if (!file.type.startsWith('image/')) {
         alert('Please upload an image file.');
         return;
      }

      setIsAnalyzingImage(true);
      setIsAiPopulated(false);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
         const base64String = reader.result as string;
         setUploadedImage(base64String);

         // Extract pure base64 for API
         const base64Data = base64String.split(',')[1];

         const analysis = await analyzeMaintenanceImage(base64Data, file.type);

         if (analysis) {
            setNewTicketData(prev => ({
               ...prev,
               title: analysis.title,
               description: analysis.description,
               priority: analysis.priority
            }));
            setIsAiPopulated(true);
            setTimeout(() => setIsAiPopulated(false), 3000); // Hide success toast after 3s
         }
         setIsAnalyzingImage(false);
      };
   };

   const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         processFile(e.target.files[0]);
      }
   };

   // Drag & Drop Handlers
   const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
   };

   const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
   };

   const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
         processFile(e.dataTransfer.files[0]);
      }
   };

   const handleRemoveImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setUploadedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
   };

   const resetForm = () => {
      setIsCreateModalOpen(false);
      setNewTicketData({ priority: 'Medium', title: '', description: '' });
      setUploadedImage(null);
      setIsAnalyzingImage(false);
      setIsAiPopulated(false);
   };

   const handleStatusChange = async (newStatus: 'Open' | 'In Progress' | 'Resolved') => {
      if (!selectedTicket) return;
      try {
         await dispatch({ type: 'ticket:update', id: selectedTicket.id, payload: { status: newStatus } });
         setSelectedTicket({ ...selectedTicket, status: newStatus });
      } catch (error: any) {
         alert(`Failed to update status: ${error.message}`);
      }
   };

   const handleSendDraftToTenant = async () => {
      if (!selectedTicket || !draftResponse.trim()) return;
      const msgData: Omit<import('../types').Message, 'id'> = {
         senderId: 'admin',
         receiverId: selectedTicket.tenantId,
         content: draftResponse,
         timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
         isRead: false,
         isAdmin: true
      };
      try {
         await dataService.addMessage(msgData);
         alert('Nachricht an Mieter gesendet!');
         setDraftResponse('');
      } catch (error: any) {
         alert(`Failed to send message: ${error.message}`);
      }
   };

   const handleCreateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTicketData.tenantId || !newTicketData.title || !newTicketData.description) return;

      const tenant = tenants.find(t => t.id === newTicketData.tenantId);
      const propertyId = tenant ? tenant.propertyId : (properties[0]?.id || '');

      const ticketData: Omit<MaintenanceTicket, 'id'> = {
         tenantId: newTicketData.tenantId,
         propertyId: propertyId,
         title: newTicketData.title,
         description: newTicketData.description,
         priority: (newTicketData.priority as any) || 'Medium',
         status: 'Open',
         dateCreated: new Date().toISOString().split('T')[0]
      };

      try {
         await dispatch({ type: 'ticket:add', payload: ticketData });
         resetForm();
      } catch (error: any) {
         alert(`Failed to create ticket: ${error.message}`);
      }
   };

   const renderStatusTracker = (status: string) => {
      const steps = ['Open', 'In Progress', 'Resolved'];
      const currentIdx = steps.indexOf(status);

      return (
         <div className="flex items-center justify-between w-full mb-8 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 transform -translate-y-1/2"></div>
            <div
               className="absolute top-1/2 left-0 h-0.5 bg-aera-600 -z-10 transform -translate-y-1/2 transition-all duration-500"
               style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, idx) => {
               const isCompleted = idx <= currentIdx;
               const isCurrent = idx === currentIdx;
               return (
                  <div key={step} className="flex flex-col items-center bg-white px-2">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${isCompleted ? 'bg-aera-600 border-aera-600 text-white' : 'bg-white border-slate-200 text-slate-300'
                        }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />}
                     </div>
                     <span className={`text-xs mt-2 font-medium ${isCurrent ? 'text-aera-900' : 'text-slate-400'}`}>
                        {step}
                     </span>
                  </div>
               );
            })}
         </div>
      );
   };

   return (
      <div className="h-[calc(100vh-2rem)] flex gap-6 animate-in fade-in duration-500">
         {/* Ticket List Column */}
         <div className="flex-1 flex flex-col min-w-0">
            <div className="mb-6 flex justify-between items-end">
               <div>
                  <h1 className="text-2xl font-bold text-aera-900">{t('maintenance.title')}</h1>
                  <p className="text-slate-500 mt-1">{t('maintenance.subtitle')}</p>
               </div>
               <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-aera-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-aera-800 shadow-sm border border-transparent hover:border-aera-600 transition-colors flex items-center"
               >
                  <Plus className="w-4 h-4 mr-2" />
                  New Ticket
               </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
               {tickets.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                     <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                     <p>No maintenance tickets found.</p>
                  </div>
               ) : (
                  tickets.map(ticket => {
                     const property = properties.find(p => p.id === ticket.propertyId);
                     const tenant = tenants.find(t => t.id === ticket.tenantId);
                     const isSelected = selectedTicket?.id === ticket.id;

                     return (
                        <div
                           key={ticket.id}
                           onClick={() => handleTicketSelect(ticket)}
                           className={`w-full text-left p-5 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'bg-aera-50 border-aera-600 shadow-md ring-1 ring-aera-600'
                              : 'bg-white border-slate-200 hover:border-aera-300 hover:shadow-sm'
                              }`}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityColor(ticket.priority)}`}>
                                 {ticket.priority}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{ticket.dateCreated}</span>
                           </div>
                           <h3 className="text-lg font-semibold text-aera-900 mb-1">{ticket.title}</h3>
                           <p className="text-sm text-slate-500 mb-4 line-clamp-2">{ticket.description}</p>

                           <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100/50">
                              <div className="flex items-center space-x-2">
                                 <span className="font-medium text-slate-700">{property?.name || 'Unassigned Property'}</span>
                                 <span>•</span>
                                 <span>{tenant?.name || 'Unknown Tenant'}</span>
                              </div>
                              <div className="flex items-center">
                                 {ticket.status === 'Open' && <AlertCircle className="w-4 h-4 text-red-500 mr-1" />}
                                 {ticket.status === 'In Progress' && <Clock className="w-4 h-4 text-aera-600 mr-1" />}
                                 {ticket.status === 'Resolved' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-1" />}
                                 <span>{ticket.status}</span>
                              </div>
                           </div>
                        </div>
                     );
                  })
               )}
            </div>
         </div>

         {/* Detail & Action Panel */}
         <div className="w-[480px] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            {selectedTicket ? (
               <>
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                     <div className="flex justify-between items-start mb-4">
                        <h2 className="text-lg font-bold text-aera-900">Ticket Details</h2>
                        <span className="text-xs font-mono text-slate-400">ID: {selectedTicket.id}</span>
                     </div>
                     {renderStatusTracker(selectedTicket.status)}

                     {/* Status Action Buttons */}
                     <div className="flex gap-2">
                        {selectedTicket.status === 'Open' && (
                           <button
                              onClick={() => handleStatusChange('In Progress')}
                              className="flex-1 flex items-center justify-center space-x-2 bg-aera-600 hover:bg-aera-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                           >
                              <Clock className="w-4 h-4" />
                              <span>Start Work</span>
                           </button>
                        )}
                        {selectedTicket.status === 'In Progress' && (
                           <button
                              onClick={() => handleStatusChange('Resolved')}
                              className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                           >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Resolved</span>
                           </button>
                        )}
                        {selectedTicket.status === 'Resolved' && (
                           <button
                              onClick={() => handleStatusChange('Open')}
                              className="flex-1 flex items-center justify-center space-x-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors"
                           >
                              <AlertCircle className="w-4 h-4" />
                              <span>Reopen Ticket</span>
                           </button>
                        )}
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                           <div className="flex items-center text-xs text-slate-500 mb-1">
                              <Building2 className="w-3 h-3 mr-1" /> Property
                           </div>
                           <div className="text-sm font-semibold text-aera-900 truncate">
                              {properties.find(p => p.id === selectedTicket.propertyId)?.name}
                           </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                           <div className="flex items-center text-xs text-slate-500 mb-1">
                              <User className="w-3 h-3 mr-1" /> Tenant
                           </div>
                           <div className="text-sm font-semibold text-aera-900 truncate">
                              {tenants.find(t => t.id === selectedTicket.tenantId)?.name}
                           </div>
                        </div>
                     </div>

                     <div>
                        <h3 className="text-sm font-medium text-aera-900 mb-2">Issue Description</h3>
                        <div className="p-4 bg-white rounded-lg text-sm text-slate-700 leading-relaxed border border-slate-200 shadow-sm">
                           {selectedTicket.description}
                        </div>
                     </div>

                     <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Activity Log</h3>
                        <div className="space-y-4 pl-2 border-l-2 border-slate-100">
                           <div className="relative pl-4">
                              <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                              <p className="text-xs text-slate-500">{selectedTicket.dateCreated} - 09:00 AM</p>
                              <p className="text-sm font-medium text-slate-800">Ticket Created by Tenant</p>
                           </div>
                           {selectedTicket.status !== 'Open' && (
                              <div className="relative pl-4">
                                 <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-aera-600"></div>
                                 <p className="text-xs text-slate-500">{selectedTicket.dateCreated} - 02:30 PM</p>
                                 <p className="text-sm font-medium text-slate-800">Maintenance assigned to vendor</p>
                              </div>
                           )}
                           {selectedTicket.status === 'Resolved' && (
                              <div className="relative pl-4">
                                 <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-emerald-500"></div>
                                 <p className="text-xs text-slate-500">Today - 10:15 AM</p>
                                 <p className="text-sm font-medium text-slate-800">Issue marked as resolved</p>
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-4">
                        <div className="p-4 bg-gradient-to-r from-aera-900 to-aera-800 flex justify-between items-center text-white">
                           <div className="flex items-center space-x-2">
                              <Scale className="w-4 h-4 text-aera-600" />
                              <span className="font-semibold text-sm">Smart Liability Audit</span>
                           </div>
                        </div>

                        <div className="p-5">
                           {!liabilityAnalysis ? (
                              <div className="text-center py-2">
                                 <p className="text-xs text-slate-500 mb-4">
                                    Automatically cross-reference this issue with the tenant's signed lease to determine financial responsibility.
                                 </p>
                                 <button
                                    onClick={handleCheckLiability}
                                    disabled={isAnalyzingLiability}
                                    className="w-full bg-aera-50 hover:bg-aera-100 text-aera-900 text-xs font-bold py-2 px-4 rounded-lg border border-aera-200 transition-colors flex items-center justify-center"
                                 >
                                    {isAnalyzingLiability ? (
                                       <span className="animate-pulse">Auditing Lease...</span>
                                    ) : (
                                       "Check Who Pays"
                                    )}
                                 </button>
                              </div>
                           ) : (
                              <div className="space-y-3 animate-in zoom-in-95 duration-300">
                                 <div className={`flex items-center p-3 rounded-lg border ${liabilityAnalysis.responsibleParty === 'Tenant' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                                    liabilityAnalysis.responsibleParty === 'Landlord' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                                       'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}>
                                    {liabilityAnalysis.responsibleParty === 'Tenant' && <ShieldCheck className="w-5 h-5 mr-3 shrink-0" />}
                                    {liabilityAnalysis.responsibleParty === 'Landlord' && <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />}
                                    <div>
                                       <div className="text-xs font-bold uppercase tracking-wider mb-0.5">Responsible Party</div>
                                       <div className="font-bold text-lg">{liabilityAnalysis.responsibleParty}</div>
                                    </div>
                                    <div className="ml-auto text-xs font-bold opacity-60">{liabilityAnalysis.confidence}% Conf.</div>
                                 </div>

                                 <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <span className="font-bold text-slate-800 block mb-1">Legal Reasoning:</span>
                                    {liabilityAnalysis.reasoning}
                                 </div>

                                 <div className="text-[10px] text-slate-500 italic border-l-2 border-aera-300 pl-3 py-1">
                                    "{liabilityAnalysis.clauseCitation}"
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="bg-aera-50 rounded-xl p-5 border border-aera-100 mt-4">
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center space-x-2 text-aera-900 font-semibold">
                              <Sparkles className="w-4 h-4 text-aera-600" />
                              <span>AI Response Drafter</span>
                           </div>
                           <select
                              value={tone}
                              onChange={(e) => setTone(e.target.value as any)}
                              className="text-xs border-aera-200 rounded-md py-1 pl-2 pr-6 bg-white text-aera-700 focus:ring-aera-600 focus:border-aera-600"
                           >
                              <option value="Professional">Professional</option>
                              <option value="Empathetic">Empathetic</option>
                              <option value="Firm">Firm</option>
                           </select>
                        </div>

                        <button
                           onClick={handleDraftResponse}
                           disabled={isDrafting}
                           className="w-full flex items-center justify-center space-x-2 bg-aera-900 hover:bg-aera-800 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 border border-transparent hover:border-aera-600"
                        >
                           {isDrafting ? (
                              <span className="animate-pulse">Generating draft...</span>
                           ) : (
                              <>
                                 <MessageSquare className="w-4 h-4" />
                                 <span>Draft Reply</span>
                              </>
                           )}
                        </button>

                        {draftResponse && (
                           <div className="mt-4 animate-in slide-in-from-bottom-2">
                              <label className="block text-xs font-medium text-aera-900 mb-2">Drafted Message</label>
                              <textarea
                                 className="w-full h-40 p-3 text-sm rounded-lg border-aera-200 focus:ring-aera-600 focus:border-aera-600"
                                 value={draftResponse}
                                 onChange={(e) => setDraftResponse(e.target.value)}
                              />
                              <div className="flex justify-end mt-2">
                                 <button
                                    onClick={handleSendDraftToTenant}
                                    className="flex items-center space-x-1 text-xs font-medium bg-aera-900 hover:bg-aera-800 text-white px-3 py-1.5 rounded-lg transition-colors"
                                 >
                                    <Send className="w-3 h-3" />
                                    <span>Send to Tenant</span>
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="w-16 h-16 bg-aera-50 rounded-full flex items-center justify-center mb-4">
                     <MessageSquare className="w-8 h-8 text-aera-200" />
                  </div>
                  <p className="text-sm font-medium">Select a ticket to view detailed tracking and generate AI responses.</p>
               </div>
            )}
         </div>

         {/* CREATE TICKET MODAL */}
         {
            isCreateModalOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-aera-100 max-h-[90vh] flex flex-col">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50 shrink-0">
                        <h2 className="text-lg font-bold text-aera-900">Create New Ticket</h2>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                           <X className="w-6 h-6" />
                        </button>
                     </div>

                     <div className="overflow-y-auto p-6 flex-1">
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                           {/* AI VISUAL TRIAGE SECTION */}
                           <div className="bg-aera-50 border border-aera-200 rounded-lg p-4 mb-4 transition-all duration-300">
                              <div className="flex items-center justify-between mb-2">
                                 <div className="flex items-center space-x-2 text-aera-900 font-bold text-sm">
                                    <Camera className="w-4 h-4 text-aera-600" />
                                    <span>AI Visual Triage</span>
                                 </div>
                                 {isAiPopulated && (
                                    <div className="animate-in fade-in slide-in-from-right-4 flex items-center space-x-1 text-emerald-600 text-xs font-medium">
                                       <Sparkles className="w-3 h-3" />
                                       <span>Auto-filled!</span>
                                    </div>
                                 )}
                              </div>
                              <p className="text-xs text-slate-500 mb-3">
                                 Upload a photo of the issue. Gemini AI will automatically categorize it and fill in the details.
                              </p>

                              <div
                                 className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center transition-colors relative overflow-hidden ${isAnalyzingImage ? 'bg-white border-aera-600' : isDragging ? 'bg-aera-100 border-aera-600' : 'border-slate-300 hover:border-aera-600 hover:bg-white cursor-pointer'}`}
                                 onClick={() => !isAnalyzingImage && !uploadedImage && fileInputRef.current?.click()}
                                 onDragOver={handleDragOver}
                                 onDragLeave={handleDragLeave}
                                 onDrop={handleDrop}
                              >
                                 <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                 />

                                 {isAnalyzingImage ? (
                                    <div className="flex flex-col items-center py-4">
                                       <Loader2 className="w-8 h-8 text-aera-600 animate-spin mb-2" />
                                       <span className="text-xs font-medium text-aera-900">Analyzing Image...</span>
                                       <span className="text-[10px] text-slate-500">Identifying priority & category</span>
                                    </div>
                                 ) : uploadedImage ? (
                                    <div className="w-full relative group">
                                       <img src={uploadedImage} alt="Uploaded issue" className="h-32 w-full object-cover rounded-md" />
                                       <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                                          {/* Just a hover overlay layer */}
                                       </div>
                                       <div className="absolute top-2 right-2 flex space-x-2">
                                          <button
                                             onClick={handleRemoveImage}
                                             className="bg-white/80 hover:bg-red-500 hover:text-white text-slate-600 p-1.5 rounded-full backdrop-blur-sm transition-colors shadow-sm"
                                             title="Remove Image"
                                          >
                                             <X className="w-4 h-4" />
                                          </button>
                                       </div>
                                       <div className="absolute bottom-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm">
                                          <CheckCircle2 className="w-3 h-3" />
                                       </div>
                                    </div>
                                 ) : (
                                    <div className="py-4">
                                       {isDragging ? (
                                          <UploadCloud className="w-8 h-8 text-aera-600 mx-auto mb-2" />
                                       ) : (
                                          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                       )}
                                       <span className={`text-xs font-medium ${isDragging ? 'text-aera-900' : 'text-slate-600'}`}>
                                          {isDragging ? 'Drop Image Here' : 'Click or Drag Photo'}
                                       </span>
                                    </div>
                                 )}
                              </div>
                           </div>

                           <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Tenant *</label>
                              <select
                                 required
                                 value={newTicketData.tenantId || ''}
                                 onChange={(e) => setNewTicketData({ ...newTicketData, tenantId: e.target.value })}
                                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white"
                              >
                                 <option value="">Select Tenant reporting issue...</option>
                                 {tenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                 ))}
                              </select>
                           </div>

                           <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Issue Title *</label>
                              <div className="relative">
                                 <input
                                    required
                                    type="text"
                                    placeholder="e.g. Leaking pipe in breakroom"
                                    value={newTicketData.title || ''}
                                    onChange={(e) => setNewTicketData({ ...newTicketData, title: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all ${isAiPopulated ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-300'}`}
                                 />
                                 {isAiPopulated && <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                 <select
                                    value={newTicketData.priority}
                                    onChange={(e) => setNewTicketData({ ...newTicketData, priority: e.target.value as any })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white transition-all ${isAiPopulated ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-300'}`}
                                 >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Emergency">Emergency</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                 <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                       disabled
                                       value={new Date().toLocaleDateString()}
                                       className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg outline-none"
                                    />
                                 </div>
                              </div>
                           </div>

                           <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description *</label>
                              <div className="relative">
                                 <textarea
                                    required
                                    rows={4}
                                    placeholder="Describe the issue in detail..."
                                    value={newTicketData.description || ''}
                                    onChange={(e) => setNewTicketData({ ...newTicketData, description: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none resize-none transition-all ${isAiPopulated ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-300'}`}
                                 />
                                 {isAiPopulated && <Sparkles className="absolute right-3 top-3 w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                              </div>
                           </div>

                           <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                 Cancel
                              </button>
                              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-aera-900 hover:bg-aera-800 rounded-lg transition-colors shadow-sm">
                                 Create Ticket
                              </button>
                           </div>
                        </form>
                     </div>
                  </div>
               </div>
            )
         }
      </div >
   );
};

export default Maintenance;
