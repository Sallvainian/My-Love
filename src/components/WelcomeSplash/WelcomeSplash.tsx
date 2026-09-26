import { m as motion } from 'motion/react';
import { ArrowRight, Heart } from 'lucide-react';
import { useMemo } from 'react';
import { PRIMARY_BUTTON } from '../shared/kitClasses';

interface WelcomeSplashProps {
  onContinue: () => void;
}

// Generate random heart configurations for smooth raining effect
const generateHearts = () => {
  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
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
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-4"
      data-testid="welcome-splash"
    >
      {/* Raining hearts animation */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        data-testid="welcome-heart-rain"
      >
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            data-testid="welcome-heart-drop"
            className="absolute text-accent will-change-transform"
            style={{
              left: `${heart.x}%`,
              width: `${heart.size}px`,
              height: `${heart.size}px`,
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
            <Heart
              className="h-full w-full fill-current"
              strokeWidth={0}
              data-testid="welcome-heart-drop-icon"
            />
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div
          className="rounded-[20px] border border-line bg-card p-5 text-center shadow-card"
          data-testid="welcome-card"
        >
          {/* Animated heart */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-6 flex justify-center"
          >
            <Heart className="h-20 w-20 fill-current text-accent" strokeWidth={0} />
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-4 font-serif text-[30px] leading-[1.1] font-semibold text-ink"
          >
            Welcome to Your App
          </motion.h1>

          {/* Caption message */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-6 text-[15px] leading-relaxed text-ink"
            data-testid="welcome-caption"
          >
            I will never stop finding ways to express my love for you, here's just one of many
            more to come. From the bottom of my heart, I love you Baby Cakes
          </motion.p>

          {/* Continue button. The fade-in rides on a wrapper so Motion's inline
              opacity never fights the pill's hover opacity. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mx-auto flex max-w-xs"
          >
            <button
              type="button"
              onClick={onContinue}
              data-testid="welcome-continue-button"
              className={PRIMARY_BUTTON}
            >
              Continue
              <ArrowRight
                className="h-5 w-5"
                aria-hidden="true"
                data-testid="welcome-continue-icon"
              />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
