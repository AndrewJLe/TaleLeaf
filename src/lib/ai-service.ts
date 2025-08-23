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

export interface TokenEstimate {
    inputTokens: number;
    estimatedOutputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    provider: string;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    timestamp: number;
    action: string;
}

export interface TokenBudget {
    dailyLimit: number;    // dollars per day
    monthlyLimit: number;  // dollars per month
    warningThreshold: number; // percentage (0.8 = 80%)
}

export interface TokenStats {
    todayUsage: number;    // dollars spent today
    monthUsage: number;    // dollars spent this month
    sessionUsage: number;  // dollars spent this session
    usageHistory: TokenUsage[];
}

export interface RateLimitInfo {
    provider: string;
    tokensPerMinute: number;    // TPM limit
    tokensUsed: number;         // Current bucket usage
    tokensRequested: number;    // Tokens for this request
    resetTime?: string;         // When the rate limit resets
    retryAfter?: number;        // Seconds to wait before retry
}

export interface TokenBucketStatus {
    used: number;        // Tokens currently in window (from API)
    limit: number;       // Rate limit (TPM)
    available: number;   // Remaining capacity
    drainRate: number;   // Tokens per second theoretical drain
    lastUpdate: number;  // Timestamp of last update
    provider: string;    // Which provider's limit
    isSimulated: boolean; // Whether this is simulated vs actual API data
    retryAfter?: number; // Seconds until next request allowed (from API)
}

class AIService {
    private settings: AISettings = {
        provider: 'openai-gpt4o-mini',
        apiKeys: {}
    };

    private tokenBudget: TokenBudget = {
        dailyLimit: 5.00,     // $5 per day default
        monthlyLimit: 50.00,  // $50 per month default
        warningThreshold: 0.8 // 80% warning
    };

    private tokenStats: TokenStats = {
        todayUsage: 0,
        monthUsage: 0,
        sessionUsage: 0,
        usageHistory: []
    };

    private tokenBuckets: Map<string, TokenBucketStatus> = new Map();
    private rateLimitInfo: RateLimitInfo | null = null;

