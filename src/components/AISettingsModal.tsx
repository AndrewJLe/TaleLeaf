"use client";

import { useState, useEffect } from 'react';
import { AI_PROVIDERS, AIProvider, aiService, AISettings } from '../lib/ai-service';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: Props) {
    const [settings, setSettings] = useState<AISettings>({ provider: 'openai-gpt4o-mini', apiKeys: {} });
    const [tempApiKey, setTempApiKey] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);

    useEffect(() => {
        if (isOpen) {
            const currentSettings = aiService.getSettings();
            setSettings(currentSettings);
            const provider = AI_PROVIDERS.find(p => p.id === currentSettings.provider);
            setSelectedProvider(provider || AI_PROVIDERS[0]);
        }
    }, [isOpen]);

    const handleSave = () => {
        const updatedSettings = { ...settings };

        if (selectedProvider?.requiresApiKey && tempApiKey.trim()) {
            updatedSettings.apiKeys[selectedProvider.id] = tempApiKey.trim();
        }

        if (selectedProvider) {
            updatedSettings.provider = selectedProvider.id;
        }

        aiService.updateSettings(updatedSettings);
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
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-emerald-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                                <span className="text-white text-lg">🤖</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-emerald-900">AI Assistant Settings</h2>
                                <p className="text-sm text-emerald-600">Choose your AI model and configure API keys</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Provider Selection */}
                    <div>
                        <h3 className="text-lg font-semibold text-emerald-900 mb-4">Select AI Model</h3>
                        <div className="space-y-3">
                            {AI_PROVIDERS.map((provider) => (
                                <div
                                    key={provider.id}
                                    onClick={() => handleProviderSelect(provider)}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedProvider?.id === provider.id
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-emerald-200 bg-white hover:border-emerald-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="font-semibold text-emerald-900">{provider.name}</h4>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${provider.tier === 'free'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {provider.tier}
                                                </span>
                                            </div>
                                            <p className="text-sm text-emerald-700 mb-2">{provider.description}</p>
                                            {provider.costEstimate && (
                                                <p className="text-xs text-emerald-600">Cost: {provider.costEstimate}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center">
                                            {provider.requiresApiKey && (
                                                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
                                                    API Key Required
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* API Key Configuration */}
                    {selectedProvider?.requiresApiKey && (
                        <div>
                            <h3 className="text-lg font-semibold text-emerald-900 mb-4">API Key Configuration</h3>
                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🔑</span>
                                    <div>
                                        <h4 className="font-medium text-emerald-900">{selectedProvider.name} API Key</h4>
                                        <p className="text-sm text-emerald-700">
                                            {selectedProvider.id.startsWith('openai') && 'Get your API key from platform.openai.com'}
                                            {selectedProvider.id.startsWith('anthropic') && 'Get your API key from console.anthropic.com'}
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="password"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="Enter your API key..."
                                    className="w-full px-4 py-3 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                                <div className="mt-2 text-xs text-emerald-600">
                                    🔒 API keys are stored locally in your browser and never sent to our servers
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Free Tier Info */}
                    {selectedProvider?.tier === 'free' && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-green-600">✨</span>
                                <h4 className="font-medium text-green-900">Free Tier Selected</h4>
                            </div>
                            <p className="text-sm text-green-700">
                                This option uses free AI services with some limitations on speed and daily usage.
                                Perfect for getting started!
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-emerald-200 bg-emerald-50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-emerald-600">
                            Current selection: <span className="font-medium">{selectedProvider?.name}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
