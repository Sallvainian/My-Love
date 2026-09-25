/**
 * PokeKissInterface Component
 *
 * "Send a little something": a label row with the History link and its unviewed
 * count badge, over three action tiles (Poke / Kiss / Fart) for the partner.
 *
 * Features:
 * - Poke/Kiss/Fart tiles with cooldowns (remaining m:ss under the label)
 * - Notification badge showing unviewed interaction count
 * - Animation playback for received interactions
 * - History bottom sheet access
 *
 * AC Coverage:
 * - AC#1: Interaction buttons always visible as tiles
 * - AC#2: Tapping sends interaction to Supabase
 * - AC#3: Recipient receives notification badge
 * - AC#4: Animation playback (kiss hearts, poke nudge)
 * - AC#5: Mark interaction as viewed after animation
 */

import { AnimatePresence, m as motion } from 'motion/react';
import { Heart, RotateCcwClock, Wind, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import type { InteractionSubscriptionStatus } from '../../api/interactionService';
import { offlineMessage } from '../../services/accountDataError';
import { useAppStore } from '../../stores/useAppStore';
import type { Interaction } from '../../types';
import { NoPartnerError } from '../../utils/interactionValidation';
import { logger } from '../../utils/logger';
import { InteractionHistory } from '../InteractionHistory';

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

// Stamp the moment an interaction was sent, for getCooldownRemaining to measure against.
//
// Module scope here is load-bearing rather than tidiness. react-hooks/purity treats a
// Date.now() call reached from a component body as an impure read during render, and it
// flagged exactly the two senders that reach theirs after an `await` -- handleFart, whose
// identical write is never awaited past, went unreported. Reading the clock beside the
// helper that interprets it puts all three senders on the same footing and keeps the rule
// from re-firing the next time one of them grows an await.
const recordInteractionTime = (type: 'poke' | 'kiss' | 'fart'): void => {
  localStorage.setItem(RATE_LIMIT_KEYS[type], Date.now().toString());
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

  const [isPoking, setIsPoking] = useState(false);
  const [isKissing, setIsKissing] = useState(false);
  const [isFarting, setIsFarting] = useState(false);
  const [showAnimation, setShowAnimation] = useState<AnimationType>(null);
  const [currentInteraction, setCurrentInteraction] = useState<Interaction | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Playing the last unviewed interaction unmounts the badge, and a focused
  // element that unmounts drops focus to <body>. Whether the badge held focus
  // is recorded when it starts playback, because by the time playback ends a
  // click on the overlay may already have blurred it.
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const badgeOwnedFocusRef = useRef(false);
  const [badgeFocusCheck, setBadgeFocusCheck] = useState(0);

  // Cooldown state
  const [pokeCooldown, setPokeCooldown] = useState(getCooldownRemaining('poke'));
  const [kissCooldown, setKissCooldown] = useState(getCooldownRemaining('kiss'));
  const [fartCooldown, setFartCooldown] = useState(getCooldownRemaining('fart'));

  // Update cooldowns every second
  useEffect(() => {
    const timer = setInterval(() => {
      setPokeCooldown(getCooldownRemaining('poke'));
      setKissCooldown(getCooldownRemaining('kiss'));
      setFartCooldown(getCooldownRemaining('fart'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Runs after the commit that follows playback, so the badge has already
  // unmounted if the count reached 0. Only focus that fell to <body> is moved;
  // a control the user focused meanwhile keeps it.
  useEffect(() => {
    if (badgeFocusCheck === 0 || badgeRef.current) return;
    if (document.activeElement !== document.body) return;
    if (historyButtonRef.current?.isConnected) historyButtonRef.current.focus();
  }, [badgeFocusCheck]);

  // Subscribe to real-time interactions on mount
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const handleStatusChange = (status: InteractionSubscriptionStatus) => {
      if (cancelled) return;
      setConnectionWarning(
        status === 'SUBSCRIBED'
          ? null
          : 'Connection lost. Incoming pokes and kisses may not arrive.'
      );
    };

    subscribeToInteractions(handleStatusChange)
      .then((fn) => {
        if (cancelled) {
          // Unmounted before the subscribe promise resolved — tear down now.
          fn();
          return;
        }
        unsubscribe = fn;
        logger.info('[PokeKissInterface] Real-time interaction subscription created');
      })
      .catch((error) => {
        console.error('[PokeKissInterface] Failed to subscribe:', error);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        logger.debug('[PokeKissInterface] Unsubscribed from interactions');
      }
    };
  }, [subscribeToInteractions]);

  // Handle Poke button click
  const handlePoke = async () => {
    if (pokeCooldown > 0) {
      setShowToast(`Wait ${formatCooldown(pokeCooldown)} before poking again`);
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // Ahead of the send, not in the catch below. sendInteraction does throw its
    // own offline sentence, but the catch below maps every error that is not a
    // NoPartnerError to the generic "Failed to send poke. Try again.", so that
    // sentence never reaches the user. Interactions are Supabase-only -- no
    // queue, no retry -- so say plainly that a connection is needed.
    if (!isOnline()) {
      setShowToast('You are offline. A poke needs a connection to send.');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsPoking(true);

    try {
      await sendPoke();
      recordInteractionTime('poke');
      setPokeCooldown(RATE_LIMIT_MS);
      setShowToast('Poke sent!');
      setTimeout(() => setShowToast(null), 2000);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to send poke:', error);
      setShowToast(
        error instanceof NoPartnerError
          ? 'Error: Partner not configured'
          : 'Failed to send poke. Try again.'
      );
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

    // See the note in handlePoke: the offline guard has to precede the send.
    if (!isOnline()) {
      setShowToast('You are offline. A kiss needs a connection to send.');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsKissing(true);

    try {
      await sendKiss();
      recordInteractionTime('kiss');
      setKissCooldown(RATE_LIMIT_MS);
      setShowToast('Kiss sent!');
      setTimeout(() => setShowToast(null), 2000);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to send kiss:', error);
      setShowToast(
        error instanceof NoPartnerError
          ? 'Error: Partner not configured'
          : 'Failed to send kiss. Try again.'
      );
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

    try {
      recordInteractionTime('fart');
      setFartCooldown(RATE_LIMIT_MS);
      setShowAnimation('fart');
      setShowToast('Fart sent!');
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
    badgeOwnedFocusRef.current = document.activeElement === badgeRef.current;
    setCurrentInteraction(interaction);
    setShowAnimation(interaction.type);
  };

  // Handle animation completion
  const handleAnimationComplete = async () => {
    if (!currentInteraction) return;

    try {
      // The animation has played; only the "seen" write needs a connection.
      // Refused before the request, so the badge stays for the next tap.
      if (!isOnline()) {
        setShowToast(
          offlineMessage(
            currentInteraction.type === 'kiss' ? 'A kiss' : 'A poke',
            'be marked as seen',
            'needs'
          )
        );
        setTimeout(() => setShowToast(null), 3000);
        return;
      }
      await markInteractionViewed(currentInteraction.id);
      logger.debug('[PokeKissInterface] Interaction marked as viewed:', currentInteraction.id);
    } catch (error) {
      console.error('[PokeKissInterface] Failed to mark as viewed:', error);
    } finally {
      setShowAnimation(null);
      setCurrentInteraction(null);
      if (badgeOwnedFocusRef.current) {
        badgeOwnedFocusRef.current = false;
        setBadgeFocusCheck((check) => check + 1);
      }
    }
  };

  // Action tile config
  const actionTiles: {
    id: 'poke' | 'kiss' | 'fart';
    icon: LucideIcon;
    iconClassName?: string;
    label: string;
    onClick: () => void;
    disabled: boolean;
    cooldown: number;
  }[] = [
    {
      id: 'poke',
      icon: Zap,
      label: 'Poke',
      onClick: handlePoke,
      disabled: isPoking || pokeCooldown > 0,
      cooldown: pokeCooldown,
    },
    {
      id: 'kiss',
      icon: Heart,
      iconClassName: 'fill-current',
      label: 'Kiss',
      onClick: handleKiss,
      disabled: isKissing || kissCooldown > 0,
      cooldown: kissCooldown,
    },
    {
      id: 'fart',
      icon: Wind,
      label: 'Fart',
      onClick: handleFart,
      disabled: isFarting || fartCooldown > 0,
      cooldown: fartCooldown,
    },
  ];

  return (
    <>
      <section
        className="flex flex-col gap-3"
        aria-labelledby="poke-kiss-label"
        data-testid="poke-kiss-interface"
      >
        <AnimatePresence>
          {connectionWarning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-x-4 top-[calc(9rem+env(safe-area-inset-top))] z-50 mx-auto w-fit max-w-md overflow-hidden rounded-[20px] border border-line bg-card shadow-float"
              role="alert"
              aria-live="assertive"
              data-testid="interaction-connection-warning"
            >
              <p className="bg-dtint px-5 py-3 text-center text-sm font-medium text-danger">
                {connectionWarning}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Label row: section label + History link with the unviewed count */}
        <div className="flex items-center justify-between gap-3 px-1">
          <h2
            id="poke-kiss-label"
            className="text-xs font-semibold tracking-[.08em] text-muted uppercase"
          >
            Send a little something
          </h2>
          <div className="flex shrink-0 items-center">
            <button
              ref={historyButtonRef}
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold text-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="history-button"
            >
              <RotateCcwClock className="h-4 w-4" aria-hidden="true" />
              History
            </button>
            {/* Notification Badge. A button of its own, beside History rather
                than inside it (a button inside a button is invalid and cannot
                be reached by keyboard): it plays the oldest unviewed
                interaction -- the only path that marks one viewed. The margin
                plus History's right padding keeps the old inline gap.

                The visible 20px badge is far under the kit's 44px icon
                buttons, so the ::after pseudo-element widens the hit area
                without occupying any layout. Growth on each side is capped at
                the free space on that side, so it never covers History: 8px
                up and down fills the 36px row History sets, 2px left is the
                ml-0.5 gap, and 16px right stays inside the row's 4px padding
                plus the page's 16px gutter, clear of the viewport edge. */}
            {unviewedCount > 0 && (
              <motion.button
                ref={badgeRef}
                type="button"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative isolate ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fill px-1.5 text-[11px] font-bold text-white after:absolute after:-inset-y-2 after:-right-4 after:-left-0.5 after:content-[''] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                onClick={handleBadgeClick}
                data-testid="notification-badge"
                aria-label={
                  unviewedCount === 1
                    ? 'Play 1 unviewed interaction'
                    : `Play the oldest of ${unviewedCount} unviewed interactions`
                }
              >
                {unviewedCount}
                <motion.span
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-fill"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ opacity: 0.4 }}
                  aria-hidden="true"
                />
              </motion.button>
            )}
          </div>
        </div>

        {/* Action tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          {actionTiles.map((tile) => {
            const Icon = tile.icon;
            const cooldownId = `${tile.id}-cooldown`;
            return (
              <motion.button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                disabled={tile.disabled}
                whileTap={tile.disabled ? undefined : { scale: 0.96 }}
                className="flex min-h-23 min-w-0 flex-col items-center justify-center gap-2 rounded-[20px] bg-card px-1 py-2 text-sm font-semibold text-ink ring-1 ring-line ring-inset focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={`${tile.id}-button`}
                aria-label={tile.label}
                aria-describedby={tile.cooldown > 0 ? cooldownId : undefined}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint text-accent">
                  <Icon className={`h-5 w-5 ${tile.iconClassName ?? ''}`} aria-hidden="true" />
                </span>
                <span>{tile.label}</span>
                {tile.cooldown > 0 && (
                  <span
                    id={cooldownId}
                    className="-mt-1 text-xs font-medium text-muted tabular-nums"
                    data-testid={`${tile.id}-cooldown`}
                  >
                    {formatCooldown(tile.cooldown)}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

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
              className="fixed inset-x-4 top-[calc(5rem+env(safe-area-inset-top))] z-50 mx-auto w-fit max-w-md rounded-[20px] border border-line bg-card px-5 py-3 text-center text-sm font-medium text-ink shadow-float"
              data-testid="toast-notification"
            >
              {showToast}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Interaction History Sheet */}
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
        className="flex h-36 w-36 items-center justify-center rounded-full bg-card text-accent shadow-float"
        initial={{ scale: 0, rotate: 0 }}
        animate={{
          scale: [0, 1.2, 1],
          rotate: [0, -15, 15, -15, 15, 0],
          x: [0, -20, 20, -20, 20, 0],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        onAnimationComplete={() => setTimeout(onComplete, 500)}
      >
        <Zap className="h-20 w-20 fill-current" aria-hidden="true" />
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      data-testid="kiss-animation"
    >
      {hearts.map((i) => (
        <motion.div
          key={i}
          className={`absolute ${i % 2 === 0 ? 'text-accent' : 'text-partner'}`}
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
          <Heart className="h-14 w-14 fill-current" aria-hidden="true" />
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      data-testid="fart-animation"
    >
      <motion.div
        className="absolute h-64 w-64 rounded-full bg-tint"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2, 3], opacity: [0.5, 0.3, 0] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      <motion.div
        className="relative flex h-36 w-36 items-center justify-center rounded-full bg-card text-accent shadow-float"
        initial={{ scale: 0, rotate: 0 }}
        animate={{
          scale: [0, 1.5, 1.2, 1.3, 1],
          rotate: [0, -10, 10, -5, 0],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <Wind className="h-20 w-20" aria-hidden="true" />
      </motion.div>

      {clouds.map((i) => (
        <motion.div
          key={i}
          className="absolute text-partner"
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
          <Wind className="h-9 w-9" aria-hidden="true" />
        </motion.div>
      ))}
    </motion.div>
  );
}
