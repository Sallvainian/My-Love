import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useState } from 'react';

interface WelcomeButtonProps {
  onClick: () => void;
}

export function WelcomeButton({ onClick }: WelcomeButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full right-0 mb-3 hidden md:block pointer-events-none"
          >
            <div className="bg-white/90 backdrop-blur-sm text-pink-600 px-4 py-2 rounded-full shadow-lg whitespace-nowrap text-sm font-medium">
              View welcome message again
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.5,
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        onClick={onClick}
        className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg hover:shadow-2xl transition-shadow duration-300 flex items-center justify-center group"
        aria-label="View welcome message again"
      >
        <Heart className="w-6 h-6 fill-white" />

        {/* Subtle pulse animation */}
        <motion.div
          className="absolute inset-0 rounded-full bg-pink-400"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'loop',
          }}
        />
      </motion.button>
    </div>
  );
}
