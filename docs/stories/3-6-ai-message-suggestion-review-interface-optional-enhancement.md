# Story 3.6: AI Message Suggestion Review Interface (Optional Enhancement)

**Epic:** 3 - Enhanced Message Experience
**Story ID:** 3.6
**Status:** skipped (no OpenAI dependency desired)
**Assignee:** Dev (Frank)
**Created:** 2025-11-05
**Updated:** 2025-11-06
**Sprint:** Epic 3 Implementation
**Priority:** Optional Enhancement

---

## User Story

**As** the app creator (Frank)
**I want** to review AI-generated message suggestions and approve/reject them
**So that** I can quickly expand the library with quality-controlled content

---

## Story Context

### Epic Goal

Expand the message library to 365 unique messages, implement intuitive swipe navigation for browsing message history, and create an admin interface for custom message management.

### Story Purpose

Story 3.6 is an **optional enhancement** that introduces AI-powered content generation to accelerate custom message library growth. While Stories 3.4-3.5 provide complete manual CRUD operations for custom messages, this story adds intelligent assistance through OpenAI's GPT models to generate contextually appropriate love messages based on category, tone, and existing message patterns.

The human-in-the-loop review process ensures quality control: AI generates suggestions, you review and curate, only approved messages enter the rotation. This hybrid approach combines AI's creative output volume with human judgment for emotional authenticity. The feature is designed to be cost-conscious with built-in rate limiting (default: 5 generation sessions per day, 10 suggestions per session) to prevent runaway API expenses.

**Why Optional:** This story is marked optional because:
1. Manual custom message creation (Story 3.4-3.5) fully satisfies the core requirement
2. Requires external API dependency (OpenAI) and associated costs
3. Adds complexity without being essential to MVP functionality
4. Can be implemented post-launch based on actual usage patterns

**Implementation Decision:** Since this is optional and the argument "yolo" was provided, we're proceeding with drafting the story for future consideration, but it should NOT be prioritized over Epic 4 stories for actual development.

### Position in Epic

- ✅ **Story 3.1** (Complete): 365-message library created
- ✅ **Story 3.2** (Complete): Swipe gesture UI implemented
- ✅ **Story 3.3** (Complete): Message history state management
- ✅ **Story 3.4** (Complete): Admin interface UI for custom message management with LocalStorage
- ✅ **Story 3.5** (Complete): Custom message IndexedDB persistence and rotation integration
- 🔄 **Story 3.6** (Current, Optional): AI message suggestion review interface

### Dependencies

**Requires:**
- ✅ Story 3.5 complete: Custom message service and IndexedDB persistence operational
- ✅ Story 3.4 complete: Admin panel UI components functional
- ✅ Epic 1 complete: Stable foundation with working IndexedDB
- 🔑 External: OpenAI API key configured in environment variables

**Enables:**
- Rapid expansion of custom message library (10+ messages in minutes vs. manual writing)
- A/B testing different message styles and tones
- Future: Fine-tuned models on your relationship's language patterns

### Integration Points

**OpenAI API Integration:**
- Use `openai` npm package (^4.x) for GPT-3.5-turbo or GPT-4 API calls
- API key stored in environment variable: `VITE_OPENAI_API_KEY`
- Prompt engineering: category-specific templates with 2-3 example messages for context
- Response parsing: Extract 10 message suggestions from GPT completion

**Admin Panel UI Extension:**
- Add "AI Suggestions" section in AdminPanel (new tab or expandable section)
- Component: `AISuggestionPanel` with generation form and suggestion review list
- Reuse existing modal patterns (Framer Motion AnimatePresence)
- Reuse existing button/form styles from Story 3.4 components

**Custom Message Integration:**
- Accepted suggestions use existing `customMessageService.create()` from Story 3.5
- Suggestions saved with `active: false` (draft status) by default
- User can activate drafts after reviewing in main message list
- Metadata: `createdBy: 'ai'` field to distinguish AI vs manually written messages

**Rate Limiting Strategy:**
- Track generation requests in LocalStorage: `ai-suggestion-usage` key
- Structure: `{ date: string, count: number, lastRequest: timestamp }`
- Daily limit: 5 generation sessions (50 suggestions max per day)
- Cost estimation: ~$0.01 per 10 suggestions (GPT-3.5-turbo pricing)
- Display remaining quota in UI before generation

---

## Acceptance Criteria

### AC-3.6.1: Admin Panel Includes "Generate Suggestions" Button

**Given** admin panel is open
**When** user navigates to AI Suggestions section
**Then** a "Generate Suggestions" button SHALL be visible and functional

