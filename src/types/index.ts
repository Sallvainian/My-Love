// Core types for the My Love app

export type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';

export type MessageCategory = 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';

export type MoodType = 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';

export interface Message {
  id: number;
  text: string;
  category: MessageCategory;
  isCustom: boolean;
  active?: boolean;
  createdAt: Date;
  isFavorite?: boolean;
  updatedAt?: Date;
  tags?: string[];
}

export interface Photo {
  id: number;
  imageBlob: Blob;           // Renamed from 'blob' for clarity
  caption?: string;          // Optional caption (max 500 chars)
  tags: string[];            // Array of tags
  uploadDate: Date;          // Upload timestamp
  originalSize: number;      // Original file size in bytes
  compressedSize: number;    // Compressed size in bytes
  width: number;             // Image width in pixels
  height: number;            // Image height in pixels
  mimeType: string;          // 'image/jpeg' | 'image/png' | 'image/webp'
}

// Photo upload types (Story 4.1)
export interface PhotoUploadInput {
  file: File;
  caption?: string;
  tags?: string;  // Comma-separated string
}

export interface CompressionOptions {
  maxWidth: number;      // Default: 1920px
  maxHeight: number;     // Default: 1920px
  quality: number;       // Default: 0.8 (80%)
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export interface Anniversary {
  id: number;
  date: string; // ISO date string
  label: string;
  description?: string;
}

export interface MoodEntry {
  date: string; // ISO date string
  mood: MoodType;
  note?: string;
}

export interface Settings {
  themeName: ThemeName;
  notificationTime: string; // HH:MM format
  relationship: {
    startDate: string; // ISO date string
    partnerName: string;
    anniversaries: Anniversary[];
  };
  customization: {
    accentColor: string;
    fontFamily: string;
  };
  notifications: {
    enabled: boolean;
    time: string;
  };
}

export interface MessageHistory {
  currentIndex: number;           // 0 = today, 1 = yesterday, 2 = 2 days ago
  shownMessages: Map<string, number>; // Date (YYYY-MM-DD) → Message ID mapping
  maxHistoryDays: number;         // Limit backward navigation (default: 30)
  favoriteIds: number[];          // Keep for favorite tracking (legacy)
  // Deprecated fields (kept for migration compatibility):
  lastShownDate?: string;         // @deprecated Use shownMessages Map instead
  lastMessageId?: number;         // @deprecated Use shownMessages Map instead
  viewedIds?: number[];           // @deprecated Use shownMessages Map instead
}

// Custom message management types (Story 3.4)
export interface CustomMessage {
  id: number;
  text: string;
  category: MessageCategory;
  isCustom: boolean;              // Always true for custom messages
  active: boolean;                // Controls rotation participation (Story 3.5)
  createdAt: string;              // ISO timestamp
  updatedAt?: string;             // ISO timestamp
  tags?: string[];
}

export interface CreateMessageInput {
  text: string;
  category: MessageCategory;
  active?: boolean;               // Default: true (Story 3.5)
  tags?: string[];
}

export interface UpdateMessageInput {
  id: number;
  text?: string;
  category?: MessageCategory;
  active?: boolean;               // Story 3.5
  tags?: string[];
}

export interface MessageFilter {
  category?: MessageCategory | 'all';
  isCustom?: boolean;             // Story 3.5
  active?: boolean;               // Story 3.5
  searchTerm?: string;
  tags?: string[];
}

// Import/Export schema (Story 3.5)
export interface CustomMessagesExport {
  version: '1.0';
  exportDate: string;
  messageCount: number;
  messages: Array<{
    text: string;
    category: MessageCategory;
    active: boolean;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface AppState {
  settings: Settings | null;
  messageHistory: MessageHistory;
  messages: Message[];
  photos: Photo[];
  moods: MoodEntry[];
  isOnboarded: boolean;
}

// Theme configuration
export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  gradients: {
    background: string;
    card: string;
  };
}

// Navigation
export type RouteType = 'home' | 'memories' | 'moods' | 'countdown' | 'settings' | 'onboarding';

export interface NavItem {
  route: RouteType;
  label: string;
  icon: string;
}
