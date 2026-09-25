import { AnimatePresence, m as motion, type PanInfo } from 'framer-motion';
import {
  CircleAlert,
  Heart,
  MessageCircleHeart,
  Rainbow,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import { useAppStore } from '../../stores/useAppStore';
import { generateDeterministicNumbers } from '../../utils/deterministicRandom';
import { logger } from '../../utils/logger';
import type { MessageCategory } from '../../types';
import { CountdownTimer } from '../CountdownTimer/CountdownTimer';

interface DailyMessageProps {
  /**
   * Reserved until the welcome trigger moves to Settings (story 7): App still
   * passes it, but Home no longer renders a welcome button, so it is unused.
   */
  onShowWelcome?: () => void;
}

/** Category chip: a lucide icon and a plain label per message category. */
const CATEGORY_CHIPS: Record<MessageCategory, { Icon: LucideIcon; label: string }> = {
  reason: { Icon: Heart, label: 'Why I Love You' },
  memory: { Icon: Sparkles, label: 'Beautiful Memory' },
  affirmation: { Icon: Star, label: 'Daily Affirmation' },
  future: { Icon: Rainbow, label: 'Our Future' },
  custom: { Icon: MessageCircleHeart, label: 'Special Message' },
};

export function DailyMessage(_props: DailyMessageProps) {
  const {
    currentMessage,
    userId,
    settings,
    messageHistory,
    toggleFavorite,
    favoriteError,
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
        <div className="flex min-h-100 flex-col items-center justify-center gap-6 px-4">
          <CircleAlert className="h-16 w-16 text-muted" />

          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-ink">
              {error || 'Failed to load message'}
            </h2>

            <p className="max-w-md text-sm text-muted">
              Something went wrong during initialization. Please try refreshing the page.
            </p>
          </div>

          <button
            onClick={() => {
              setLoadingTimeout(false);
              initializeApp();
            }}
            className="flex min-h-11 items-center gap-2 rounded-full bg-fill px-6 py-3 font-semibold text-white"
          >
            <RefreshCw className="h-5 w-5" />
            Retry
          </button>

          <div className="max-w-sm text-center text-xs text-muted">
            If the problem persists, try clearing your browser data or check the browser console for
            more details.
          </div>
        </div>
      );
    }

    // Still loading (within timeout window)
    return (
      <div className="flex min-h-100 flex-col items-center justify-center gap-4">
        <Heart className="h-14 w-14 animate-pulse fill-current text-accent" aria-hidden="true" />
        <div className="text-lg text-muted">Loading your daily message...</div>
      </div>
    );
  }

  const categoryChip = CATEGORY_CHIPS[currentMessage.category];

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
    <div className="relative w-full" data-testid="daily-message">
      {/* Floating hearts animation */}
      <AnimatePresence>
        {showHearts && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {heartPositions.map((pos, i) => (
              <motion.div
                key={i}
                className="absolute"
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
                <Heart className="h-9 w-9 fill-current text-accent" aria-hidden="true" />
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
          <div
            className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-card p-5 shadow-card"
            data-testid="message-card"
          >
            {/* Category chip */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: ANIMATION_TIMING.BADGE_FADE_DELAY, type: 'spring' }}
              className="flex"
            >
              <span
                className="flex h-7 items-center gap-2 rounded-full bg-tint px-3 text-xs font-semibold text-accent"
                data-testid="message-category-badge"
              >
                {categoryChip && (
                  <>
                    <categoryChip.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {categoryChip.label}
                  </>
                )}
              </span>
            </motion.div>

            {/* Message text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: ANIMATION_TIMING.TEXT_FADE_DELAY, duration: 0.8 }}
              className="font-lora text-[21px] leading-[1.45] font-medium text-ink italic"
              data-testid="message-text"
            >
              {currentMessage.text}
            </motion.p>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_TIMING.BUTTON_FADE_DELAY }}
              className="flex items-center gap-2"
            >
              <button
                onClick={handleFavorite}
                disabled={!userId}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-accent"
                aria-label={!userId ? 'Sign in to save favorites' : isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                data-testid="message-favorite-button"
              >
                <Heart
                  className={`h-5 w-5 ${isFavorited ? 'animate-heart fill-current' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <button
                onClick={handleShare}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-muted"
                aria-label="Share message"
                data-testid="message-share-button"
              >
                <Share2 className="h-5 w-5" aria-hidden="true" />
              </button>

              {favoriteError && (
                <p
                  role="alert"
                  className="ml-1 flex-1 text-sm text-danger"
                  data-testid="message-favorite-error"
                >
                  {favoriteError}
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_TIMING.HINT_FADE_DELAY }}
        className="mt-6 text-center text-sm text-muted"
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
    </div>
  );
}