**Validation:**
- Button displays with icon (e.g., sparkles/magic wand icon from lucide-react)
- Button disabled if daily limit reached (5 sessions)
- Tooltip shows remaining quota: "3/5 generations remaining today"
- Button click opens generation form modal

---

### AC-3.6.2: Uses OpenAI API to Generate 10 Message Suggestions

**Given** user clicks "Generate Suggestions" and configures parameters
**When** user submits generation form
**Then** system SHALL call OpenAI API and return 10 contextually appropriate message suggestions

**Requirements:**
- Generation form includes:
  - Category dropdown (reasons, memories, affirmations, future-plans, custom)
  - Tone selector (romantic, playful, heartfelt) - optional
  - Count input (default: 10, range: 5-20)
- API call uses GPT-3.5-turbo model (cost optimization)
- Prompt template includes:
  - Category context
  - 2-3 example messages from existing library (same category)
  - Tone instructions
  - Length constraint (max 500 characters per message)
- Response parsed into array of MessageSuggestion objects
- Loading indicator shown during API call (3-10 seconds typical)
- Error handling: API failures, rate limits, invalid responses

**Validation:**
- Fill form with category "reasons", tone "romantic", count 10
- Click "Generate" → loading spinner appears
- After 5-10 seconds → 10 suggestions displayed in list
- Each suggestion has text, category, confidence score (optional)
- Messages are contextually relevant to selected category
- Messages follow tone guidance (romantic vs. playful)

---

### AC-3.6.3: Each Suggestion Displayed with "Accept" and "Reject" Buttons

**Given** AI suggestions are generated and displayed
**When** user reviews each suggestion
**Then** each suggestion SHALL have clear accept/reject action buttons

**Requirements:**
- Suggestion card displays:
  - Message text (with character count)
  - Category badge
  - Confidence score indicator (optional, if provided by API)
  - Two buttons: "Accept ✓" (green) and "Reject ✗" (red)
- Buttons styled consistently with existing admin panel buttons
- Hover states provide visual feedback
- Keyboard navigation supported (tab through suggestions, enter to accept, delete to reject)

**Validation:**
- Generate 10 suggestions
- Each card displays complete message text
- Category badge matches selected category
- Both Accept and Reject buttons visible and clickable
- Hover over Accept → button highlights green
- Hover over Reject → button highlights red

---

### AC-3.6.4: Accepted Messages Added to Custom Message Library as Drafts

**Given** user reviews AI suggestion and clicks "Accept"
**When** accept action is triggered
**Then** the message SHALL be saved to IndexedDB as a draft custom message

**Requirements:**
- Accepted suggestion calls `customMessageService.create(input)`
- Message saved with:
  - `text`: suggestion text
  - `category`: selected category
  - `isCustom`: true
  - `active`: false (draft status, not in rotation yet)
  - `createdBy`: 'ai'
  - `createdAt`: current timestamp
- Optimistic UI update: suggestion card shows "Accepted ✓" badge
- Suggestion removed from pending list after successful save
- Success toast: "Message accepted and saved as draft"
- User can review/edit drafted messages in main MessageList (from Story 3.4)

**Validation:**
- Click "Accept" on suggestion
- Verify card shows "Accepted ✓" badge and fades out
- Open Chrome DevTools → IndexedDB → my-love-db → messages
- Verify new message entry with:
  - `isCustom: true`
  - `active: false`
  - `createdBy: 'ai'`
- Navigate to main MessageList → filter by "Custom" + "Draft"
- Verify accepted message appears in list

---

### AC-3.6.5: Rejected Messages Discarded

**Given** user reviews AI suggestion and clicks "Reject"
**When** reject action is triggered
**Then** the message SHALL be discarded without saving to IndexedDB

**Requirements:**
- Rejected suggestion removed from pending list immediately
- No IndexedDB write operation occurs
- Optimistic UI update: suggestion card shows "Rejected ✗" badge and fades out
- No success toast (silent rejection)
- Rejected messages not recoverable (intentional - clean up unwanted content)

**Validation:**
- Click "Reject" on suggestion
- Verify card shows "Rejected ✗" badge and fades out
- Check IndexedDB → verify NO new message entry created
- Verify rejected message does NOT appear in MessageList
- Total custom message count unchanged

---

### AC-3.6.6: Can Regenerate New Batch of Suggestions

**Given** user has reviewed all suggestions in current batch
**When** user clicks "Generate More" button
**Then** a new batch of 10 suggestions SHALL be generated with same parameters

**Requirements:**
- "Generate More" button appears after all suggestions reviewed (all accepted/rejected)
- Button reuses last generation parameters (category, tone, count)
- Option to "Change Parameters" opens generation form to adjust settings
- New batch increments daily usage counter (toward 5 session limit)
- Display updated quota: "2/5 generations remaining today"
- Previous batch discarded (no history of rejected suggestions)

