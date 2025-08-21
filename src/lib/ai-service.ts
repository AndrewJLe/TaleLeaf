export interface AIProvider {
    id: string;
    name: string;
    description: string;
    tier: 'free' | 'premium';
    requiresApiKey: boolean;
    costEstimate?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
    {
        id: 'openai-gpt4o-mini',
        name: 'OpenAI GPT-4o Mini',
        description: 'Fast and affordable, great for most tasks',
        tier: 'premium',
        requiresApiKey: true,
        costEstimate: '~$0.15/1M tokens'
    },
    {
        id: 'openai-gpt4o',
        name: 'OpenAI GPT-4o',
        description: 'Most capable model, best for complex analysis',
        tier: 'premium',
        requiresApiKey: true,
        costEstimate: '~$5/1M tokens'
    },
    {
        id: 'anthropic-claude',
        name: 'Anthropic Claude Sonnet',
        description: 'Excellent for long-form text analysis',
        tier: 'premium',
        requiresApiKey: true,
        costEstimate: '~$3/1M tokens'
    }
];

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AISettings {
    provider: string;
    apiKeys: Record<string, string>;
}

class AIService {
    private settings: AISettings = {
        provider: 'openai-gpt4o-mini',
        apiKeys: {}
    };

    constructor() {
        // Load settings from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('taleleaf:ai-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        }
    }

    updateSettings(settings: Partial<AISettings>) {
        this.settings = { ...this.settings, ...settings };
        if (typeof window !== 'undefined') {
            localStorage.setItem('taleleaf:ai-settings', JSON.stringify(this.settings));
        }
    }

    getSettings(): AISettings {
        return this.settings;
    }

    async chat(messages: AIMessage[], contextText: string): Promise<string> {
        const provider = AI_PROVIDERS.find(p => p.id === this.settings.provider);
        if (!provider) {
            throw new Error('Invalid AI provider selected');
        }

        // Check if API key is required but missing
        if (provider.requiresApiKey && !this.settings.apiKeys[provider.id]) {
            throw new Error(`API key required for ${provider.name}. Please configure it in settings.`);
        }

        switch (provider.id) {
            case 'openai-gpt4o-mini':
            case 'openai-gpt4o':
                return this.chatWithOpenAI(messages, contextText, provider.id);
            case 'anthropic-claude':
                return this.chatWithAnthropic(messages, contextText);
            default:
                throw new Error(`Provider ${provider.id} not implemented yet`);
        }
    }

    private async chatWithOpenAI(messages: AIMessage[], contextText: string, model: string): Promise<string> {
        const apiKey = this.settings.apiKeys['openai-gpt4o-mini'] || this.settings.apiKeys['openai-gpt4o'];
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const modelName = model === 'openai-gpt4o' ? 'gpt-4o' : 'gpt-4o-mini';

        try {
            const systemMessage: AIMessage = {
                role: 'system',
                content: `You are a helpful reading assistant. Answer questions about the book based ONLY on the provided context. Never reveal information outside the given context to avoid spoilers.

Context from book (pages in current window):
${contextText}

Guidelines:
- Only use information from the provided context
- If asked about events outside the context, politely say you don't have that information yet
- Be helpful and engaging while respecting spoiler boundaries
- Provide detailed analysis when possible using available context`
            };

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [systemMessage, ...messages],
                    max_tokens: 500,
                    temperature: 0.7,
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`OpenAI API error ${response.status}: ${errorData}`);
            }

            const result = await response.json();
            return result.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        } catch (error) {
            console.error('OpenAI error:', error);
            throw error;
        }
    }

    private async chatWithAnthropic(messages: AIMessage[], contextText: string): Promise<string> {
        const apiKey = this.settings.apiKeys['anthropic-claude'];
        if (!apiKey) {
            throw new Error('Anthropic API key not configured');
        }

        try {
            // Convert messages to Anthropic format
            const systemPrompt = `You are a helpful reading assistant. Answer questions about the book based ONLY on the provided context. Never reveal information outside the given context to avoid spoilers.

Context from book (pages in current window):
${contextText}`;

            const userMessages = messages.filter(m => m.role === 'user');
            const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 500,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: lastUserMessage }]
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Anthropic API error ${response.status}: ${errorData}`);
            }

            const result = await response.json();
            return result.content[0]?.text || 'Sorry, I could not generate a response.';
        } catch (error) {
            console.error('Anthropic error:', error);
            throw error;
        }
    }

    extractContextText(book: any, windowStart: number, windowEnd: number): string {
        if (!book.uploads || book.uploads.length === 0) {
            return 'No book content available.';
        }

        const upload = book.uploads[0];
        if (!upload.pages || upload.pages.length === 0) {
            return 'No pages found in uploaded book.';
        }

        // Extract pages within the window (1-indexed)
        const startIdx = Math.max(0, windowStart - 1);
        const endIdx = Math.min(upload.pages.length, windowEnd);

        const contextPages = upload.pages.slice(startIdx, endIdx);
        return contextPages.join('\n\n');
    }
}

export const aiService = new AIService();
