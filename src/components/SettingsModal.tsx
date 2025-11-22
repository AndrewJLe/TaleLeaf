"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AI_PROVIDERS, AIProvider, aiService, AISettings, ApiKeyStatus, StoredApiKey } from '../lib/ai-service';
import { pdfStorage } from '../lib/pdf-storage';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { uploadPDF } from '../lib/supabase-storage';
import { uploadCover } from '../lib/upload-cover';
import { Book } from '../types/book';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  onUpdate: (partial: Partial<Book>) => void;
  onReupload: (file: File) => Promise<void>;
  isEditingPageText: boolean;
  toggleEditingPageText: () => void;
  currentPage: number;
  onDeleteBook?: () => void;
  isDeletingBook?: boolean;
}

type Tab = 'ai' | 'book';

type KeyFormState = {
  name: string;
  secret: string;
  providerId: string;
  status: ApiKeyStatus;
};

export function SettingsModal({ isOpen, onClose, book, onUpdate, onReupload, isEditingPageText, toggleEditingPageText, currentPage, onDeleteBook, isDeletingBook = false }: Props) {
  const [tab, setTab] = useState<Tab>('ai');
  const [settings, setSettings] = useState<AISettings>(() => aiService.getSettings());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [keyFormState, setKeyFormState] = useState<KeyFormState>(() => ({
    name: '',
    secret: '',
    providerId: aiService.getSettings().provider || AI_PROVIDERS[0].id,
    status: 'active'
  }));
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = aiService.getSettings();
      setSettings(currentSettings);
      const provider = AI_PROVIDERS.find(p => p.id === currentSettings.provider);
      const fallbackProvider = provider || AI_PROVIDERS[0];
      setSelectedProvider(fallbackProvider);
      setKeyFormOpen(false);
      setEditingKeyId(null);
      setKeyFormState({
        name: '',
        secret: '',
        providerId: fallbackProvider?.id || AI_PROVIDERS[0].id,
        status: 'active'
      });
    }
  }, [isOpen]);

  const handleSaveAI = () => {
    if (selectedProvider) {
      aiService.updateSettings({ provider: selectedProvider.id });
      refreshSettings();
    }
    onClose();
  };

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setKeyFormState(prev => ({ ...prev, providerId: provider.id }));
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDeleteBook?.();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const refreshSettings = () => {
    setSettings(aiService.getSettings());
  };

  const openAddKeyForm = (providerId?: string) => {
    setEditingKeyId(null);
    setKeyFormState({
      name: '',
      secret: '',
      providerId: providerId || selectedProvider?.id || AI_PROVIDERS[0].id,
      status: 'active'
    });
    setKeyFormOpen(true);
  };

  const openEditKeyForm = (key: StoredApiKey) => {
    setEditingKeyId(key.id);
    setKeyFormState({
      name: key.name,
      secret: '',
      providerId: key.providerId,
      status: key.status
    });
    setKeyFormOpen(true);
  };

  const closeKeyForm = () => {
    setKeyFormOpen(false);
    setEditingKeyId(null);
    setKeyFormState(prev => ({
      ...prev,
      name: '',
      secret: '',
      providerId: selectedProvider?.id || prev.providerId,
      status: 'active'
    }));
  };

  const handleKeyFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editingKeyId) {
        aiService.updateStoredApiKey(editingKeyId, {
          name: keyFormState.name.trim() || 'API Key',
          status: keyFormState.status,
          ...(keyFormState.secret.trim() ? { secret: keyFormState.secret.trim() } : {})
        });
      } else {
        if (!keyFormState.secret.trim()) {
          return;
        }
        aiService.addStoredApiKey({
          name: keyFormState.name.trim() || 'API Key',
          providerId: keyFormState.providerId,
          secret: keyFormState.secret.trim(),
          status: keyFormState.status
        });
      }
      refreshSettings();
      closeKeyForm();
    } catch (error) {
      console.error('Failed to save API key', error);
      alert('Unable to save API key. Please try again.');
    }
  };

  const handleDeleteKey = (key: StoredApiKey) => {
    if (!confirm(`Delete API key "${key.name}"?`)) {
      return;
    }
    aiService.deleteStoredApiKey(key.id);
    refreshSettings();
  };

  const handleActiveKeyChange = (providerId: string, keyId: string) => {
    try {
      aiService.selectApiKeyForProvider(providerId, keyId || null);
      refreshSettings();
    } catch (error) {
      console.error('Failed to select API key', error);
      alert('Unable to select API key for this provider.');
    }
  };

  const maskSecret = (secret: string) => {
    if (!secret) return '—';
    if (secret.length <= 8) return secret;
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString();
  };

  const getProviderName = (providerId: string) => {
    return AI_PROVIDERS.find(p => p.id === providerId)?.name || providerId;
  };

  const keysForSelectedProvider = selectedProvider ? settings.storedApiKeys.filter(key => key.providerId === selectedProvider.id) : [];

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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-emerald-900">API Keys</h3>
                  <button onClick={() => openAddKeyForm()} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">➕ Add Key</button>
                </div>
                <p className="text-[11px] text-emerald-600 mb-3">API keys are encrypted by your browser and saved locally. Assign them to the models you plan to use.</p>

                {selectedProvider?.requiresApiKey && (
                  <div className="p-4 border border-emerald-200 rounded-lg bg-white mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-900">Active key for {selectedProvider.name}</p>
                        <p className="text-[11px] text-emerald-600">{keysForSelectedProvider.length ? 'Select a stored key to enable this provider.' : 'Add a key for this provider to enable AI actions.'}</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <select value={settings.providerKeyMap[selectedProvider.id] || ''} onChange={(e) => handleActiveKeyChange(selectedProvider.id, e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm">
                          <option value="">No key selected</option>
                          {keysForSelectedProvider.map(key => (
                            <option key={key.id} value={key.id}>{key.name}{key.status !== 'active' ? ' (inactive)' : ''}</option>
                          ))}
                        </select>
                        <button onClick={() => openAddKeyForm(selectedProvider.id)} className="px-3 py-2 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50">New</button>
                      </div>
                    </div>
                  </div>
                )}

                {keyFormOpen && (
                  <form onSubmit={handleKeyFormSubmit} className="mb-4 border border-emerald-200 rounded-lg bg-emerald-50/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-emerald-900">{editingKeyId ? 'Edit API Key' : 'Add API Key'}</p>
                      <button type="button" onClick={closeKeyForm} className="text-xs text-emerald-700 hover:underline">Cancel</button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-emerald-800 mb-1">Name</label>
                        <input value={keyFormState.name} onChange={(e) => setKeyFormState(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" placeholder="e.g. Personal OpenAI Key" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-emerald-800 mb-1">Provider</label>
                        <select value={keyFormState.providerId} onChange={(e) => setKeyFormState(prev => ({ ...prev, providerId: e.target.value }))} disabled={!!editingKeyId} className={`w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm ${editingKeyId ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                          {AI_PROVIDERS.map(provider => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-emerald-800 mb-1">Secret Key</label>
                      <input type="password" value={keyFormState.secret} onChange={(e) => setKeyFormState(prev => ({ ...prev, secret: e.target.value }))} placeholder={editingKeyId ? 'Leave blank to keep current secret' : 'sk-...'} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" autoComplete="off" />
                      {editingKeyId && <p className="text-[10px] text-emerald-600 mt-1">Leave empty to keep the stored secret.</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-emerald-800 mb-1">Status</label>
                        <select value={keyFormState.status} onChange={(e) => setKeyFormState(prev => ({ ...prev, status: e.target.value as ApiKeyStatus }))} className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="flex items-end justify-end gap-2">
                        <button type="button" onClick={closeKeyForm} className="px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={!editingKeyId && !keyFormState.secret.trim()} className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50">Save Key</button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="border border-emerald-200 rounded-lg bg-white overflow-hidden">
                  {settings.storedApiKeys.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-emerald-50 text-emerald-800">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold">Name</th>
                            <th className="px-4 py-2 text-left font-semibold">Provider</th>
                            <th className="px-4 py-2 text-left font-semibold">Status</th>
                            <th className="px-4 py-2 text-left font-semibold">Secret</th>
                            <th className="px-4 py-2 text-left font-semibold">Created</th>
                            <th className="px-4 py-2 text-left font-semibold">Last Used</th>
                            <th className="px-4 py-2 text-left font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settings.storedApiKeys.map(key => (
                            <tr key={key.id} className="border-t border-emerald-100">
                              <td className="px-4 py-2 text-emerald-900">{key.name}</td>
                              <td className="px-4 py-2 text-emerald-900">{getProviderName(key.providerId)}</td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${key.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>{key.status === 'active' ? 'Active' : 'Inactive'}</span>
                              </td>
                              <td className="px-4 py-2 font-mono text-emerald-900">{maskSecret(key.secret)}</td>
                              <td className="px-4 py-2 text-emerald-900">{formatDate(key.createdAt)}</td>
                              <td className="px-4 py-2 text-emerald-900">{formatDate(key.lastUsedAt)}</td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => handleActiveKeyChange(key.providerId, key.id)} className="px-3 py-1 text-[11px] rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Use</button>
                                  <button onClick={() => openEditKeyForm(key)} className="px-3 py-1 text-[11px] rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Edit</button>
                                  <button onClick={() => handleDeleteKey(key)} className="px-3 py-1 text-[11px] rounded-md border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-emerald-800">No API keys stored yet.</div>
                  )}
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

              {/* Delete Book Section */}
              {onDeleteBook && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Delete Book</h4>
                      <p className="text-xs text-gray-600">Remove this book permanently</p>
                    </div>
                    <button
                      onClick={handleDeleteClick}
                      disabled={isDeletingBook}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={showDeleteConfirm}
        bookTitle={book.title}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={isDeletingBook}
      />
    </div>
  );
}