**Validation:**
- Generate initial batch, accept 5, reject 5
- Verify "Generate More" button appears
- Click "Generate More" → new batch of 10 suggestions generated
- Verify new suggestions are different from previous batch
- Check quota display → decremented to "4/5 remaining"

---

### AC-3.6.7: Rate Limiting and Cost Control

**Given** user has generated 5 batches today
**When** user attempts to generate more suggestions
**Then** system SHALL enforce daily limit and display cost-related messaging

**Requirements:**
- Track usage in LocalStorage: `ai-suggestion-usage` object
- Daily limit: 5 generation sessions (resets at midnight UTC)
- "Generate Suggestions" button disabled when limit reached
- Disabled state shows: "Daily limit reached (5/5). Resets in 14 hours."
- Warning at 4/5: "1 generation remaining today. ~$0.01 cost per batch."
- Cost estimation displayed: "~$0.01 per 10 suggestions (GPT-3.5-turbo)"
- Option to increase limit in advanced settings (default: 5, max: 20)

**Cost Calculation:**
- GPT-3.5-turbo pricing: ~$0.002 per 1K tokens (input + output)
- Typical generation: ~500 tokens input (prompt) + ~1500 tokens output (10 messages)
- Total: ~2K tokens = $0.004 per batch
- Daily cost at 5 batches: ~$0.02

**Validation:**
- Generate 5 batches in succession
- After 5th batch → "Generate Suggestions" button becomes disabled
- Button tooltip shows: "Daily limit reached (5/5). Resets in [time]."
- Cost warning displayed after 4th batch
- Wait until next UTC day → verify limit resets to 0/5

---

## Technical Approach

### 1. AI Suggestion Service (New File)

**File:** `src/services/aiSuggestionService.ts`

**Purpose:** Centralized OpenAI API integration for message generation

```typescript
import OpenAI from 'openai';
import { MessageCategory, MessageSuggestion, GenerateSuggestionsRequest } from '../types';

export class AISuggestionService {
  private openai: OpenAI | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true // Note: In production, proxy through backend
      });
    }
  }

  async generateSuggestions(
    request: GenerateSuggestionsRequest
  ): Promise<MessageSuggestion[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
    }

    const prompt = this.buildPrompt(request);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates heartfelt love messages.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.8, // Higher for more creative variety
        n: 1
      });

      const response = completion.choices[0]?.message?.content || '';
      return this.parseResponse(response, request.category);
    } catch (error) {
      console.error('[AISuggestionService] Generation failed:', error);
      throw new Error('Failed to generate suggestions. Please try again.');
    }
  }

  private buildPrompt(request: GenerateSuggestionsRequest): string {
    const { category, count, tone, exampleMessages } = request;

    const toneInstructions = {
      romantic: 'deeply romantic and passionate',
      playful: 'light-hearted, fun, and flirty',
      heartfelt: 'sincere, warm, and emotionally genuine'
    };

    const categoryContext = {
      reasons: 'reasons why you love your girlfriend (specific traits, quirks, or qualities)',
      memories: 'cherished shared memories or special moments together',
      affirmations: 'affirmations of her worth, beauty, and importance in your life',
      'future-plans': 'exciting dreams and plans for your future together',
      custom: 'personalized love messages that feel unique to your relationship'
    };

    const examples = exampleMessages?.slice(0, 3).map(m => `- "${m}"`).join('\n') || '';

    return `Generate ${count} ${toneInstructions[tone || 'romantic']} love messages for my girlfriend.

Category: ${category}
Context: ${categoryContext[category]}

${examples ? `Here are a few examples of the style I'm looking for:\n${examples}\n` : ''}

