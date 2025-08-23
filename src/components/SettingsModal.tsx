"use client";

import { useEffect, useRef, useState } from 'react';
import { AI_PROVIDERS, AIProvider, aiService, AISettings, TokenBudget } from '../lib/ai-service';
import { pdfStorage } from '../lib/pdf-storage';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { uploadPDF } from '../lib/supabase-storage';
import { uploadCover } from '../lib/upload-cover';
import { Book } from '../types/book';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  onUpdate: (partial: Partial<Book>) => void;
  onReupload: (file: File) => Promise<void>;
  isEditingPageText: boolean;
  toggleEditingPageText: () => void;
  currentPage: number;
}

type Tab = 'ai' | 'book';

export function SettingsModal({ isOpen, onClose, book, onUpdate, onReupload, isEditingPageText, toggleEditingPageText, currentPage }: Props) {
  const [tab, setTab] = useState<Tab>('ai');
  const [settings, setSettings] = useState<AISettings>({ provider: 'openai-gpt4o-mini', apiKeys: {} });
  const [tempApiKey, setTempApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [budget, setBudget] = useState<TokenBudget>(aiService.getTokenBudget());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = aiService.getSettings();
      setSettings(currentSettings);
      setBudget(aiService.getTokenBudget());
      const provider = AI_PROVIDERS.find(p => p.id === currentSettings.provider);
      setSelectedProvider(provider || AI_PROVIDERS[0]);
    }
  }, [isOpen]);

  const handleSaveAI = () => {
    const updatedSettings = { ...settings };
    if (selectedProvider?.requiresApiKey && tempApiKey.trim()) {
      updatedSettings.apiKeys[selectedProvider.id] = tempApiKey.trim();
    }
    if (selectedProvider) updatedSettings.provider = selectedProvider.id;
    aiService.updateSettings(updatedSettings);
    aiService.updateTokenBudget(budget);
    setSettings(updatedSettings);
    setTempApiKey('');
    onClose();
  };

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setTempApiKey(settings.apiKeys[provider.id] || '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-emerald-200 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-xl">⚙️</div>
            <div>
              <h2 className="text-lg font-bold">Settings</h2>
              <p className="text-xs text-emerald-50">Configure AI and book options</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 flex gap-2 border-b border-emerald-100 bg-emerald-50/60">
          <button onClick={() => setTab('ai')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'ai' ? 'bg-white shadow border border-emerald-200 text-emerald-700' : 'text-emerald-600 hover:bg-white/60'}`}>AI</button>
          <button onClick={() => setTab('book')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'book' ? 'bg-white shadow border border-emerald-200 text-emerald-700' : 'text-emerald-600 hover:bg-white/60'}`}>Book</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-3">Select AI Model</h3>
                <div className="space-y-3">
                  {AI_PROVIDERS.map(provider => (
                    <div key={provider.id} onClick={() => handleProviderSelect(provider)} className={`p-4 rounded-lg border-2 cursor-pointer transition ${selectedProvider?.id === provider.id ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-200 bg-white hover:border-emerald-300'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-medium text-emerald-900 text-sm">{provider.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${provider.tier === 'free' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{provider.tier}</span>
                          </div>
                          <p className="text-xs text-emerald-700 mb-1 leading-relaxed">{provider.description}</p>
                          {provider.costEstimate && <p className="text-[10px] text-emerald-600">Cost: {provider.costEstimate}</p>}
                        </div>
                        {provider.requiresApiKey && <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded">API Key</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedProvider?.requiresApiKey && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 mb-2">API Key</h3>
                  <input type="password" value={tempApiKey} onChange={e => setTempApiKey(e.target.value)} placeholder="Enter API key..." className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                  <p className="text-[10px] text-emerald-600 mt-1">Stored locally only.</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-3">Budget</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-emerald-800 mb-1">Daily Limit ($)</label>
                    <input type="number" step="0.01" min="0" value={budget.dailyLimit} onChange={e => setBudget({ ...budget, dailyLimit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-800 mb-1">Monthly Limit ($)</label>
                    <input type="number" step="0.01" min="0" value={budget.monthlyLimit} onChange={e => setBudget({ ...budget, monthlyLimit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-emerald-800 mb-1">Warning Threshold: {Math.round(budget.warningThreshold * 100)}%</label>
                  <input type="range" min="0.5" max="1" step="0.05" value={budget.warningThreshold} onChange={e => setBudget({ ...budget, warningThreshold: parseFloat(e.target.value) })} className="w-full" />
                </div>
              </div>
            </div>
          )}

          {tab === 'book' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-2">Title</h3>
                <input value={book.title} onChange={(e) => onUpdate({ title: e.target.value })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-50 shadow-sm">Reupload PDF/Text</button>
                <button onClick={() => coverInputRef.current?.click()} className="px-4 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-50 shadow-sm">Change Cover</button>
                {book.uploads?.[0]?.pages && (
                  <button onClick={toggleEditingPageText} className="px-4 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-50 shadow-sm">{isEditingPageText ? 'Stop Editing Page' : 'Edit Current Page'}</button>
                )}
              </div>
              {book.cover && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-800 mb-2">Current Cover</h4>
                  <img src={book.cover} alt="Cover" className="h-40 rounded border shadow" />
                </div>
              )}
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 leading-relaxed">
                <p className="font-medium">Page Editing Note</p>
                <p>When you edit page {currentPage}, the modified text will be used for AI context immediately but does not alter the original uploaded file.</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Inputs */}
        <input ref={fileInputRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" className="hidden" onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          if (f) {
            await onReupload(f);
            // If it's a PDF and supabase enabled, upload to storage and update metadata
            if (isSupabaseEnabled && supabaseClient && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
              try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) {
                  // Store locally (onReupload already did) but get blob again for upload
                  const uploadId = crypto.randomUUID();
                  await pdfStorage.storePDF(uploadId, f.name, f);
                  const path = await uploadPDF(session.user.id, book.id, f, f.name);
                  onUpdate({ pdfPath: path });
                  await fetch(`/api/books/${book.id}/meta`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfPath: path }) });
                }
              } catch (err) {
                console.warn('PDF reupload cloud sync failed', err);
              }
            }
          }
          e.currentTarget.value = '';
        }} />
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.currentTarget.files?.[0]; if (!f) return; try {
            if (isSupabaseEnabled) {
              const url = await uploadCover(f, book.id);
              if (url) {
                onUpdate({ cover: url });
                await fetch(`/api/books/${book.id}/meta`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coverUrl: url }) });
                return;
              }
            }
            // Fallback to base64 local if Supabase disabled / failure
            const reader = new FileReader();
            reader.onload = () => onUpdate({ cover: reader.result as string });
            reader.readAsDataURL(f);
          } finally { e.currentTarget.value = ''; }
        }} />

        {/* Footer */}
        <div className="p-5 border-t border-emerald-200 bg-emerald-50 flex items-center justify-between">
          <div className="text-xs text-emerald-700">{tab === 'ai' ? <>Model: <span className="font-medium">{selectedProvider?.name}</span></> : <>Book ID: <span className="font-mono">{book.id}</span></>}</div>
          {tab === 'ai' ? (
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-100">Cancel</button>
              <button onClick={handleSaveAI} className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow">Save</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
