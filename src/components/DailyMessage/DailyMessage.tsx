import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Heart, Share2, Sparkles } from 'lucide-react';
import { formatRelationshipDuration, getDaysSinceStart } from '../../utils/messageRotation';

export function DailyMessage() {
  const { currentMessage, settings, toggleFavorite } = useAppStore();
  const [showHearts, setShowHearts] = useState(false);

  if (!currentMessage || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
    setTimeout(() => setShowHearts(false), 1000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Love - Daily Message',
          text: currentMessage.text,
        });
      } catch (error) {
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
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: window.innerHeight,
                  opacity: 0,
                }}
                animate={{
                  y: -100,
                  opacity: [0, 1, 1, 0],
                  x: Math.random() * window.innerWidth,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
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
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-6"
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
        initial={{ scale: 0.9, opacity: 0, rotateY: -10 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 15,
          delay: 0.3,
        }}
        className="relative"
      >
        <div className="card card-hover relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10">
            {/* Category badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="inline-block mb-4"
            >
              <span className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded-full shadow-lg">
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
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-2xl md:text-3xl font-serif text-gray-800 leading-relaxed mb-8"
            >
              {currentMessage.text}
            </motion.p>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-between"
            >
              <button
                onClick={handleFavorite}
                className="btn-icon group"
                aria-label={currentMessage.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`w-6 h-6 transition-all duration-300 ${
                    currentMessage.isFavorite
                      ? 'fill-pink-500 text-pink-500 animate-heart'
                      : 'text-pink-400 group-hover:text-pink-500 group-hover:scale-110'
                  }`}
                />
              </button>

              <button
                onClick={handleShare}
                className="btn-icon group"
                aria-label="Share message"
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
              duration: 3,
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
              duration: 4,
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
        transition={{ delay: 1.2 }}
        className="text-center mt-6 text-sm text-gray-400"
      >
        Swipe left or right to see other messages
      </motion.div>
    </div>
  );
}

export default DailyMessage;