Requirements:
- Each message should be 50-500 characters
- Messages should feel personal and authentic
- Vary the length and structure for diversity
- Focus on specific, concrete expressions (not generic)
- Return ONLY the messages, one per line, numbered 1-${count}
- No additional commentary or explanations`;
  }

  private parseResponse(response: string, category: MessageCategory): MessageSuggestion[] {
    // Parse numbered list format: "1. Message text\n2. Message text\n..."
    const lines = response.split('\n').filter(line => line.trim());
    const suggestions: MessageSuggestion[] = [];

    for (const line of lines) {
      // Match patterns like "1. Message" or "1) Message" or just "Message"
      const match = line.match(/^\d+[\.\)]\s*(.+)$/) || [null, line.trim()];
      const text = match[1]?.trim();

      if (text && text.length >= 10 && text.length <= 500) {
        suggestions.push({
          id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text,
          category,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
    }

    return suggestions.slice(0, 20); // Limit to max 20 suggestions
  }

  checkRateLimit(): { allowed: boolean; remaining: number; resetTime?: Date } {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageKey = 'ai-suggestion-usage';
    const storedData = localStorage.getItem(usageKey);

    let usage = storedData ? JSON.parse(storedData) : { date: today, count: 0 };

    // Reset if new day
    if (usage.date !== today) {
      usage = { date: today, count: 0 };
      localStorage.setItem(usageKey, JSON.stringify(usage));
    }

    const limit = 5; // Default daily limit
    const remaining = Math.max(0, limit - usage.count);
    const allowed = remaining > 0;

    // Calculate reset time (midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return { allowed, remaining, resetTime: tomorrow };
  }

  incrementUsage(): void {
    const today = new Date().toISOString().split('T')[0];
    const usageKey = 'ai-suggestion-usage';
    const storedData = localStorage.getItem(usageKey);

    let usage = storedData ? JSON.parse(storedData) : { date: today, count: 0 };

    if (usage.date === today) {
      usage.count += 1;
    } else {
      usage = { date: today, count: 1 };
    }

    localStorage.setItem(usageKey, JSON.stringify(usage));
  }
}

export const aiSuggestionService = new AISuggestionService();
```

### 2. TypeScript Interface Updates

**File:** `src/types/index.ts` (additions)

```typescript
// AI Suggestion Types
export interface MessageSuggestion {
  id: string; // Temporary UUID for UI tracking
  text: string;
  category: MessageCategory;
  status: 'pending' | 'accepted' | 'rejected';
  confidence?: number; // Optional AI confidence score (0-1)
  createdAt: string; // ISO timestamp
}

export interface GenerateSuggestionsRequest {
  category: MessageCategory;
  count: number; // Default: 10, range: 5-20
  tone?: 'romantic' | 'playful' | 'heartfelt';
  exampleMessages?: string[]; // 2-3 example messages for context
}

// Rate Limiting
export interface AISuggestionUsage {
  date: string; // YYYY-MM-DD
  count: number; // Number of generation sessions today
  lastRequest?: string; // ISO timestamp
}

// Enhanced Message interface (if not already present)
export interface Message {
  // ... existing fields ...
  createdBy?: 'system' | 'user' | 'ai'; // NEW: Track message source
}
```

### 3. Zustand Store Actions

**File:** `src/stores/useAppStore.ts` (additions)

```typescript
// Add to AppState interface
interface AppState {
  // ... existing state ...
  aiSuggestions: MessageSuggestion[];
  aiGenerating: boolean;
}

// Add to actions
interface AppActions {
  // ... existing actions ...

  // AI Suggestion Actions
  generateAISuggestions: (request: GenerateSuggestionsRequest) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  rejectSuggestion: (suggestionId: string) => void;
  clearSuggestions: () => void;
  checkAIRateLimit: () => { allowed: boolean; remaining: number; resetTime?: Date };
}

// Implementation
generateAISuggestions: async (request: GenerateSuggestionsRequest) => {
  const rateLimit = aiSuggestionService.checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`Daily limit reached. Resets at ${rateLimit.resetTime?.toLocaleTimeString()}`);
  }

  set({ aiGenerating: true });

  try {
    const suggestions = await aiSuggestionService.generateSuggestions(request);
    aiSuggestionService.incrementUsage();

    set({ aiSuggestions: suggestions, aiGenerating: false });
    console.log(`[AISuggestions] Generated ${suggestions.length} suggestions for category: ${request.category}`);
  } catch (error) {
    set({ aiGenerating: false });
    console.error('[AISuggestions] Generation failed:', error);
    throw error;
  }
},

acceptSuggestion: async (suggestionId: string) => {
  const state = get();
  const suggestion = state.aiSuggestions.find(s => s.id === suggestionId);

  if (!suggestion) {
    console.error(`[AISuggestions] Suggestion ${suggestionId} not found`);
    return;
  }

  try {
    // Save as draft custom message
    await customMessageService.create({
      text: suggestion.text,
      category: suggestion.category,
      active: false, // Draft status
      tags: ['ai-generated']
    });

    // Update suggestion status
    set(state => ({
      aiSuggestions: state.aiSuggestions.map(s =>
        s.id === suggestionId ? { ...s, status: 'accepted' } : s
      )
    }));

    // Reload messages to include new draft
    await get().loadMessages();

    console.log(`[AISuggestions] Accepted suggestion: "${suggestion.text.substring(0, 50)}..."`);
  } catch (error) {
    console.error('[AISuggestions] Failed to accept suggestion:', error);
    throw error;
  }
},

rejectSuggestion: (suggestionId: string) => {
  set(state => ({
    aiSuggestions: state.aiSuggestions.map(s =>
      s.id === suggestionId ? { ...s, status: 'rejected' } : s
    )
  }));

  const suggestion = get().aiSuggestions.find(s => s.id === suggestionId);
  console.log(`[AISuggestions] Rejected suggestion: "${suggestion?.text.substring(0, 50)}..."`);
},

clearSuggestions: () => {
  set({ aiSuggestions: [] });
},

checkAIRateLimit: () => {
  return aiSuggestionService.checkRateLimit();
}
```