    constructor() {
        // Load settings from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('taleleaf:ai-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }

            const savedBudget = localStorage.getItem('taleleaf:token-budget');
            if (savedBudget) {
                this.tokenBudget = { ...this.tokenBudget, ...JSON.parse(savedBudget) };
            }

            const savedStats = localStorage.getItem('taleleaf:token-stats');
            if (savedStats) {
                const stats = JSON.parse(savedStats);
                this.tokenStats = { ...this.tokenStats, ...stats };
                // Reset daily usage if it's a new day
                this.checkAndResetDailyUsage();
            }

            const savedBuckets = localStorage.getItem('taleleaf:token-buckets');
            if (savedBuckets) {
                const buckets = JSON.parse(savedBuckets);
                Object.entries(buckets).forEach(([key, value]) => {
                    this.tokenBuckets.set(key, value as TokenBucketStatus);
                });
            }

            // Initialize default rate limits for known providers
            this.initializeRateLimits();
        }
    }

    // Rate limit management methods
    private initializeRateLimits() {
        const defaultLimits = {
            'openai-gpt4o-mini': { limit: 100000, drainRate: 100000 / 60 }, // 100K TPM = ~1667 tokens/second
            'openai-gpt4o': { limit: 30000, drainRate: 30000 / 60 },       // 30K TPM = 500 tokens/second
            'anthropic-claude': { limit: 50000, drainRate: 50000 / 60 }     // Estimated 50K TPM = ~833 tokens/second
        };

        Object.entries(defaultLimits).forEach(([provider, config]) => {
            if (!this.tokenBuckets.has(provider)) {
                this.tokenBuckets.set(provider, {
                    used: 0,
                    limit: config.limit,
                    available: config.limit,
                    drainRate: config.drainRate,
                    lastUpdate: Date.now(),
                    provider,
                    isSimulated: true
                });
            }
        });
    }

    private updateTokenBucket(provider: string, tokensUsed: number) {
        const bucket = this.tokenBuckets.get(provider);
        if (!bucket) return;

        const now = Date.now();
        const timeDiff = (now - bucket.lastUpdate) / 1000; // seconds

        // Drain tokens that have expired
        const drainedTokens = timeDiff * bucket.drainRate;
        const newUsed = Math.max(0, bucket.used - drainedTokens + tokensUsed);

        const updatedBucket: TokenBucketStatus = {
            ...bucket,
            used: newUsed,
            available: Math.max(0, bucket.limit - newUsed),
            lastUpdate: now
        };

        this.tokenBuckets.set(provider, updatedBucket);
        this.saveTokenBuckets();
    }

    private saveTokenBuckets() {
        if (typeof window !== 'undefined') {
            const bucketsObj = Object.fromEntries(this.tokenBuckets);
            localStorage.setItem('taleleaf:token-buckets', JSON.stringify(bucketsObj));
        }
    }

    getTokenBucketStatus(provider?: string): TokenBucketStatus | null {
        const targetProvider = provider || this.settings.provider;
        const bucket = this.tokenBuckets.get(targetProvider);

        if (!bucket) return null;

        // Update bucket with current drain
        const now = Date.now();
        const timeDiff = (now - bucket.lastUpdate) / 1000;
        const drainedTokens = timeDiff * bucket.drainRate;
        const currentUsed = Math.max(0, bucket.used - drainedTokens);

        return {
            ...bucket,
            used: currentUsed,
            available: Math.max(0, bucket.limit - currentUsed),
            lastUpdate: now
        };
    }

    getRateLimitInfo(): RateLimitInfo | null {
        return this.rateLimitInfo;
    }

    canMakeRequest(estimatedTokens: number, provider?: string): { allowed: boolean; reason?: string; waitTime?: number } {
        const bucket = this.getTokenBucketStatus(provider);

        if (!bucket) {
            return { allowed: true }; // No bucket info, allow request
        }

        if (bucket.available < estimatedTokens) {
            const waitTime = Math.ceil((estimatedTokens - bucket.available) / bucket.drainRate);
            return {
                allowed: false,
                reason: `Rate limit would be exceeded. Need ${estimatedTokens} tokens but only ${Math.round(bucket.available)} available.`,
                waitTime
            };
        }

        return { allowed: true };
    }

    private parseRateLimitError(error: string, provider: string): RateLimitInfo | null {
        // Parse OpenAI 429 error message
        const match = error.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
        if (match) {
            const [, limit, used, requested] = match;

            // Extract retry time if available
            const retryMatch = error.match(/try again in (\d+)h(\d+)m([\d.]+)s/);
            let retryAfter = 0;
            if (retryMatch) {
                const [, hours, minutes, seconds] = retryMatch;
                retryAfter = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
            }

            const rateLimitInfo: RateLimitInfo = {
                provider,
                tokensPerMinute: parseInt(limit),
                tokensUsed: parseInt(used),
                tokensRequested: parseInt(requested),
                retryAfter
            };

            // Update our bucket with actual usage data
            const bucket = this.tokenBuckets.get(provider);
            if (bucket) {
                this.tokenBuckets.set(provider, {
                    ...bucket,
                    used: parseInt(used),
                    limit: parseInt(limit),
                    available: Math.max(0, parseInt(limit) - parseInt(used)),
                    lastUpdate: Date.now(),
                    isSimulated: false,
                    retryAfter
                });
                this.saveTokenBuckets();
            }

            return rateLimitInfo;
        }

        return null;
    }

    // Token estimation utilities
    estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token for English text
        // This is an approximation - actual tokenization varies by model
        return Math.ceil(text.length / 4);
    }

    getProviderCosts(): Record<string, { input: number; output: number }> {
        // Cost per 1M tokens (input, output)
        return {
            'openai-gpt4o-mini': { input: 0.15, output: 0.60 },
            'openai-gpt4o': { input: 5.00, output: 15.00 },
            'anthropic-claude': { input: 3.00, output: 15.00 }
        };
    }

    estimateRequestCost(contextText: string, promptText: string, estimatedOutputTokens: number = 500): TokenEstimate {
        const provider = AI_PROVIDERS.find(p => p.id === this.settings.provider);
        const costs = this.getProviderCosts();
        const providerCost = costs[this.settings.provider];

        const systemPromptTokens = this.estimateTokens(this.buildSystemPrompt(contextText));

        const userPromptTokens = this.estimateTokens(promptText);
        const inputTokens = systemPromptTokens + userPromptTokens;
        const totalTokens = inputTokens + estimatedOutputTokens;

        const estimatedCost = providerCost
            ? (inputTokens * providerCost.input + estimatedOutputTokens * providerCost.output) / 1000000
            : 0;

        return {
            inputTokens,
            estimatedOutputTokens,
            totalTokens,
            estimatedCost,
            provider: provider?.name || 'Unknown'
        };
    }

    // Budget and usage tracking methods
    checkAndResetDailyUsage() {
        const today = new Date().toDateString();
        const lastUsageDate = this.tokenStats.usageHistory[this.tokenStats.usageHistory.length - 1];

        if (!lastUsageDate || new Date(lastUsageDate.timestamp).toDateString() !== today) {
            this.tokenStats.todayUsage = 0;
            this.saveTokenStats();
        }
    }

    updateTokenBudget(budget: Partial<TokenBudget>) {
        this.tokenBudget = { ...this.tokenBudget, ...budget };
        if (typeof window !== 'undefined') {
            localStorage.setItem('taleleaf:token-budget', JSON.stringify(this.tokenBudget));
        }
    }

    getTokenBudget(): TokenBudget {
        return this.tokenBudget;
    }

    getTokenStats(): TokenStats {
        return this.tokenStats;
    }

    recordTokenUsage(inputTokens: number, outputTokens: number, cost: number, action: string) {
        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            cost,
            timestamp: Date.now(),
            action
        };

        this.tokenStats.usageHistory.push(usage);
        this.tokenStats.sessionUsage += cost;
        this.tokenStats.todayUsage += cost;
        this.tokenStats.monthUsage += cost;

        // Keep only last 100 usage records
        if (this.tokenStats.usageHistory.length > 100) {
            this.tokenStats.usageHistory = this.tokenStats.usageHistory.slice(-100);
        }

        this.saveTokenStats();
    }

    private saveTokenStats() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('taleleaf:token-stats', JSON.stringify(this.tokenStats));
        }
    }

    getRemainingBudget(): { daily: number; monthly: number; sessionWarning: boolean } {
        const dailyRemaining = Math.max(0, this.tokenBudget.dailyLimit - this.tokenStats.todayUsage);
        const monthlyRemaining = Math.max(0, this.tokenBudget.monthlyLimit - this.tokenStats.monthUsage);

        const sessionWarning = this.tokenStats.sessionUsage > (this.tokenBudget.dailyLimit * 0.2); // 20% of daily limit in one session

        return {
            daily: dailyRemaining,
            monthly: monthlyRemaining,
            sessionWarning
        };
    }

    isOverBudget(): { daily: boolean; monthly: boolean; warning: boolean } {
        const dailyPercent = this.tokenStats.todayUsage / this.tokenBudget.dailyLimit;
        const monthlyPercent = this.tokenStats.monthUsage / this.tokenBudget.monthlyLimit;

        return {
            daily: this.tokenStats.todayUsage >= this.tokenBudget.dailyLimit,
            monthly: this.tokenStats.monthUsage >= this.tokenBudget.monthlyLimit,
            warning: dailyPercent >= this.tokenBudget.warningThreshold || monthlyPercent >= this.tokenBudget.warningThreshold
        };
    }

    calculateActualCost(inputTokens: number, outputTokens: number, provider: string): number {
        const costs = this.getProviderCosts();
        const providerCost = costs[provider];

        if (!providerCost) return 0;

        return (inputTokens * providerCost.input + outputTokens * providerCost.output) / 1000000;
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

        // Estimate tokens for this request
        const systemPrompt = this.buildSystemPrompt(contextText);

        const estimatedInputTokens = this.estimateTokens(systemPrompt + messages.map(m => m.content).join(''));
        const estimatedOutputTokens = 500; // max_tokens setting
        const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;

        // Check rate limit before making request
        const rateLimitCheck = this.canMakeRequest(totalEstimatedTokens, model);
        if (!rateLimitCheck.allowed) {
            const waitMinutes = rateLimitCheck.waitTime ? Math.ceil(rateLimitCheck.waitTime / 60) : 1;
            throw new Error(`Rate limit would be exceeded. ${rateLimitCheck.reason} Please wait ${waitMinutes} minute(s) before trying again.`);
        }

        try {
            const systemMessage: AIMessage = {
                role: 'system',
                content: systemPrompt
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

                // Parse rate limit error and update our tracking
                if (response.status === 429) {
                    this.rateLimitInfo = this.parseRateLimitError(errorData, model);
                    if (this.rateLimitInfo) {
                        // Update bucket with actual usage from error message
                        this.updateTokenBucket(model, this.rateLimitInfo.tokensRequested);
                    }
                }

                throw new Error(`OpenAI API error ${response.status}: ${errorData}`);
            }

            const result = await response.json();

            // Record actual token usage and update bucket
            if (result.usage) {
                const cost = this.calculateActualCost(result.usage.prompt_tokens, result.usage.completion_tokens, this.settings.provider);
                this.recordTokenUsage(result.usage.prompt_tokens, result.usage.completion_tokens, cost, 'chat');

                // Update rate limit bucket with actual usage
                this.updateTokenBucket(model, result.usage.total_tokens);

                // Clear any previous rate limit info on successful request
                this.rateLimitInfo = null;
            }

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
            const systemPrompt = this.buildSystemPrompt(contextText);

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
        return contextPages
            .map((p: string, i: number) => `=== Page ${startIdx + i + 1} ===\n${p && p.trim().length ? p : '(No text extracted for this page)'}\n`)
            .join('\n');
    }

    extractContextTextChunked(book: any, windowStart: number, windowEnd: number, maxTokens: number = 8000): string {
        const fullText = this.extractContextText(book, windowStart, windowEnd);
        const estimatedTokens = this.estimateTokens(fullText);

        // If under the limit, return full text
        if (estimatedTokens <= maxTokens) {
            return fullText;
        }

        // Otherwise, chunk the text to fit within token limit
        const targetChars = maxTokens * 4; // Rough conversion back to characters
        const chunks: string[] = [];

        // Split by pages first, then by paragraphs if needed
        const upload = book.uploads[0];
        const startIdx = Math.max(0, windowStart - 1);
        const endIdx = Math.min(upload.pages.length, windowEnd);
        const pages = upload.pages.slice(startIdx, endIdx);

        let currentChunk = '';
        for (const page of pages) {
            if ((currentChunk + page).length <= targetChars) {
                currentChunk += (currentChunk ? '\n\n' : '') + page;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }

                // If single page is too large, split by paragraphs
                if (page.length > targetChars) {
                    const paragraphs = page.split('\n\n');
                    for (const para of paragraphs) {
                        if ((currentChunk + para).length <= targetChars) {
                            currentChunk += (currentChunk ? '\n\n' : '') + para;
                        } else {
                            if (currentChunk) {
                                chunks.push(currentChunk);
                                currentChunk = para;
                            } else {
                                // Single paragraph too large, truncate
                                chunks.push(para.substring(0, targetChars));
                            }
                        }
                    }
                } else {
                    currentChunk = page;
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        // For character generation, prioritize the first chunk (usually has character introductions)
        return chunks[0] || fullText.substring(0, targetChars);
    }

    private buildSystemPrompt(contextText: string): string {
        return `You are a helpful reading assistant. Answer questions about the book based ONLY on the provided context pages below. Never reveal or assume information outside the given context to avoid spoilers.

Each page is delimited like: === Page N ===. When the user asks about a specific page number X:
- If Page X is present, reference ONLY that page's content and summarize/answer.
- If Page X is not in the provided context, respond that you do not have Page X yet.
- If the user asks generally (not page-specific), you may synthesize across the included pages.
- Do NOT guess content from pages not provided.

Context pages:
${contextText}

Guidelines:
- Only use information from the provided context
- If asked about events outside the context, politely say you don't have that information yet
- Be helpful and engaging while respecting spoiler boundaries
- Provide detailed analysis when possible using available context`;
    }

    estimateContextTokens(book: any, windowStart: number, windowEnd: number): number {
        const contextText = this.extractContextText(book, windowStart, windowEnd);
        return this.estimateTokens(contextText);
    }

    // AI-powered content generation methods
    async generateCharacters(contextText: string): Promise<Array<{ name: string, notes: string }>> {
        const prompt = `Analyze the provided text and identify all characters mentioned. For each character, provide their name and a brief description including their role, personality traits, and relationships.

Text to analyze:
${contextText}

Return ONLY a JSON array of objects with "name" and "notes" properties. Example:
[{"name": "John Smith", "notes": "Protagonist, brave detective with a troubled past. Partner to Sarah."}]`;

        try {
            const estimate = this.estimateRequestCost(contextText, prompt);
            const response = await this.chat([{ role: 'user', content: prompt }], contextText);

            // If we didn't get actual usage from the API call, record the estimate
            if (this.tokenStats.usageHistory.length === 0 ||
                this.tokenStats.usageHistory[this.tokenStats.usageHistory.length - 1].action !== 'chat') {
                this.recordTokenUsage(estimate.inputTokens, estimate.estimatedOutputTokens, estimate.estimatedCost, 'generate_characters');
            }

            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        } catch (error) {
            console.error('Error generating characters:', error);
            throw new Error('Failed to generate characters. Please try again.');
        }
    }

    async generateCharactersFromBook(book: any, windowStart: number, windowEnd: number): Promise<Array<{ name: string, notes: string }>> {
        // Use chunked context to avoid rate limits
        const contextText = this.extractContextTextChunked(book, windowStart, windowEnd, 8000);
        return this.generateCharacters(contextText);
    }

    async generateChapterSummary(contextText: string, chapterTitle?: string): Promise<string> {
        const prompt = `Create a concise chapter summary for the provided text. Focus on key events, character development, and plot advancement. Keep it spoiler-free by focusing on what happens rather than future implications.

${chapterTitle ? `Chapter: ${chapterTitle}` : 'Chapter Content:'}

Text to summarize:
${contextText}

Provide a clear, informative summary in 2-3 paragraphs.`;

        try {
            const response = await this.chat([{ role: 'user', content: prompt }], contextText);
            return response;
        } catch (error) {
            console.error('Error generating chapter summary:', error);
            throw new Error('Failed to generate chapter summary. Please try again.');
        }
    }

    async generateLocations(contextText: string): Promise<Array<{ name: string, notes: string }>> {
        const prompt = `Analyze the provided text and identify all locations, places, and settings mentioned. For each location, provide the name and a description including its significance to the story.

Text to analyze:
${contextText}

Return ONLY a JSON array of objects with "name" and "notes" properties. Example:
[{"name": "Misty Forest", "notes": "Dark woodland where the characters first meet the mysterious guide. Known for its dangerous creatures."}]`;

        try {
            const response = await this.chat([{ role: 'user', content: prompt }], contextText);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        } catch (error) {
            console.error('Error generating locations:', error);
            throw new Error('Failed to generate locations. Please try again.');
        }
    }

    async generateNotes(contextText: string, topic?: string): Promise<string> {
        const prompt = `Create insightful reading notes for the provided text. ${topic ? `Focus on: ${topic}` : 'Include themes, literary devices, important quotes, and analysis points that would be helpful for understanding or discussing this text.'}

Text to analyze:
${contextText}

Provide comprehensive notes with bullet points for easy reading.`;

        try {
            const response = await this.chat([{ role: 'user', content: prompt }], contextText);
            return response;
        } catch (error) {
            console.error('Error generating notes:', error);
            throw new Error('Failed to generate notes. Please try again.');
        }
    }

    async enhanceCharacterProfile(characterName: string, contextText: string, existingNotes?: string): Promise<string> {
        const prompt = `Enhance the character profile for "${characterName}" based on the provided text. ${existingNotes ? `Current notes: ${existingNotes}` : 'No existing notes.'}

Text containing character information:
${contextText}

Provide an enhanced character description including personality, appearance, relationships, motivations, and character arc based on the text.`;

        try {
            const response = await this.chat([{ role: 'user', content: prompt }], contextText);
            return response;
        } catch (error) {
            console.error('Error enhancing character profile:', error);
            throw new Error('Failed to enhance character profile. Please try again.');
        }
    }
}

export const aiService = new AIService();
