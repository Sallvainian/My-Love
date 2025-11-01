// Core types for the My Love app

export type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';

export type MessageCategory = 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';

export type MoodType = 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';

export interface Message {
  id: number;
  text: string;
  category: MessageCategory;
  isCustom: boolean;
  createdAt: Date;
  isFavorite?: boolean;
}

export interface Photo {
  id: number;
  blob: Blob;
  caption: string;
  uploadDate: Date;
  tags: string[];
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
  lastShownDate: string; // ISO date string
  lastMessageId: number;
  favoriteIds: number[];
  viewedIds: number[];
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