### 4. AI Suggestion Panel Component (New File)

**File:** `src/components/AdminPanel/AISuggestionPanel.tsx`

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MessageCategory, GenerateSuggestionsRequest } from '../../types';

export function AISuggestionPanel() {
  const {
    aiSuggestions,
    aiGenerating,
    generateAISuggestions,
    acceptSuggestion,
    rejectSuggestion,
    checkAIRateLimit
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<MessageCategory>('reasons');
  const [tone, setTone] = useState<'romantic' | 'playful' | 'heartfelt'>('romantic');
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const rateLimit = checkAIRateLimit();

  const handleGenerate = async () => {
    setError(null);

    if (!rateLimit.allowed) {
      setError(`Daily limit reached (5/5). Resets at ${rateLimit.resetTime?.toLocaleTimeString()}`);
      return;
    }

    const request: GenerateSuggestionsRequest = {
      category,
      count,
      tone
    };

    try {
      await generateAISuggestions(request);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    }
  };

  const pendingSuggestions = aiSuggestions.filter(s => s.status === 'pending');
  const allReviewed = aiSuggestions.length > 0 && pendingSuggestions.length === 0;

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">AI Message Suggestions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Generate love messages with AI • {rateLimit.remaining}/5 generations remaining today
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={!rateLimit.allowed || aiGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg
                     hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          data-testid="generate-suggestions-button"
        >
          <Sparkles className="w-5 h-5" />
          Generate Suggestions
        </button>
      </div>

      {/* Generation Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Generate Suggestions</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MessageCategory)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    data-testid="suggestion-category-select"
                  >
                    <option value="reasons">Reasons I Love You</option>
                    <option value="memories">Shared Memories</option>
                    <option value="affirmations">Affirmations</option>
                    <option value="future-plans">Future Plans</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tone
                  </label>
                  <div className="flex gap-2">
                    {(['romantic', 'playful', 'heartfelt'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${tone === t
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        data-testid={`suggestion-tone-${t}`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of suggestions: {count}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full"
                    data-testid="suggestion-count-slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Cost Estimate */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    💰 Estimated cost: ~$0.01 per batch (GPT-3.5-turbo)
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg
                               hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={aiGenerating}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg
                               hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    data-testid="generate-submit-button"
                  >
                    {aiGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {aiGenerating && (
        <div className="flex flex-col items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-12 h-12 text-purple-600" />
          </motion.div>
          <p className="text-gray-600 mt-4">Generating suggestions...</p>
        </div>
      )}

      {/* Suggestions List */}
      {!aiGenerating && aiSuggestions.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {aiSuggestions.map((suggestion) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: suggestion.status === 'accepted' ? 100 : -100 }}
                className={`bg-white rounded-lg p-4 shadow-sm border-2 transition-colors
                  ${suggestion.status === 'pending' ? 'border-gray-200' : ''}
                  ${suggestion.status === 'accepted' ? 'border-green-300 bg-green-50' : ''}
                  ${suggestion.status === 'rejected' ? 'border-red-300 bg-red-50' : ''}
                `}
                data-testid={`suggestion-${suggestion.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-gray-800 leading-relaxed">{suggestion.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {suggestion.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {suggestion.text.length} characters
                      </span>
                    </div>
                  </div>

                  {suggestion.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptSuggestion(suggestion.id)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg
                                   hover:bg-green-700 transition-colors text-sm font-medium"
                        data-testid={`accept-${suggestion.id}`}
                      >
                        Accept ✓
                      </button>
                      <button
                        onClick={() => rejectSuggestion(suggestion.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg
                                   hover:bg-red-700 transition-colors text-sm font-medium"
                        data-testid={`reject-${suggestion.id}`}
                      >
                        Reject ✗
                      </button>
                    </div>
                  )}

                  {suggestion.status === 'accepted' && (
                    <span className="text-green-600 font-medium text-sm">Accepted ✓</span>
                  )}

                  {suggestion.status === 'rejected' && (
                    <span className="text-red-600 font-medium text-sm">Rejected ✗</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Generate More Button */}
      {allReviewed && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setShowForm(true)}
            disabled={!rateLimit.allowed}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg
                       hover:bg-purple-700 disabled:opacity-50 transition-colors"
            data-testid="generate-more-button"
          >
            <RefreshCw className="w-5 h-5" />
            Generate More
          </button>
        </div>
      )}

      {/* Empty State */}
      {!aiGenerating && aiSuggestions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Click "Generate Suggestions" to create AI-powered love messages</p>
        </div>
      )}
    </div>
  );
}
```

---

## Dev Notes

### Learnings from Previous Story (Story 3.5)

**Infrastructure Already Built:**
- ✅ `customMessageService` provides `create()`, `update()`, `delete()`, `getAll()` methods
- ✅ IndexedDB `messages` store ready for custom messages with `isCustom: true` field
- ✅ Admin panel UI framework complete with modal patterns (Framer Motion)
- ✅ Draft/active toggle system: `active: boolean` field controls rotation participation
- ✅ Import/export JSON functionality for backup/restore (can export AI-generated messages)

**Patterns to Follow:**
- ✅ Zustand store actions for async operations with try/catch error handling
- ✅ Optimistic UI updates: mark suggestion as "accepted"/"rejected" immediately in UI
- ✅ Console logging: `[AISuggestions] Action: details`
- ✅ data-testid attributes: `suggestion-*`, `accept-*`, `reject-*` for E2E tests
- ✅ Framer Motion: AnimatePresence for suggestion list enter/exit animations

**Files to Modify:**
- `src/components/AdminPanel/AdminPanel.tsx` - Add tab/section for AI Suggestions
- `src/stores/useAppStore.ts` - Add AI suggestion state and actions
- `src/types/index.ts` - Add `MessageSuggestion` and `GenerateSuggestionsRequest` interfaces

**New Files to Create:**
- `src/services/aiSuggestionService.ts` - OpenAI API integration
- `src/components/AdminPanel/AISuggestionPanel.tsx` - UI for AI suggestion workflow

### Project Structure Notes

**New Service Layer:**
- `src/services/aiSuggestionService.ts` - OpenAI GPT integration with rate limiting
- Follows existing `customMessageService.ts` patterns (singleton instance, async methods)
- Uses `openai` npm package (^4.x) for API calls
- Environment variable: `VITE_OPENAI_API_KEY` in `.env` file

**Rate Limiting Strategy:**
- LocalStorage key: `ai-suggestion-usage` tracks daily generation count
- Structure: `{ date: 'YYYY-MM-DD', count: number, lastRequest: timestamp }`
- Daily limit: 5 sessions (50 suggestions max), resets at midnight UTC
- Cost-conscious design: default to GPT-3.5-turbo (~$0.01 per 10 messages)

**Alignment with Unified Project Structure:**
- Component directory: `src/components/AdminPanel/` for admin-related UI
- Service directory: `src/services/` for data/API logic
- TypeScript interfaces: `src/types/index.ts` for shared types
- Environment variables: `.env` for API keys (NOT committed to git)

**OpenAI API Configuration:**
- Model: GPT-3.5-turbo (cost optimization vs. GPT-4)
- Max tokens: 2000 output (sufficient for 10 messages @ ~150 tokens each)
- Temperature: 0.8 (higher for creative variety, not deterministic)
- Prompt engineering: Include category context, 2-3 examples, tone instructions

**Security Considerations:**
- ⚠️ **Important:** Using `dangerouslyAllowBrowser: true` exposes API key in client bundle
- **Production Recommendation:** Proxy OpenAI API calls through backend endpoint
- **Alternative:** Deploy serverless function (Vercel/Netlify) to hide API key
- **Current Approach:** Accept risk for MVP, document security concern, add backend proxy in future

### References

**Technical Specifications:**
- [tech-spec-epic-3.md](../tech-spec-epic-3.md#story-36-ai-message-suggestion-review-interface-optional-enhancement) - Story 3.6 technical requirements
- [epics.md](../epics.md#story-36-ai-message-suggestion-review-interface-optional-enhancement) - User story and acceptance criteria
- [PRD.md](../PRD.md#custom-message-management) - FR026-FR030 functional requirements

**Architecture References:**
- [architecture.md](../architecture.md#services) - Service layer patterns for API integration
- [architecture.md](../architecture.md#state-management) - Zustand store patterns for AI state
- [tech-spec-epic-3.md](../tech-spec-epic-3.md#ai-suggestion-service-api-story-36) - AI service API specification

**Related Stories:**
- [3-4-admin-interface-custom-message-management-phase-1-ui.md](./3-4-admin-interface-custom-message-management-phase-1-ui.md) - Admin UI components
- [3-5-admin-interface-message-persistence-integration.md](./3-5-admin-interface-message-persistence-integration.md) - Custom message service CRUD operations
- Story 3.1: 365-message library (provides example messages for AI prompts)
- Epic 4: Interactive features (next epic after Epic 3 complete)

**External Documentation:**
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference) - GPT completions API
- [OpenAI Pricing](https://openai.com/api/pricing/) - GPT-3.5-turbo cost: $0.002/1K tokens
- [openai npm package](https://www.npmjs.com/package/openai) - TypeScript SDK

---

## Tasks/Subtasks

### Implementation Tasks

- [ ] **Task 1**: Install OpenAI Package and Configure API Key (AC: 3.6.2)
  - [ ] Subtask 1.1: `npm install openai` (version ^4.x)
  - [ ] Subtask 1.2: Create `.env.example` with `VITE_OPENAI_API_KEY=your_key_here`
  - [ ] Subtask 1.3: Add `.env` to `.gitignore` if not already present
  - [ ] Subtask 1.4: Document API key setup in README or admin docs
  - [ ] Subtask 1.5: Test environment variable loading in development

- [ ] **Task 2**: Create AI Suggestion Service (AC: 3.6.2)
  - [ ] Subtask 2.1: Create `src/services/aiSuggestionService.ts`
  - [ ] Subtask 2.2: Implement `AISuggestionService` class with OpenAI client initialization
  - [ ] Subtask 2.3: Implement `generateSuggestions(request)` method with GPT-3.5-turbo API call
  - [ ] Subtask 2.4: Implement `buildPrompt(request)` with category context and examples
  - [ ] Subtask 2.5: Implement `parseResponse(response)` to extract messages from GPT output
  - [ ] Subtask 2.6: Implement `checkRateLimit()` to read daily usage from LocalStorage
  - [ ] Subtask 2.7: Implement `incrementUsage()` to update daily usage counter
  - [ ] Subtask 2.8: Export singleton: `export const aiSuggestionService = new AISuggestionService()`

- [ ] **Task 3**: Update TypeScript Interfaces (AC: 3.6.2, 3.6.3, 3.6.4)
  - [ ] Subtask 3.1: Add `MessageSuggestion` interface with `id`, `text`, `category`, `status`, `createdAt`
  - [ ] Subtask 3.2: Add `GenerateSuggestionsRequest` interface with `category`, `count`, `tone`, `exampleMessages`
  - [ ] Subtask 3.3: Add `AISuggestionUsage` interface for rate limiting tracking
  - [ ] Subtask 3.4: Enhance `Message` interface with `createdBy?: 'system' | 'user' | 'ai'` field
  - [ ] Subtask 3.5: Export all new interfaces from `src/types/index.ts`

- [ ] **Task 4**: Extend Zustand Store with AI Actions (AC: 3.6.2, 3.6.4, 3.6.5)
  - [ ] Subtask 4.1: Add `aiSuggestions: MessageSuggestion[]` state
  - [ ] Subtask 4.2: Add `aiGenerating: boolean` state
  - [ ] Subtask 4.3: Implement `generateAISuggestions(request)` action - call service, handle errors
  - [ ] Subtask 4.4: Implement `acceptSuggestion(id)` action - save via customMessageService, mark accepted
  - [ ] Subtask 4.5: Implement `rejectSuggestion(id)` action - mark rejected, don't save
  - [ ] Subtask 4.6: Implement `clearSuggestions()` action - reset suggestions array
  - [ ] Subtask 4.7: Implement `checkAIRateLimit()` action - proxy to service method
  - [ ] Subtask 4.8: Add console logging for all AI actions

- [ ] **Task 5**: Create AI Suggestion Panel Component (AC: 3.6.1, 3.6.3, 3.6.6)
  - [ ] Subtask 5.1: Create `src/components/AdminPanel/AISuggestionPanel.tsx`
  - [ ] Subtask 5.2: Implement header with "Generate Suggestions" button and quota display
  - [ ] Subtask 5.3: Implement generation form modal with category, tone, count inputs
  - [ ] Subtask 5.4: Implement suggestions list with suggestion cards
  - [ ] Subtask 5.5: Implement Accept/Reject buttons for each suggestion card
  - [ ] Subtask 5.6: Implement loading state with spinner during API call
  - [ ] Subtask 5.7: Implement empty state when no suggestions
  - [ ] Subtask 5.8: Implement "Generate More" button after all suggestions reviewed
  - [ ] Subtask 5.9: Add data-testid attributes: `generate-suggestions-button`, `accept-*`, `reject-*`, `generate-more-button`
  - [ ] Subtask 5.10: Style component consistently with existing admin panel theme

- [ ] **Task 6**: Integrate AI Panel into Admin Panel (AC: 3.6.1)
  - [ ] Subtask 6.1: Modify `src/components/AdminPanel/AdminPanel.tsx`
  - [ ] Subtask 6.2: Add tab or expandable section for "AI Suggestions"
  - [ ] Subtask 6.3: Import and render `<AISuggestionPanel />`
  - [ ] Subtask 6.4: Add navigation/routing logic if using tabs
  - [ ] Subtask 6.5: Ensure consistent theme and spacing with other admin sections

- [ ] **Task 7**: Implement Rate Limiting UI (AC: 3.6.7)
  - [ ] Subtask 7.1: Display remaining quota in header: "X/5 generations remaining today"
  - [ ] Subtask 7.2: Disable "Generate Suggestions" button when daily limit reached
  - [ ] Subtask 7.3: Show tooltip on disabled button: "Daily limit reached. Resets at [time]."
  - [ ] Subtask 7.4: Display warning at 4/5 usage: "1 generation remaining today."
  - [ ] Subtask 7.5: Display cost estimate: "~$0.01 per 10 suggestions (GPT-3.5-turbo)"
  - [ ] Subtask 7.6: Test limit reset logic (simulate next UTC day)

- [ ] **Task 8**: Handle API Errors Gracefully (AC: 3.6.2)
  - [ ] Subtask 8.1: Catch OpenAI API errors (network failure, rate limits, invalid key)
  - [ ] Subtask 8.2: Display user-friendly error messages in UI
  - [ ] Subtask 8.3: Handle missing API key: "OpenAI API key not configured. Add to .env"
  - [ ] Subtask 8.4: Handle quota exceeded: "OpenAI quota exceeded. Check billing."
  - [ ] Subtask 8.5: Handle malformed responses: "Failed to parse suggestions. Try again."
  - [ ] Subtask 8.6: Log all errors to console for debugging

- [ ] **Task 9**: Write Comprehensive E2E Tests (AC: All)
  - [ ] Subtask 9.1: Create `tests/e2e/ai-suggestions.spec.ts`
  - [ ] Subtask 9.2: Test: Generate button visible and functional (AC 3.6.1)
  - [ ] Subtask 9.3: Test: Generation form opens with parameters (AC 3.6.2)
  - [ ] Subtask 9.4: Test: Mock OpenAI API → verify 10 suggestions returned (AC 3.6.2)
  - [ ] Subtask 9.5: Test: Each suggestion has Accept/Reject buttons (AC 3.6.3)
  - [ ] Subtask 9.6: Test: Accept suggestion → saved to IndexedDB as draft (AC 3.6.4)
  - [ ] Subtask 9.7: Test: Reject suggestion → not saved, removed from list (AC 3.6.5)
  - [ ] Subtask 9.8: Test: Generate More button appears after all reviewed (AC 3.6.6)
  - [ ] Subtask 9.9: Test: Daily limit enforcement → button disabled at 5/5 (AC 3.6.7)
  - [ ] Subtask 9.10: Test: Error handling → API failure shows error message

- [ ] **Task 10**: Documentation and Setup Guide (AC: 3.6.2, 3.6.7)
  - [ ] Subtask 10.1: Update README with OpenAI API key setup instructions
  - [ ] Subtask 10.2: Document rate limiting policy (5 sessions/day)
  - [ ] Subtask 10.3: Document cost estimates and billing implications
  - [ ] Subtask 10.4: Add troubleshooting section for common API errors
  - [ ] Subtask 10.5: Document prompt engineering approach (category context, examples)
  - [ ] Subtask 10.6: Note security concern: API key in client bundle (recommend backend proxy)

- [ ] **Task 11**: Validate All Acceptance Criteria
  - [ ] Subtask 11.1: Manual test AC-3.6.1 - Generate button in admin panel
  - [ ] Subtask 11.2: Manual test AC-3.6.2 - OpenAI API generates 10 suggestions
  - [ ] Subtask 11.3: Manual test AC-3.6.3 - Accept/Reject buttons functional
  - [ ] Subtask 11.4: Manual test AC-3.6.4 - Accepted messages saved as drafts
  - [ ] Subtask 11.5: Manual test AC-3.6.5 - Rejected messages discarded
  - [ ] Subtask 11.6: Manual test AC-3.6.6 - Generate More regenerates batch
  - [ ] Subtask 11.7: Manual test AC-3.6.7 - Rate limiting enforces daily limit

---

## Change Log

**2025-11-05** - Story drafted (create-story workflow)
**2025-11-06** - Story updated with enhanced Technical Approach and detailed code examples (#yolo mode)

---

## Dev Agent Record

### Context Reference

- [3-6-ai-message-suggestion-review-interface-optional-enhancement.context.xml](./3-6-ai-message-suggestion-review-interface-optional-enhancement.context.xml) - Generated 2025-11-06

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
