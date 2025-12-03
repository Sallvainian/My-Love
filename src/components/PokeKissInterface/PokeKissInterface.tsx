/**
 * PokeKissInterface Component
 *
 * Expandable FAB (Floating Action Button) for sending interactions to partner.
 * Main button expands to reveal poke/kiss/fart actions with smooth animations.
 *
 * Features:
 * - Collapsible action menu with staggered animations
 * - Poke/Kiss/Fart send buttons with cooldowns
 * - Notification badge showing unviewed interaction count
 * - Animation playback for received interactions
 * - History modal access
 *
 * AC Coverage:
 * - AC#1: Interaction buttons accessible via FAB
 * - AC#2: Tapping sends interaction to Supabase
 * - AC#3: Recipient receives notification badge
 * - AC#4: Animation playback (kiss hearts, poke nudge)
 * - AC#5: Mark interaction as viewed after animation
 */

import { useState, useEffect, useRef } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Hand, History, Wind, Heart, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { getPartnerId } from '../../api/supabaseClient';
import { InteractionHistory } from '../InteractionHistory';
import type { Interaction } from '../../types';

// Interaction animation type
type AnimationType = 'poke' | 'kiss' | 'fart' | null;

// Rate limiting constants (30 minutes in milliseconds)
const RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_KEYS = {
  poke: 'lastPokeTime',
  kiss: 'lastKissTime',
  fart: 'lastFartTime',
};

// Get remaining cooldown time
const getCooldownRemaining = (type: 'poke' | 'kiss' | 'fart'): number => {
  const lastTime = localStorage.getItem(RATE_LIMIT_KEYS[type]);
  if (!lastTime) return 0;

  const elapsed = Date.now() - parseInt(lastTime, 10);
  return Math.max(0, RATE_LIMIT_MS - elapsed);
};

