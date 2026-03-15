import { m as motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Heart, Share2, RefreshCw, AlertCircle } from 'lucide-react';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import { APP_CONFIG } from '../../config/constants';
import { generateDeterministicNumbers } from '../../utils/deterministicRandom';
import { WelcomeButton } from '../WelcomeButton/WelcomeButton';
import { CountdownTimer } from '../CountdownTimer/CountdownTimer';
import { logger } from '@/utils/logger';

interface DailyMessageProps {
  onShowWelcome?: () => void;
}

export function DailyMessage({ onShowWelcome }: DailyMessageProps) {
  const {
    currentMessage,
    settings,
    messageHistory,
    toggleFavorite,
    error,
    initializeApp,
    navigateToPreviousMessage,
    navigateToNextMessage,
    canNavigateBack,
    canNavigateForward,
  } = useAppStore();
  const [showHearts, setShowHearts] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('left'); // Story 3.2: Track swipe direction

  const floatingHeartCount = ANIMATION_VALUES.FLOATING_HEARTS_COUNT;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;

  // Memoize deterministic positions once per viewport width. Positions stay
  // stable for consistent floating hearts animation.
  const heartPositions = useMemo(() => {
    const initialPositions = generateDeterministicNumbers(
      'daily-message-heart-initial',
      floatingHeartCount,
      0,
      viewportWidth
    );
    const animatePositions = generateDeterministicNumbers(
      'daily-message-heart-animate',
      floatingHeartCount,
      0,
      viewportWidth
    );

    return initialPositions.map((initialX, index) => ({
      initialX,
      animateX: animatePositions[index],
    }));
  }, [floatingHeartCount, viewportWidth]);

  // Check if current message is favorited (source of truth: messageHistory.favoriteIds)
  const isFavorited = currentMessage && messageHistory.favoriteIds.includes(currentMessage.id);

  // Story 3.2: Swipe gesture handler
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50; // 50px swipe threshold

    if (info.offset.x < -threshold && canNavigateBack()) {
      // Swipe left → card exits left, new card comes from right
      setDirection('right'); // 'right' = new card comes from right
      navigateToPreviousMessage();
    } else if (info.offset.x > threshold && canNavigateForward()) {
      // Swipe right → card exits right, new card comes from left
      setDirection('left'); // 'left' = new card comes from left
      navigateToNextMessage();
    }
  };

  // Story 3.2: Keyboard navigation (Phase 4)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canNavigateBack()) {
        event.preventDefault();
        setDirection('right'); // Arrow left should animate from right
        navigateToPreviousMessage();
      } else if (event.key === 'ArrowRight' && canNavigateForward()) {
        event.preventDefault();
        setDirection('left'); // Arrow right should animate from left
        navigateToNextMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canNavigateBack, canNavigateForward, navigateToPreviousMessage, navigateToNextMessage]);

  // Timeout after 10 seconds if still loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentMessage || !settings) {
        setLoadingTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [currentMessage, settings]);

  // Error or timeout state
  if (!currentMessage || !settings) {
    if (loadingTimeout || error) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4">
          <AlertCircle className="h-16 w-16 text-red-400" />

          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-red-600">
              {error || 'Failed to load message'}
            </h2>

            <p className="max-w-md text-sm text-gray-600">
              {!APP_CONFIG.isPreConfigured
                ? 'Environment variables not configured. Please create a .env.development file with VITE_PARTNER_NAME and VITE_RELATIONSHIP_START_DATE.'
                : 'Something went wrong during initialization. Please try refreshing the page.'}
            </p>
          </div>

          <button
            onClick={() => {
              setLoadingTimeout(false);
              initializeApp();
            }}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-medium text-white transition-shadow hover:shadow-lg"
          >
            <RefreshCw className="h-5 w-5" />
            Retry
          </button>

          <div className="max-w-sm text-center text-xs text-gray-400">
            If the problem persists, try clearing your browser data or check the browser console for
            more details.
          </div>
        </div>
      );
    }

    // Still loading (within timeout window)
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="animate-pulse text-6xl">💕</div>
        <div className="text-lg text-pink-400">Loading your daily message...</div>
      </div>
    );
  }

  const handleFavorite = async () => {
    setShowHearts(true);
    await toggleFavorite(currentMessage.id);
    setTimeout(() => setShowHearts(false), ANIMATION_TIMING.HEART_ANIMATION_DURATION);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Love - Daily Message',
          text: currentMessage.text,
        });
      } catch {
        // User cancelled share - this is expected behavior, no error handling needed
        logger.debug('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(currentMessage.text);
      alert('Message copied to clipboard!');
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8" data-testid="daily-message">
      {/* Floating hearts animation */}
      <AnimatePresence>
        {showHearts && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {heartPositions.map((pos, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl"
                initial={{
                  x: pos.initialX,
                  y: window.innerHeight,
                  opacity: 0,
                }}
                animate={{
                  y: ANIMATION_VALUES.FLOATING_HEARTS_TARGET_Y,
                  opacity: [0, 1, 1, 0],
                  x: pos.animateX,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: ANIMATION_VALUES.HEART_ANIMATION_DURATION_SECONDS,
                  delay: i * ANIMATION_TIMING.HEART_ANIMATION_DELAY_STEP,
                  ease: 'easeOut',
                }}
              >
                💕
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main message card */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentMessage.id}
          drag="x"
          dragConstraints={{
            left: -100,
            right: canNavigateForward() ? 100 : 0,
          }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{
            x: direction === 'left' ? -300 : 300, // direction indicates where new card comes FROM
            opacity: 0,
          }}
          animate={{
            x: 0,
            opacity: 1,
          }}
          exit={{
            x: direction === 'left' ? 300 : -300, // exit in opposite direction
            opacity: 0,
          }}
          transition={{
            type: 'tween',
            ease: 'easeOut',
            duration: 0.3,
          }}
          className="relative"
          tabIndex={0}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="card card-hover relative overflow-hidden" data-testid="message-card">
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50" />

            {/* Content */}
            <div className="relative z-10">
              {/* Category badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: ANIMATION_TIMING.BADGE_FADE_DELAY, type: 'spring' }}
                className="mb-4 inline-block"
              >
                <span
                  className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
                  data-testid="message-category-badge"
                >
                  {currentMessage.category === 'reason' && '💖 Why I Love You'}
                  {currentMessage.category === 'memory' && '✨ Beautiful Memory'}
                  {currentMessage.category === 'affirmation' && '🌟 Daily Affirmation'}
                  {currentMessage.category === 'future' && '🌈 Our Future'}
                  {currentMessage.category === 'custom' && '💕 Special Message'}
                </span>
              </motion.div>

              {/* Message text */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: ANIMATION_TIMING.TEXT_FADE_DELAY, duration: 0.8 }}
                className="mb-8 font-serif text-2xl leading-relaxed text-gray-800 md:text-3xl"
                data-testid="message-text"
              >
                {currentMessage.text}
              </motion.p>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ANIMATION_TIMING.BUTTON_FADE_DELAY }}
                className="flex items-center justify-between"
              >
                <button
                  onClick={handleFavorite}
                  className="btn-icon group"
                  aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  data-testid="message-favorite-button"
                >
                  <Heart
                    className={`h-6 w-6 transition-all duration-300 ${
                      isFavorited
                        ? 'animate-heart fill-pink-500 text-pink-500'
                        : 'text-pink-400 group-hover:scale-110 group-hover:text-pink-500'
                    }`}
                  />
                </button>

                <button
                  onClick={handleShare}
                  className="btn-icon group"
                  aria-label="Share message"
                  data-testid="message-share-button"
                >
                  <Share2 className="h-6 w-6 text-pink-400 transition-colors group-hover:text-pink-500" />
                </button>
              </motion.div>
            </div>

            {/* Decorative elements */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: ANIMATION_VALUES.DECORATIVE_EMOJI_FLOAT_DURATION,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="pointer-events-none absolute -top-4 -right-4 text-6xl opacity-20"
            >
              💕
            </motion.div>
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, -5, 0],
              }}
              transition={{
                duration: ANIMATION_VALUES.DECORATIVE_EMOJI_FLOAT_DURATION_ALT,
                repeat: Infinity,
                repeatType: 'reverse',
                delay: 1,
              }}
              className="pointer-events-none absolute -bottom-4 -left-4 text-5xl opacity-20"
            >
              💖
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_TIMING.HINT_FADE_DELAY }}
        className="mt-6 text-center text-sm text-gray-400"
      >
        Swipe left or right to see other messages
      </motion.div>

      {/* Story 6.6: Anniversary Countdown Timer */}
      {settings?.relationship.anniversaries && settings.relationship.anniversaries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8"
        >
          <CountdownTimer anniversaries={settings.relationship.anniversaries} maxDisplay={3} />
        </motion.div>
      )}

      {/* Welcome message trigger button */}
      {onShowWelcome && <WelcomeButton onClick={onShowWelcome} />}
    </div>
  );
}

export default DailyMessage;
