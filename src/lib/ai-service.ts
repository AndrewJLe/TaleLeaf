export interface AIProvider {
  id: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  requiresApiKey: boolean;
  costEstimate?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai-gpt4o-mini",
    name: "OpenAI GPT-4o Mini",
    description: "Fast and affordable, great for most tasks",
    tier: "premium",
    requiresApiKey: true,
    costEstimate: "~$0.15/1M tokens",
  },
  {
    id: "openai-gpt4o",
    name: "OpenAI GPT-4o",
    description: "Most capable model, best for complex analysis",
    tier: "premium",
    requiresApiKey: true,
    costEstimate: "~$5/1M tokens",
  },
  {
    id: "anthropic-claude",
    name: "Anthropic Claude Sonnet",
    description: "Excellent for long-form text analysis",
    tier: "premium",
    requiresApiKey: true,
    costEstimate: "~$3/1M tokens",
  },
];

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type ApiKeyStatus = "active" | "inactive";

export interface StoredApiKey {
  id: string;
  providerId: string;
  name: string;
  secret: string;
  status: ApiKeyStatus;
  createdAt: number;
  lastUsedAt?: number;
}

export interface AISettings {
  provider: string;
  /**
   * @deprecated legacy direct provider -> key mapping kept for migration fallback
   */
  apiKeys: Record<string, string>;
  storedApiKeys: StoredApiKey[];
  providerKeyMap: Record<string, string | null>;
}

export interface TokenEstimate {
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  provider: string;
}

interface ChatOptions {
  systemPromptOverride?: string;
}

export interface RateLimitInfo {
  provider: string;
  tokensPerMinute: number; // TPM limit
  tokensUsed: number; // Current bucket usage
  tokensRequested: number; // Tokens for this request
  resetTime?: string; // When the rate limit resets
  retryAfter?: number; // Seconds to wait before retry
}

export interface TokenBucketStatus {
  used: number; // Tokens currently in window (from API)
  limit: number; // Rate limit (TPM)
  available: number; // Remaining capacity
  drainRate: number; // Tokens per second theoretical drain
  lastUpdate: number; // Timestamp of last update
  provider: string; // Which provider's limit
  isSimulated: boolean; // Whether this is simulated vs actual API data
  retryAfter?: number; // Seconds until next request allowed (from API)
}

class AIService {
  private settings: AISettings = {
    provider: "openai-gpt4o-mini",
    apiKeys: {},
    storedApiKeys: [],
    providerKeyMap: {},
  };

