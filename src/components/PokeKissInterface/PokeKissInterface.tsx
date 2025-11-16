/**
 * PokeKissInterface Component
 *
 * Main interface for sending pokes and kisses to partner.
 * Displays notification badge for incoming interactions and plays animations.
 *
 * Features:
 * - Poke/Kiss send buttons with animation feedback
 * - Notification badge showing unviewed interaction count
 * - Animation playback for received interactions
 * - Real-time updates via Supabase Realtime
 *
 * AC Coverage:
 * - AC#1: Interaction buttons in top nav
 * - AC#2: Tapping sends interaction to Supabase
 * - AC#3: Recipient receives notification badge
 * - AC#4: Animation playback (kiss hearts, poke nudge)
 * - AC#5: Mark interaction as viewed after animation
 */

import { useState, useEffect, useRef } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Heart, Hand, History } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { getPartnerId } from '../../api/supabaseClient';
import { InteractionHistory } from '../InteractionHistory';
import type { Interaction } from '../../types';

// Interaction animation type
type AnimationType = 'poke' | 'kiss' | null;

export function PokeKissInterface() {
  const {
    sendPoke,
    sendKiss,
    unviewedCount,
    getUnviewedInteractions,
    markInteractionViewed,
    subscribeToInteractions,
  } = useAppStore();

  const [isPoking, setIsPoking] = useState(false);
  const [isKissing, setIsKissing] = useState(false);
  const [showAnimation, setShowAnimation] = useState<AnimationType>(null);
  const [currentInteraction, setCurrentInteraction] = useState<Interaction | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Use ref to prevent duplicate subscriptions in React StrictMode
  const subscriptionRef = useRef<(() => void) | null>(null);
  const isSubscribingRef = useRef(false);

  // Subscribe to real-time interactions on mount
  useEffect(() => {
    // Prevent duplicate subscriptions
    if (isSubscribingRef.current || subscriptionRef.current) {
      if (import.meta.env.DEV) {
        console.log('[PokeKissInterface] Subscription already active, skipping');
      }
      return;
    }

    isSubscribingRef.current = true;

    const setupSubscription = async () => {
      try {
        const unsubscribe = await subscribeToInteractions();
        subscriptionRef.current = unsubscribe;
        console.log('[PokeKissInterface] Subscribed to real-time interactions');
      } catch (error) {
        console.error('[PokeKissInterface] Failed to subscribe:', error);
      } finally {
        isSubscribingRef.current = false;
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
        console.log('[PokeKissInterface] Unsubscribed from interactions');
      }
    };
  }, []); // Empty deps - only subscribe once

  // Handle Poke button click
  const handlePoke = async () => {
    const partnerId = await getPartnerId();
    if (!partnerId) {
      console.error('[PokeKissInterface] No partner ID configured');
      setShowToast('Error: Partner not configured');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsPoking(true);

    try {
      await sendPoke(partnerId);
      setShowToast('Poke sent! 👆');
      setTimeout(() => setShowToast(null), 2000);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to send poke:', error);
      setShowToast('Failed to send poke. Try again.');
      setTimeout(() => setShowToast(null), 3000);
    } finally {
      setIsPoking(false);
    }
  };

  // Handle Kiss button click
  const handleKiss = async () => {
    const partnerId = await getPartnerId();
    if (!partnerId) {
      console.error('[PokeKissInterface] No partner ID configured');
      setShowToast('Error: Partner not configured');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsKissing(true);

    try {
      await sendKiss(partnerId);
      setShowToast('Kiss sent! 💋');
      setTimeout(() => setShowToast(null), 2000);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to send kiss:', error);
      setShowToast('Failed to send kiss. Try again.');
      setTimeout(() => setShowToast(null), 3000);
    } finally {
      setIsKissing(false);
    }
  };

  // Handle notification badge click - show oldest unviewed interaction
  const handleBadgeClick = () => {
    const unviewed = getUnviewedInteractions();
    if (unviewed.length === 0) return;

    // Show animation for oldest unviewed interaction
    const interaction = unviewed[0];
    setCurrentInteraction(interaction);
    setShowAnimation(interaction.type);
  };

  // Handle animation completion - mark as viewed
  const handleAnimationComplete = async () => {
    if (!currentInteraction) return;

    try {
      await markInteractionViewed(currentInteraction.id);
      console.log('[PokeKissInterface] Interaction marked as viewed:', currentInteraction.id);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to mark as viewed:', error);
    } finally {
      setShowAnimation(null);
      setCurrentInteraction(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3" data-testid="poke-kiss-interface">
        {/* History Button */}
        <motion.button
          onClick={() => setShowHistory(true)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          className="
            relative flex items-center justify-center w-10 h-10 rounded-full
            bg-gradient-to-br from-purple-400 to-purple-500
            text-white shadow-md hover:shadow-lg
            transition-all duration-200
          "
          data-testid="history-button"
          aria-label="View Interaction History"
        >
          <History className="w-5 h-5" />
        </motion.button>

        {/* Poke Button */}
        <motion.button
          onClick={handlePoke}
          disabled={isPoking}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          className={`
          relative flex items-center justify-center w-12 h-12 rounded-full
          bg-gradient-to-br from-pink-400 to-pink-500
          text-white shadow-md hover:shadow-lg
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
          data-testid="poke-button"
          aria-label="Send Poke"
        >
          <motion.div
            animate={isPoking ? { rotate: [0, -15, 15, -15, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Hand className="w-6 h-6" />
          </motion.div>
        </motion.button>

        {/* Kiss Button */}
        <motion.button
          onClick={handleKiss}
          disabled={isKissing}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          className={`
          relative flex items-center justify-center w-12 h-12 rounded-full
          bg-gradient-to-br from-red-400 to-pink-500
          text-white shadow-md hover:shadow-lg
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
          data-testid="kiss-button"
          aria-label="Send Kiss"
        >
          <motion.div
            animate={isKissing ? { scale: [1, 1.2, 1, 1.2, 1] } : {}}
            transition={{ duration: 0.6 }}
          >
            <Heart className="w-6 h-6 fill-current" />
          </motion.div>
        </motion.button>

        {/* Notification Badge */}
        {unviewedCount > 0 && (
          <motion.button
            onClick={handleBadgeClick}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileTap={{ scale: 0.9 }}
            className="relative flex items-center justify-center w-10 h-10 rounded-full bg-purple-500 text-white shadow-lg cursor-pointer"
            data-testid="notification-badge"
            aria-label={`${unviewedCount} unviewed interaction${unviewedCount > 1 ? 's' : ''}`}
          >
            <span className="text-sm font-bold">{unviewedCount}</span>
            <motion.div
              className="absolute inset-0 rounded-full bg-purple-400"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ opacity: 0.5 }}
            />
          </motion.button>
        )}

        {/* Animation Overlay */}
        <AnimatePresence>
          {showAnimation === 'poke' && <PokeAnimation onComplete={handleAnimationComplete} />}
          {showAnimation === 'kiss' && <KissAnimation onComplete={handleAnimationComplete} />}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full shadow-lg z-50"
              data-testid="toast-notification"
            >
              {showToast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interaction History Modal */}
      <InteractionHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
}

/**
 * Poke Animation Component
 * Displays playful nudge animation with shake effect
 */
function PokeAnimation({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      data-testid="poke-animation"
    >
      <motion.div
        className="text-9xl"
        initial={{ scale: 0, rotate: 0 }}
        animate={{
          scale: [0, 1.2, 1],
          rotate: [0, -15, 15, -15, 15, 0],
          x: [0, -20, 20, -20, 20, 0],
        }}
        transition={{
          duration: 0.8,
          ease: 'easeOut',
        }}
        onAnimationComplete={() => {
          setTimeout(onComplete, 500);
        }}
      >
        👆
      </motion.div>
    </motion.div>
  );
}

/**
 * Kiss Animation Component
 * Displays floating hearts animation
 */
function KissAnimation({ onComplete }: { onComplete: () => void }) {
  const hearts = Array.from({ length: 7 }, (_, i) => i);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      data-testid="kiss-animation"
    >
      {/* Animated Hearts */}
      {hearts.map((i) => (
        <motion.div
          key={i}
          className="absolute text-6xl"
          style={{
            left: `${20 + i * 10}%`,
            bottom: '-10%',
          }}
          initial={{ opacity: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -400, -500, -600],
            scale: [0, 1, 1.2, 1],
            x: [0, Math.sin(i) * 50, Math.sin(i) * 100],
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.1,
            ease: 'easeOut',
          }}
          onAnimationComplete={() => {
            if (i === hearts.length - 1) {
              setTimeout(onComplete, 300);
            }
          }}
        >
          💗
        </motion.div>
      ))}
    </motion.div>
  );
}
