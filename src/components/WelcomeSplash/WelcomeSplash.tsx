import { m as motion } from 'framer-motion';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 px-4">
      {/* Raining hearts animation */}
      <div className="pointer-events-none fixed inset-0 z-0">
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
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="card relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-100/50 to-rose-100/50" />

          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Animated heart */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-8 flex justify-center"
            >
              <Heart className="h-20 w-20 fill-pink-500 text-pink-500" />
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl"
            >
              Welcome to Your App
            </motion.h1>

            {/* Caption message */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-8 font-serif text-lg leading-relaxed text-gray-700 md:text-xl"
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
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-4 text-lg font-medium text-white transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              Continue
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
