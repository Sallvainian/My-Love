import { motion } from 'framer-motion';
import { Heart, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

interface WelcomeSplashProps {
  onContinue: () => void;
}

// Generate random heart configurations for smooth raining effect
const generateHearts = () => {
  const heartEmojis = ['💕', '💖', '💗', '❤️', '💝'];
  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
    emoji: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
    x: Math.random() * 100, // Random horizontal position (0-100%)
    size: [24, 32, 40][Math.floor(Math.random() * 3)], // Random size (small, medium, large)
    delay: i * 0.4, // Stagger start times
    duration: 4 + Math.random() * 2, // 4-6 seconds fall duration
    drift: (Math.random() - 0.5) * 30, // Horizontal drift amount
  }));
};

export function WelcomeSplash({ onContinue }: WelcomeSplashProps) {
  const hearts = useMemo(() => generateHearts(), []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 relative overflow-hidden">
      {/* Raining hearts animation */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            className="absolute will-change-transform"
            style={{
              left: `${heart.x}%`,
              fontSize: `${heart.size}px`,
              opacity: 0.25,
              top: '-100px',
            }}
            animate={{
              y: ['0vh', '110vh'],
              x: [0, heart.drift],
              rotate: [0, 180],
            }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              repeat: Infinity,
              ease: 'linear',
              repeatDelay: 0,
            }}
          >
            {heart.emoji}
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-2xl w-full relative z-10"
      >
        <div className="card relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 to-rose-100/50 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Animated heart */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-8 flex justify-center"
            >
              <Heart className="w-20 h-20 text-pink-500 fill-pink-500" />
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-6"
            >
              Welcome to Your App
            </motion.h1>

            {/* Caption message */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8 font-serif"
            >
              I will never stop finding ways to express my love for you, here's just one of many
              more to come. From the bottom of my heart, I love you Baby Cakes
            </motion.p>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              onClick={onContinue}
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full hover:shadow-xl transition-all duration-300 font-medium text-lg hover:scale-105"
            >
              Continue
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