// Format cooldown as minutes:seconds
const formatCooldown = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function PokeKissInterface() {
  const {
    sendPoke,
    sendKiss,
    unviewedCount,
    getUnviewedInteractions,
    markInteractionViewed,
    subscribeToInteractions,
  } = useAppStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isPoking, setIsPoking] = useState(false);
  const [isKissing, setIsKissing] = useState(false);
  const [isFarting, setIsFarting] = useState(false);
  const [showAnimation, setShowAnimation] = useState<AnimationType>(null);
  const [currentInteraction, setCurrentInteraction] = useState<Interaction | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Cooldown state
  const [pokeCooldown, setPokeCooldown] = useState(getCooldownRemaining('poke'));
  const [kissCooldown, setKissCooldown] = useState(getCooldownRemaining('kiss'));
  const [fartCooldown, setFartCooldown] = useState(getCooldownRemaining('fart'));

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const isSubscribingRef = useRef(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Update cooldowns every second
  useEffect(() => {
    const timer = setInterval(() => {
      setPokeCooldown(getCooldownRemaining('poke'));
      setKissCooldown(getCooldownRemaining('kiss'));
      setFartCooldown(getCooldownRemaining('fart'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Subscribe to real-time interactions on mount
  useEffect(() => {
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

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
        console.log('[PokeKissInterface] Unsubscribed from interactions');
      }
    };
  }, []);

  // Handle Poke button click
  const handlePoke = async () => {
    if (pokeCooldown > 0) {
      setShowToast(`Wait ${formatCooldown(pokeCooldown)} before poking again`);
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    const partnerId = await getPartnerId();
    if (!partnerId) {
      console.error('[PokeKissInterface] No partner ID configured');
      setShowToast('Error: Partner not configured');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsPoking(true);
    setIsExpanded(false);

    try {
      await sendPoke(partnerId);
      localStorage.setItem(RATE_LIMIT_KEYS.poke, Date.now().toString());
      setPokeCooldown(RATE_LIMIT_MS);
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
    if (kissCooldown > 0) {
      setShowToast(`Wait ${formatCooldown(kissCooldown)} before kissing again`);
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    const partnerId = await getPartnerId();
    if (!partnerId) {
      console.error('[PokeKissInterface] No partner ID configured');
      setShowToast('Error: Partner not configured');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsKissing(true);
    setIsExpanded(false);

    try {
      await sendKiss(partnerId);
      localStorage.setItem(RATE_LIMIT_KEYS.kiss, Date.now().toString());
      setKissCooldown(RATE_LIMIT_MS);
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

  // Handle Fart button click
  const handleFart = async () => {
    if (fartCooldown > 0) {
      setShowToast(`Wait ${formatCooldown(fartCooldown)} before farting again`);
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsFarting(true);
    setIsExpanded(false);

    try {
      localStorage.setItem(RATE_LIMIT_KEYS.fart, Date.now().toString());
      setFartCooldown(RATE_LIMIT_MS);
      setShowAnimation('fart');
      setShowToast('💨 Fart sent!');
      setTimeout(() => setShowToast(null), 2000);
    } finally {
      setIsFarting(false);
    }
  };

  // Handle notification badge click
  const handleBadgeClick = () => {
    const unviewed = getUnviewedInteractions();
    if (unviewed.length === 0) return;

    const interaction = unviewed[0];
    setCurrentInteraction(interaction);
    setShowAnimation(interaction.type);
  };

  // Handle animation completion
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

  // Action button config
  const actionButtons = [
    {
      id: 'history',
      icon: History,
      label: 'History',
      onClick: () => { setShowHistory(true); setIsExpanded(false); },
      gradient: 'from-purple-400 to-purple-500',
      disabled: false,
      cooldown: 0,
    },
    {
      id: 'poke',
      icon: Hand,
      label: 'Poke',
      onClick: handlePoke,
      gradient: 'from-pink-400 to-pink-500',
      disabled: isPoking || pokeCooldown > 0,
      cooldown: pokeCooldown,
      isLoading: isPoking,
    },
    {
      id: 'kiss',
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 fill-current">
          <path d="M12 8c-2.5-2-5-2-7 0-1 1-1 3-1 5s1 4 2 5c2 2 4 2 6 0 2 2 4 2 6 0 1-1 2-3 2-5s0-4-1-5c-2-2-4.5-2-7 0Z"/>
        </svg>
      ),
      label: 'Kiss',
      onClick: handleKiss,
      gradient: 'from-red-400 to-pink-500',
      disabled: isKissing || kissCooldown > 0,
      cooldown: kissCooldown,
      isLoading: isKissing,
    },
    {
      id: 'fart',
      icon: Wind,
      label: 'Fart',
      onClick: handleFart,
      gradient: 'from-green-400 to-green-600',
      disabled: isFarting || fartCooldown > 0,
      cooldown: fartCooldown,
      isLoading: isFarting,
    },
  ];

  return (
    <>
      <div ref={containerRef} className="relative inline-flex items-center" data-testid="poke-kiss-interface">
        {/* Action Buttons (expand upward) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col-reverse items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {actionButtons.map((button, index) => {
                const Icon = button.icon;
                return (
                  <motion.button
                    key={button.id}
                    onClick={button.onClick}
                    disabled={button.disabled}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { delay: index * 0.05 }
                    }}
                    exit={{
                      opacity: 0,
                      y: 10,
                      scale: 0.8,
                      transition: { delay: (actionButtons.length - index) * 0.03 }
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      relative flex items-center gap-2 px-4 py-2 rounded-full
                      bg-gradient-to-br ${button.gradient}
                      text-white text-sm font-medium shadow-lg
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-shadow hover:shadow-xl
                    `}
                    data-testid={`${button.id}-button`}
                    aria-label={button.label}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{button.label}</span>
                    {button.cooldown > 0 && (
                      <span className="text-xs opacity-75">
                        ({formatCooldown(button.cooldown)})
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            relative flex items-center justify-center w-14 h-14 rounded-full
            bg-gradient-to-br from-pink-500 to-rose-500
            text-white shadow-lg hover:shadow-xl
            transition-all duration-300
          `}
          data-testid="fab-main-button"
          aria-label={isExpanded ? 'Close actions' : 'Open actions'}
          aria-expanded={isExpanded}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <X className="w-6 h-6" />
            ) : (
              <Heart className="w-6 h-6 fill-current" />
            )}
          </motion.div>

          {/* Notification Badge */}
          {unviewedCount > 0 && !isExpanded && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                handleBadgeClick();
              }}
              data-testid="notification-badge"
              aria-label={`${unviewedCount} unviewed interaction${unviewedCount === 1 ? '' : 's'}`}
            >
              {unviewedCount}
              <motion.div
                className="absolute inset-0 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ opacity: 0.4 }}
              />
            </motion.div>
          )}
        </motion.button>

        {/* Animation Overlays */}
        <AnimatePresence>
          {showAnimation === 'poke' && <PokeAnimation onComplete={handleAnimationComplete} />}
          {showAnimation === 'kiss' && <KissAnimation onComplete={handleAnimationComplete} />}
          {showAnimation === 'fart' && <FartAnimation onComplete={() => setShowAnimation(null)} />}
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
        transition={{ duration: 0.8, ease: 'easeOut' }}
        onAnimationComplete={() => setTimeout(onComplete, 500)}
      >
        👆
      </motion.div>
    </motion.div>
  );
}

/**
 * Kiss Animation Component
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
      {hearts.map((i) => (
        <motion.div
          key={i}
          className="absolute text-6xl"
          style={{ left: `${20 + i * 10}%`, bottom: '-10%' }}
          initial={{ opacity: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -400, -500, -600],
            scale: [0, 1, 1.2, 1],
            x: [0, Math.sin(i) * 50, Math.sin(i) * 100],
          }}
          transition={{ duration: 1.2, delay: i * 0.1, ease: 'easeOut' }}
          onAnimationComplete={() => {
            if (i === hearts.length - 1) setTimeout(onComplete, 300);
          }}
        >
          💗
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Fart Animation Component
 */
function FartAnimation({ onComplete }: { onComplete: () => void }) {
  const clouds = Array.from({ length: 5 }, (_, i) => i);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-yellow-50/40 backdrop-blur-sm overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      data-testid="fart-animation"
    >
      <motion.div
        className="text-9xl"
        initial={{ scale: 0, rotate: 0 }}
        animate={{
          scale: [0, 1.5, 1.2, 1.3, 1],
          rotate: [0, -10, 10, -5, 0],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        💩
      </motion.div>

      {clouds.map((i) => (
        <motion.div
          key={i}
          className="absolute text-4xl"
          style={{ top: '50%', left: '50%' }}
          initial={{ opacity: 0, scale: 0, x: '-50%', y: '-50%' }}
          animate={{
            opacity: [0, 0.8, 0.6, 0],
            scale: [0.5, 2, 3, 4],
            x: ['-50%', `${(i - 2) * 100}px`, `${(i - 2) * 200}px`],
            y: ['-50%', `${Math.sin(i) * 50}px`, `${Math.sin(i) * 100}px`],
          }}
          transition={{ duration: 1.5, delay: i * 0.1, ease: 'easeOut' }}
          onAnimationComplete={() => {
            if (i === clouds.length - 1) setTimeout(onComplete, 300);
          }}
        >
          💨
        </motion.div>
      ))}

      <motion.div
        className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-yellow-200/30 to-green-200/30"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2, 3], opacity: [0.5, 0.3, 0] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </motion.div>
  );
}
