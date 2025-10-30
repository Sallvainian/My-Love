import { motion } from 'framer-motion';
import { Heart, ArrowRight } from 'lucide-react';

interface WelcomeSplashProps {
  onContinue: () => void;
}

export function WelcomeSplash({ onContinue }: WelcomeSplashProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-2xl w-full"
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
              more to come. From the bottom of my heart, I love you Gracie Baby
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
