/**
 * LoveNotes Component
 *
 * Main page container for the Love Notes chat feature.
 * Composes MessageList, MessageInput, and header into a full chat view.
 *
 * Features:
 * - Full-screen chat layout
 * - Header with title
 * - Scrollable message list
 * - Message input with send functionality
 * - Safe area handling for mobile
 * - Error state display with retry
 *
 * Story 2.1: AC-2.1.1 (message display), AC-2.1.3 (message list)
 * Story 2.2: AC-2.2.1 (message input), AC-2.2.2 (send functionality)
 */

import { useEffect, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useLoveNotes } from '../../hooks/useLoveNotes';
import { useAppStore } from '../../stores/useAppStore';
import { authService } from '../../api/authService';
import { getPartnerDisplayName } from '../../api/supabaseClient';

/**
 * LoveNotes - Full chat page component
 *
 * Assembles the Love Notes UI with header, message list,
 * and eventually a message input (Story 2.2).
 */
export function LoveNotes(): ReactElement {
  const { notes, isLoading, error, hasMore, fetchOlderNotes, clearError, retryFailedMessage } =
    useLoveNotes();

  // Get navigation function
  const navigateHome = useAppStore((state) => state.navigateHome);

  // State for current user info
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('You');
  // Partner name fetched from database (not local config)
  const [partnerName, setPartnerName] = useState<string>('Partner');

  // Fetch current user info and partner name on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userId = await authService.getCurrentUserId();
        if (userId) {
          setCurrentUserId(userId);
        }

        // Get display name from user metadata
        const user = await authService.getUser();
        if (user?.user_metadata?.display_name) {
          setUserName(user.user_metadata.display_name);
        } else if (user?.email) {
          // Fallback to email prefix
          setUserName(user.email.split('@')[0]);
        }

        // Fetch partner's display name from database (not local config)
        const partnerDisplayName = await getPartnerDisplayName();
        if (partnerDisplayName) {
          setPartnerName(partnerDisplayName);
        }
      } catch (err) {
        console.error('[LoveNotes] Failed to fetch user info:', err);
      }
    };

    fetchUserInfo();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#FFF5F5]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 safe-area-top">
        <button
          onClick={navigateHome}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back home"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        <h1 className="text-lg font-semibold text-gray-800">Love Notes</h1>

        {/* Spacer for symmetric header layout */}
        <div className="w-9" />
      </header>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={clearError}
            className="text-sm text-red-600 font-medium hover:text-red-800"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Message list */}
      <MessageList
        notes={notes}
        currentUserId={currentUserId}
        partnerName={partnerName}
        userName={userName}
        isLoading={isLoading}
        onLoadMore={fetchOlderNotes}
        hasMore={hasMore}
        onRetry={retryFailedMessage}
      />

      {/* Message input - Story 2.2 */}
      <MessageInput />
    </div>
  );
}

export default LoveNotes;
