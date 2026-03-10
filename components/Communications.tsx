
import React, { useState, useEffect, useRef } from 'react';
import { Message, Tenant } from '../types';
import { Search, Send, Megaphone, User, Check, CheckCheck, MessageSquare, MessageCircle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';

const Communications: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
  // === DATA CORE ===
  const { data, dispatch } = useDataCore();
  const allTenants = data.tenants;
  const tenants = propertyId ? allTenants.filter(t => t.propertyId === propertyId) : allTenants;
  const tenantIds = propertyId ? new Set(tenants.map(t => t.id)) : null;
  const messages = propertyId
    ? data.messages.filter(m => tenantIds!.has(m.senderId) || tenantIds!.has(m.receiverId))
    : data.messages;
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [isTenantTyping, setIsTenantTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current conversation messages
  const currentMessages = messages.filter(m => {
    if (selectedId === 'all') {
      return m.receiverId === 'all';
    }
    return (m.senderId === selectedId && m.receiverId === 'admin') ||
      (m.senderId === 'admin' && m.receiverId === selectedId);
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isTenantTyping, selectedId]);

  // Reset typing state when switching chats
  useEffect(() => {
    setIsTenantTyping(false);
  }, [selectedId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const msgData: Omit<Message, 'id'> = {
      senderId: 'admin',
      receiverId: selectedId,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
      isRead: true,
      isAdmin: true
    };

    try {
      await dispatch({ type: 'message:add', payload: msgData });
      setNewMessage('');

      // Simulate Tenant Typing Reply
      if (selectedId !== 'all') {
        setTimeout(() => setIsTenantTyping(true), 1000);
        setTimeout(() => setIsTenantTyping(false), 4000);
      }
    } catch (error: any) {
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const handleSendWhatsApp = () => {
    if (!newMessage.trim()) return;

    const tenant = tenants.find(t => t.id === selectedId);

    if (tenant) {
      const cleanPhone = tenant.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(newMessage)}`;
      window.open(whatsappUrl, '_blank');
    } else if (selectedId === 'all') {
      alert("WhatsApp Broadcast not supported via web link. Please use a CRM tool for mass messages.");
      return;
    }

    handleSendMessage();
  };

  const getTenantName = (id: string) => {
    return tenants.find(t => t.id === id)?.name || 'Unknown';
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-6 animate-in fade-in duration-500">
      {/* Sidebar List */}
      <div className="w-80 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-aera-900">{t('communications.title')}</h2>
          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tenants..."
              className="w-full pl-9 pr-4 py-2 bg-aera-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Announcements Channel */}
          <button
            onClick={() => setSelectedId('all')}
            className={`w-full p-4 flex items-center space-x-3 transition-colors border-b border-slate-50 ${selectedId === 'all' ? 'bg-aera-50 border-l-4 border-l-aera-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
              }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedId === 'all' ? 'bg-aera-100 text-aera-900' : 'bg-slate-100 text-slate-500'}`}>
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-semibold text-aera-900 text-sm">Announcements</div>
              <div className="text-xs text-slate-500 truncate">Broadcast to all tenants</div>
            </div>
          </button>

          {/* Tenant Channels */}
          {tenants.map(tenant => {
            const tenantMessages = messages.filter(m =>
              (m.senderId === tenant.id || m.receiverId === tenant.id) && m.receiverId !== 'all'
            );
            const lastMsg = tenantMessages.length > 0 ? tenantMessages[tenantMessages.length - 1] : null;

            const unreadCount = messages.filter(m => m.senderId === tenant.id && !m.isRead).length;

            return (
              <button
                key={tenant.id}
                onClick={() => setSelectedId(tenant.id)}
                className={`w-full p-4 flex items-center space-x-3 transition-colors border-b border-slate-50 ${selectedId === tenant.id ? 'bg-aera-50 border-l-4 border-l-aera-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedId === tenant.id ? 'bg-aera-100 text-aera-900' : 'bg-slate-100 text-slate-500'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-aera-900 text-sm truncate">{tenant.name}</span>
                    {lastMsg && <span className="text-[10px] text-slate-400 shrink-0 ml-2">{lastMsg.timestamp.split(' ')[0]}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className={`text-xs truncate mr-2 ${unreadCount > 0 ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                      {lastMsg ? (lastMsg.isAdmin ? `You: ${lastMsg.content}` : lastMsg.content) : 'No messages yet'}
                    </div>
                    {unreadCount > 0 && (
                      <span className="bg-aera-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedId === 'all' ? 'bg-aera-100 text-aera-900' : 'bg-slate-100 text-slate-600'}`}>
              {selectedId === 'all' ? <Megaphone className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-aera-900">
                {selectedId === 'all' ? 'All Tenants' : getTenantName(selectedId)}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedId === 'all' ? `Sending announcement to ${tenants.length} active tenants` : 'Direct Message History'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-aera-50">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No messages yet. Start the conversation.</p>
            </div>
          ) : (
            currentMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${msg.isAdmin
                  ? 'bg-aera-900 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`text-[10px] mt-2 flex items-center justify-end ${msg.isAdmin ? 'text-aera-100' : 'text-slate-400'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.isAdmin && (
                      <span className="ml-1.5 opacity-80">
                        {msg.isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isTenantTyping && selectedId !== 'all' && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150" />
                </div>
                <span className="text-xs text-slate-400 font-medium">Typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-end space-x-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={selectedId === 'all' ? "Type an announcement..." : "Type a message..."}
              className="flex-1 resize-none bg-aera-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 max-h-32 min-h-[50px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            {selectedId !== 'all' && (
              <button
                onClick={handleSendWhatsApp}
                disabled={!newMessage.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white p-3 rounded-lg transition-colors shadow-sm"
                title="Send via WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-aera-900 hover:bg-aera-800 disabled:bg-slate-300 text-white p-3 rounded-lg transition-colors shadow-sm"
              title="Send via internal system"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {selectedId === 'all' && (
            <p className="text-xs text-aera-600 mt-2 flex items-center">
              <Megaphone className="w-3 h-3 mr-1" />
              This message will be sent to all active tenants.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Communications;
