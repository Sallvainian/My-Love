import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Heart, Share2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { formatRelationshipDuration, getDaysSinceStart } from '../../utils/messageRotation';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import { APP_CONFIG } from '../../config/constants';

export function DailyMessage() {
  const { currentMessage, settings, messageHistory, toggleFavorite, error, initializeApp } = useAppStore();
  const [showHearts, setShowHearts] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Check if current message is favorited (source of truth: messageHistory.favoriteIds)
  const isFavorited = currentMessage && messageHistory.favoriteIds.includes(currentMessage.id);

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
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 px-4">
          <AlertCircle className="w-16 h-16 text-red-400" />

          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">
              {error || 'Failed to load message'}
            </h2>

            <p className="text-gray-600 text-sm max-w-md">
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
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full hover:shadow-lg transition-shadow font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>

          <div className="text-xs text-gray-400 text-center max-w-sm">
            If the problem persists, try clearing your browser data or check the browser console for more details.
          </div>
        </div>
      );
    }

    // Still loading (within timeout window)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-6xl animate-pulse">💕</div>
        <div className="text-pink-400 text-lg">Loading your daily message...</div>
      </div>
    );
  }

  const startDate = new Date(settings.relationship.startDate);
  const daysTogether = getDaysSinceStart(startDate);
  const durationText = formatRelationshipDuration(startDate);

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
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(currentMessage.text);
      alert('Message copied to clipboard!');
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto px-4 py-8">
      {/* Floating hearts animation */}
      <AnimatePresence>
        {showHearts && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(ANIMATION_VALUES.FLOATING_HEARTS_COUNT)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: window.innerHeight,
                  opacity: 0,
                }}
                animate={{
                  y: ANIMATION_VALUES.FLOATING_HEARTS_TARGET_Y,
                  opacity: [0, 1, 1, 0],
                  x: Math.random() * window.innerWidth,
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

      {/* Header with relationship stats */}
      <motion.div
        initial={{ opacity: 0, y: ANIMATION_VALUES.HEADER_INITIAL_Y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: ANIMATION_TIMING.HEADER_FADE_DELAY }}
        className="text-center mb-6"
        data-testid="message-duration-counter"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-pink-400 animate-pulse" />
          <h2 className="text-lg font-semibold text-gray-700">
            Day {daysTogether} Together
          </h2>
          <Sparkles className="w-5 h-5 text-pink-400 animate-pulse" />
        </div>
        <p className="text-sm text-gray-500">{durationText}</p>
      </motion.div>

      {/* Main message card */}
      <motion.div
        key={currentMessage.id}
        initial={{ scale: ANIMATION_VALUES.CARD_INITIAL_SCALE, opacity: 0, rotateY: ANIMATION_VALUES.CARD_INITIAL_ROTATE_Y }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{
          type: 'spring',
          stiffness: ANIMATION_VALUES.SPRING_STIFFNESS,
          damping: ANIMATION_VALUES.SPRING_DAMPING,
          delay: ANIMATION_TIMING.CARD_FADE_DELAY,
        }}
        className="relative"
      >
        <div className="card card-hover relative overflow-hidden" data-testid="message-card">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10">
            {/* Category badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: ANIMATION_TIMING.BADGE_FADE_DELAY, type: 'spring' }}
              className="inline-block mb-4"
            >
              <span className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded-full shadow-lg" data-testid="message-category-badge">
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
              className="text-2xl md:text-3xl font-serif text-gray-800 leading-relaxed mb-8"
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
                  className={`w-6 h-6 transition-all duration-300 ${
                    isFavorited
                      ? 'fill-pink-500 text-pink-500 animate-heart'
                      : 'text-pink-400 group-hover:text-pink-500 group-hover:scale-110'
                  }`}
                />
              </button>

              <button
                onClick={handleShare}
                className="btn-icon group"
                aria-label="Share message"
                data-testid="message-share-button"
              >
                <Share2 className="w-6 h-6 text-pink-400 group-hover:text-pink-500 transition-colors" />
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
            className="absolute -top-4 -right-4 text-6xl opacity-20 pointer-events-none"
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
            className="absolute -bottom-4 -left-4 text-5xl opacity-20 pointer-events-none"
          >
            💖
          </motion.div>
        </div>
      </motion.div>

      {/* Navigation hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_TIMING.HINT_FADE_DELAY }}
        className="text-center mt-6 text-sm text-gray-400"
      >
        Swipe left or right to see other messages
      </motion.div>
    </div>
  );
}

export default DailyMessage;