  private tokenBuckets: Map<string, TokenBucketStatus> = new Map();
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor() {
    // Load settings from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("taleleaf:ai-settings");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }

      this.ensureSettingsShape();
      this.migrateLegacyApiKeys();

      const savedBuckets = localStorage.getItem("taleleaf:token-buckets");
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

  private persistSettings() {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "taleleaf:ai-settings",
        JSON.stringify(this.settings),
      );
    }
  }

  private ensureSettingsShape() {
    if (!this.settings.apiKeys) {
      this.settings.apiKeys = {};
    }
    if (!Array.isArray(this.settings.storedApiKeys)) {
      this.settings.storedApiKeys = [];
    }
    if (
      !this.settings.providerKeyMap ||
      typeof this.settings.providerKeyMap !== "object"
    ) {
      this.settings.providerKeyMap = {};
    }
  }

  private migrateLegacyApiKeys() {
    const legacyEntries = Object.entries(this.settings.apiKeys || {});
    if (!legacyEntries.length) {
      return;
    }

    let migrated = false;
    legacyEntries.forEach(([providerId, secret]) => {
      if (!secret) {
        return;
      }

      const alreadyExists = this.settings.storedApiKeys.some(
        (k) => k.providerId === providerId && k.secret === secret,
      );
      if (alreadyExists) {
        return;
      }

      const provider = AI_PROVIDERS.find((p) => p.id === providerId);
      const newKey: StoredApiKey = {
        id: this.generateKeyId(),
        providerId,
        name: provider ? `${provider.name} Key` : "API Key",
        secret,
        status: "active",
        createdAt: Date.now(),
      };

      this.settings.storedApiKeys.push(newKey);
      if (!this.settings.providerKeyMap[providerId]) {
        this.settings.providerKeyMap[providerId] = newKey.id;
      }

      migrated = true;
    });

    if (migrated) {
      this.persistSettings();
    }
  }

  private generateKeyId(): string {
    const random = Math.random().toString(36).slice(2, 10);
    try {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        return crypto.randomUUID();
      }
    } catch {
      // Ignore and fall back to random string
    }
    return `key_${random}`;
  }

  private getProviderAliases(providerId: string): string[] {
    if (providerId.startsWith("openai-")) {
      return ["openai-gpt4o-mini", "openai-gpt4o"];
    }
    return [providerId];
  }

  private findStoredKeyById(id?: string | null): StoredApiKey | undefined {
    if (!id) {
      return undefined;
    }
    return this.settings.storedApiKeys.find((key) => key.id === id);
  }

  private syncLegacyApiKey(providerId: string) {
    const directSelection = this.findStoredKeyById(
      this.settings.providerKeyMap[providerId] || null,
    );
    if (directSelection) {
      this.settings.apiKeys[providerId] = directSelection.secret;
    } else {
      delete this.settings.apiKeys[providerId];
    }
  }

  getStoredApiKeys(providerId?: string): StoredApiKey[] {
    const list = providerId
      ? this.settings.storedApiKeys.filter(
          (key) => key.providerId === providerId,
        )
      : this.settings.storedApiKeys;

    return list.map((key) => ({ ...key }));
  }

  addStoredApiKey(input: {
    name: string;
    providerId: string;
    secret: string;
    status?: ApiKeyStatus;
  }): StoredApiKey {
    const key: StoredApiKey = {
      id: this.generateKeyId(),
      providerId: input.providerId,
      name: input.name || "API Key",
      secret: input.secret,
      status: input.status ?? "active",
      createdAt: Date.now(),
    };

    this.settings.storedApiKeys = [...this.settings.storedApiKeys, key];

    if (!this.settings.providerKeyMap[input.providerId]) {
      this.settings.providerKeyMap[input.providerId] = key.id;
    }

    this.syncLegacyApiKey(input.providerId);
    this.persistSettings();
    return key;
  }

  updateStoredApiKey(
    id: string,
    updates: Partial<Omit<StoredApiKey, "id" | "providerId" | "createdAt">>,
  ): StoredApiKey | null {
    const idx = this.settings.storedApiKeys.findIndex((k) => k.id === id);
    if (idx === -1) {
      return null;
    }

    const original = this.settings.storedApiKeys[idx];
    const updated: StoredApiKey = {
      ...original,
      ...updates,
      lastUsedAt: updates.lastUsedAt ?? original.lastUsedAt,
    };

    this.settings.storedApiKeys = [
      ...this.settings.storedApiKeys.slice(0, idx),
      updated,
      ...this.settings.storedApiKeys.slice(idx + 1),
    ];

    const wasSelected =
      this.settings.providerKeyMap[original.providerId] === id;
    let selectionChanged = false;

    if (wasSelected && updates.status === "inactive") {
      this.settings.providerKeyMap[original.providerId] = null;
      selectionChanged = true;
    }

    if (wasSelected && updates.secret !== undefined) {
      selectionChanged = true;
    }

    if (selectionChanged) {
      this.syncLegacyApiKey(original.providerId);
    }

    this.persistSettings();
    return updated;
  }

  deleteStoredApiKey(id: string) {
    const key = this.settings.storedApiKeys.find((k) => k.id === id);
    if (!key) {
      return;
    }

    this.settings.storedApiKeys = this.settings.storedApiKeys.filter(
      (k) => k.id !== id,
    );

    if (this.settings.providerKeyMap[key.providerId] === id) {
      this.settings.providerKeyMap[key.providerId] = null;
      this.syncLegacyApiKey(key.providerId);
    }

    this.persistSettings();
  }

  selectApiKeyForProvider(providerId: string, keyId: string | null) {
    if (keyId) {
      const key = this.settings.storedApiKeys.find(
        (k) => k.id === keyId && k.providerId === providerId,
      );
      if (!key) {
        throw new Error("API key does not match provider");
      }
      this.settings.providerKeyMap[providerId] = keyId;
    } else {
      this.settings.providerKeyMap[providerId] = null;
    }

    this.syncLegacyApiKey(providerId);
    this.persistSettings();
  }

  getSelectedApiKeyId(providerId: string): string | null {
    return this.settings.providerKeyMap[providerId] || null;
  }

  private getDirectSelectedApiKey(
    providerId: string,
  ): StoredApiKey | undefined {
    return this.findStoredKeyById(this.getSelectedApiKeyId(providerId));
  }

  private getOperationalApiKey(providerId: string): StoredApiKey | undefined {
    const aliases = this.getProviderAliases(providerId);

    for (const alias of aliases) {
      const key = this.findStoredKeyById(
        this.settings.providerKeyMap[alias] || null,
      );
      if (key && key.status === "active") {
        return key;
      }
    }

    for (const alias of aliases) {
      const activeKeys = this.settings.storedApiKeys.filter(
        (k) => k.providerId === alias && k.status === "active",
      );
      if (activeKeys.length === 1) {
        const fallback = activeKeys[0];
        this.settings.providerKeyMap[alias] = fallback.id;
        this.syncLegacyApiKey(alias);
        this.persistSettings();
        return fallback;
      }
    }

    return undefined;
  }

  getSelectedApiKey(providerId: string): StoredApiKey | undefined {
    const key = this.getDirectSelectedApiKey(providerId);
    return key ? { ...key } : undefined;
  }

  getSelectedApiKeySecret(providerId: string): string | null {
    const operational = this.getOperationalApiKey(providerId);
    if (operational) {
      return operational.secret;
    }

    const aliases = this.getProviderAliases(providerId);
    for (const alias of aliases) {
      const legacy = this.settings.apiKeys[alias];
      if (legacy) {
        return legacy;
      }
    }

    return null;
  }

  recordApiKeyUsage(providerId: string) {
    const key = this.getOperationalApiKey(providerId);
    if (!key) {
      return;
    }

    this.updateStoredApiKey(key.id, { lastUsedAt: Date.now() });
  }

  // Rate limit management methods
  private initializeRateLimits() {
    const defaultLimits = {
      "openai-gpt4o-mini": { limit: 100000, drainRate: 100000 / 60 }, // 100K TPM = ~1667 tokens/second
      "openai-gpt4o": { limit: 30000, drainRate: 30000 / 60 }, // 30K TPM = 500 tokens/second
      "anthropic-claude": { limit: 50000, drainRate: 50000 / 60 }, // Estimated 50K TPM = ~833 tokens/second
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
          isSimulated: true,
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
      lastUpdate: now,
    };

    this.tokenBuckets.set(provider, updatedBucket);
    this.saveTokenBuckets();
  }

  private saveTokenBuckets() {
    if (typeof window !== "undefined") {
      const bucketsObj = Object.fromEntries(this.tokenBuckets);
      localStorage.setItem(
        "taleleaf:token-buckets",
        JSON.stringify(bucketsObj),
      );
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
      lastUpdate: now,
    };
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  canMakeRequest(
    estimatedTokens: number,
    provider?: string,
  ): { allowed: boolean; reason?: string; waitTime?: number } {
    const bucket = this.getTokenBucketStatus(provider);

    if (!bucket) {
      return { allowed: true }; // No bucket info, allow request
    }

    if (bucket.available < estimatedTokens) {
      const waitTime = Math.ceil(
        (estimatedTokens - bucket.available) / bucket.drainRate,
      );
      return {
        allowed: false,
        reason: `Rate limit would be exceeded. Need ${estimatedTokens} tokens but only ${Math.round(bucket.available)} available.`,
        waitTime,
      };
    }

    return { allowed: true };
  }

  private parseRateLimitError(
    error: string,
    provider: string,
  ): RateLimitInfo | null {
    // Parse OpenAI 429 error message
    const match = error.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
    if (match) {
      const [, limit, used, requested] = match;

      // Extract retry time if available
      const retryMatch = error.match(/try again in (\d+)h(\d+)m([\d.]+)s/);
      let retryAfter = 0;
      if (retryMatch) {
        const [, hours, minutes, seconds] = retryMatch;
        retryAfter =
          parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      }

      const rateLimitInfo: RateLimitInfo = {
        provider,
        tokensPerMinute: parseInt(limit),
        tokensUsed: parseInt(used),
        tokensRequested: parseInt(requested),
        retryAfter,
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
          retryAfter,
        });
        this.saveTokenBuckets();
      }

      return rateLimitInfo;
    }

    return null;
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is an approximation - actual tokenization varies by model
    return Math.ceil(text.length / 4);
  }

  getProviderCosts(): Record<string, { input: number; output: number }> {
    // Cost per 1M tokens (input, output)
    return {
      "openai-gpt4o-mini": { input: 0.15, output: 0.6 },
      "openai-gpt4o": { input: 5.0, output: 15.0 },
      "anthropic-claude": { input: 3.0, output: 15.0 },
    };
  }

  calculateActualCost(
    inputTokens: number,
    outputTokens: number,
    provider: string,
  ): number {
    const costs = this.getProviderCosts();
    const providerCost = costs[provider];

    if (!providerCost) return 0;

    return (
      (inputTokens * providerCost.input + outputTokens * providerCost.output) /
      1000000
    );
  }

  updateSettings(settings: Partial<AISettings>) {
    const next: AISettings = {
      provider: settings.provider ?? this.settings.provider,
      apiKeys:
        settings.apiKeys !== undefined
          ? { ...settings.apiKeys }
          : { ...this.settings.apiKeys },
      storedApiKeys:
        settings.storedApiKeys !== undefined
          ? [...settings.storedApiKeys]
          : [...this.settings.storedApiKeys],
      providerKeyMap:
        settings.providerKeyMap !== undefined
          ? { ...settings.providerKeyMap }
          : { ...this.settings.providerKeyMap },
    };

    this.settings = next;
    this.ensureSettingsShape();
    this.persistSettings();
  }

  getSettings(): AISettings {
    return {
      ...this.settings,
      apiKeys: { ...this.settings.apiKeys },
      storedApiKeys: [...this.settings.storedApiKeys],
      providerKeyMap: { ...this.settings.providerKeyMap },
    };
  }

  async chat(
    messages: AIMessage[],
    contextText: string,
    options?: ChatOptions,
  ): Promise<string> {
    const provider = AI_PROVIDERS.find((p) => p.id === this.settings.provider);
    if (!provider) {
      throw new Error("Invalid AI provider selected");
    }

    let activeApiKey: string | null = null;
    // Check if API key is required but missing
    if (provider.requiresApiKey) {
      activeApiKey = this.getSelectedApiKeySecret(provider.id);
      if (!activeApiKey) {
        throw new Error(
          `API key required for ${provider.name}. Please configure it in settings.`,
        );
      }
    }

    switch (provider.id) {
      case "openai-gpt4o-mini":
      case "openai-gpt4o":
        return this.chatWithOpenAI(
          messages,
          contextText,
          provider.id,
          activeApiKey!,
          options,
        );
      case "anthropic-claude":
        return this.chatWithAnthropic(
          messages,
          contextText,
          activeApiKey!,
          options,
        );
      default:
        throw new Error(`Provider ${provider.id} not implemented yet`);
    }
  }

  private async chatWithOpenAI(
    messages: AIMessage[],
    contextText: string,
    model: string,
    apiKey: string,
    options?: ChatOptions,
  ): Promise<string> {
    const modelName = model === "openai-gpt4o" ? "gpt-4o" : "gpt-4o-mini";

    // Estimate tokens for this request
    const systemPrompt =
      options?.systemPromptOverride ?? this.buildSystemPrompt(contextText);

    const nonEmptyMessages = messages.filter(
      (m) => m.content && m.content.trim().length > 0,
    );
    const estimatedInputTokens =
      this.estimateTokens(systemPrompt) +
      nonEmptyMessages.reduce(
        (sum, m) => sum + this.estimateTokens(m.content),
        0,
      );
    const estimatedOutputTokens = 500; // max_tokens setting
    const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;

    // Check rate limit before making request
    const rateLimitCheck = this.canMakeRequest(totalEstimatedTokens, model);
    if (!rateLimitCheck.allowed) {
      const waitMinutes = rateLimitCheck.waitTime
        ? Math.ceil(rateLimitCheck.waitTime / 60)
        : 1;
      throw new Error(
        `Rate limit would be exceeded. ${rateLimitCheck.reason} Please wait ${waitMinutes} minute(s) before trying again.`,
      );
    }

    try {
      const systemMessage: AIMessage = {
        role: "system",
        content: systemPrompt,
      };

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            messages: [systemMessage, ...messages],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        },
      );

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
        // Update rate limit bucket with actual usage
        this.updateTokenBucket(model, result.usage.total_tokens);

        this.recordApiKeyUsage(model);

        // Clear any previous rate limit info on successful request
        this.rateLimitInfo = null;
      }

      return (
        result.choices[0]?.message?.content ||
        "Sorry, I could not generate a response."
      );
    } catch (error) {
      console.error("OpenAI error:", error);
      throw error;
    }
  }

  private async chatWithAnthropic(
    messages: AIMessage[],
    contextText: string,
    apiKey: string,
    options?: ChatOptions,
  ): Promise<string> {
    try {
      // Convert messages to Anthropic format
      const systemPrompt =
        options?.systemPromptOverride ?? this.buildSystemPrompt(contextText);

      const userMessages = messages.filter((m) => m.role === "user");
      const lastUserMessage =
        userMessages[userMessages.length - 1]?.content || "";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: "user", content: lastUserMessage }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      this.recordApiKeyUsage("anthropic-claude");
      return (
        result.content[0]?.text || "Sorry, I could not generate a response."
      );
    } catch (error) {
      console.error("Anthropic error:", error);
      throw error;
    }
  }

  extractContextText(
    book: any,
    windowStart: number,
    windowEnd: number,
  ): string {
    if (!book.uploads || book.uploads.length === 0) {
      return "No book content available.";
    }

    const upload = book.uploads[0];
    if (!upload.pages || upload.pages.length === 0) {
      return "No pages found in uploaded book.";
    }

    // Extract pages within the window (1-indexed)
    const startIdx = Math.max(0, windowStart - 1);
    const endIdx = Math.min(upload.pages.length, windowEnd);
    const contextPages = upload.pages.slice(startIdx, endIdx);
    return contextPages
      .map(
        (p: string, i: number) =>
          `=== Page ${startIdx + i + 1} ===\n${p && p.trim().length ? p : "(No text extracted for this page)"}\n`,
      )
      .join("\n");
  }

  extractContextTextChunked(
    book: any,
    windowStart: number,
    windowEnd: number,
    maxTokens: number = 8000,
  ): string {
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

    let currentChunk = "";
    for (const page of pages) {
      if ((currentChunk + page).length <= targetChars) {
        currentChunk += (currentChunk ? "\n\n" : "") + page;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        // If single page is too large, split by paragraphs
        if (page.length > targetChars) {
          const paragraphs = page.split("\n\n");
          for (const para of paragraphs) {
            if ((currentChunk + para).length <= targetChars) {
              currentChunk += (currentChunk ? "\n\n" : "") + para;
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

  getSystemPrompt(contextText: string): string {
    return this.buildSystemPrompt(contextText);
  }

  estimateContextTokens(
    book: any,
    windowStart: number,
    windowEnd: number,
  ): number {
    const contextText = this.extractContextText(book, windowStart, windowEnd);
    return this.estimateTokens(contextText);
  }

  // AI-powered content generation methods
  async generateCharacters(
    contextText: string,
  ): Promise<Array<{ name: string; notes: string }>> {
    const prompt = `Analyze the provided text and identify all characters mentioned. For each character, provide their name and a brief description including their role, personality traits, and relationships.

Text to analyze:
${contextText}

Return ONLY a JSON array of objects with "name" and "notes" properties. Example:
[{"name": "John Smith", "notes": "Protagonist, brave detective with a troubled past. Partner to Sarah."}]`;

    try {
      const response = await this.chat(
        [{ role: "user", content: prompt }],
        contextText,
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error("Error generating characters:", error);
      throw new Error("Failed to generate characters. Please try again.");
    }
  }

  async generateCharactersFromBook(
    book: any,
    windowStart: number,
    windowEnd: number,
  ): Promise<Array<{ name: string; notes: string }>> {
    // Use chunked context to avoid rate limits
    const contextText = this.extractContextTextChunked(
      book,
      windowStart,
      windowEnd,
      8000,
    );
    return this.generateCharacters(contextText);
  }

  async generateChapterSummary(
    contextText: string,
    chapterTitle?: string,
  ): Promise<string> {
    const prompt = `Create a concise chapter summary for the provided text. Focus on key events, character development, and plot advancement. Keep it spoiler-free by focusing on what happens rather than future implications.

${chapterTitle ? `Chapter: ${chapterTitle}` : "Chapter Content:"}

Text to summarize:
${contextText}

Provide a clear, informative summary in 2-3 paragraphs.`;

    try {
      const response = await this.chat(
        [{ role: "user", content: prompt }],
        contextText,
      );
      return response;
    } catch (error) {
      console.error("Error generating chapter summary:", error);
      throw new Error("Failed to generate chapter summary. Please try again.");
    }
  }

  async generateLocations(
    contextText: string,
  ): Promise<Array<{ name: string; notes: string }>> {
    const prompt = `Analyze the provided text and identify all locations, places, and settings mentioned. For each location, provide the name and a description including its significance to the story.

Text to analyze:
${contextText}

Return ONLY a JSON array of objects with "name" and "notes" properties. Example:
[{"name": "Misty Forest", "notes": "Dark woodland where the characters first meet the mysterious guide. Known for its dangerous creatures."}]`;

    try {
      const response = await this.chat(
        [{ role: "user", content: prompt }],
        contextText,
      );
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error("Error generating locations:", error);
      throw new Error("Failed to generate locations. Please try again.");
    }
  }

  async generateNotes(contextText: string, topic?: string): Promise<string> {
    const prompt = `Create insightful reading notes for the provided text. ${topic ? `Focus on: ${topic}` : "Include themes, literary devices, important quotes, and analysis points that would be helpful for understanding or discussing this text."}

Text to analyze:
${contextText}

Provide comprehensive notes with bullet points for easy reading.`;

    try {
      const response = await this.chat(
        [{ role: "user", content: prompt }],
        contextText,
      );
      return response;
    } catch (error) {
      console.error("Error generating notes:", error);
      throw new Error("Failed to generate notes. Please try again.");
    }
  }

  async enhanceCharacterProfile(
    characterName: string,
    contextText: string,
    existingNotes?: string,
  ): Promise<string> {
    const prompt = `Enhance the character profile for "${characterName}" based on the provided text. ${existingNotes ? `Current notes: ${existingNotes}` : "No existing notes."}

Text containing character information:
${contextText}

Provide an enhanced character description including personality, appearance, relationships, motivations, and character arc based on the text.`;

    try {
      const response = await this.chat(
        [{ role: "user", content: prompt }],
        contextText,
      );
      return response;
    } catch (error) {
      console.error("Error enhancing character profile:", error);
      throw new Error("Failed to enhance character profile. Please try again.");
    }
  }
}

export const aiService = new AIService();
