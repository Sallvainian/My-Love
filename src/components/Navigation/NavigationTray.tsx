/**
 * NavigationTray
 *
 * App chrome: a sticky header carrying a hamburger that opens a focus-trapped
 * tray listing every destination. Replaces the fixed bottom tab bar, which had
 * run out of room at six destinations and whose 64px height five other files
 * hardcoded as an offset.
 *
 * Sticky rather than fixed, and outside <main>, on purpose. A fixed header is
 * invisible to layout, so every view would need a compensating top pad -- the
 * exact bug class the retired bar left behind at the other edge. In normal flow
 * the header simply occupies its 4rem, so App's `pb-16` is deleted rather than
 * swapped for a `pt-*`, and LoveNotes' `calc(100vh-4rem)` keeps meaning
 * "viewport minus the chrome" instead of becoming arbitrary.
 *
 * The badge slots ship empty. `badgeCounts` is filled by spec-partner-activity
 * later; allowing for the aggregate indicator now is cheaper than retrofitting
 * one onto a finished hamburger, and a per-destination badge inside a closed
 * tray is invisible without it.
 */
import { AnimatePresence, m as motion } from 'framer-motion';
import {
  BookOpen,
  Camera,
  Heart,
  Menu,
  MessageCircle,
  Settings as SettingsIcon,
  Smile,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { ViewType } from '../../stores/slices/navigationSlice';

/** Referenced by the hamburger's aria-controls, so it has to be stable. */
const PANEL_ID = 'nav-tray-panel';

interface Destination {
  view: ViewType;
  /** Doubles as the accessible name; the retired bar's labels are kept verbatim. */
  label: string;
  Icon: LucideIcon;
}

const DESTINATIONS: readonly Destination[] = [
  { view: 'home', label: 'Home', Icon: Heart },
  { view: 'mood', label: 'Mood', Icon: Smile },
  { view: 'notes', label: 'Love Notes', Icon: MessageCircle },
  { view: 'partner', label: 'Partner', Icon: Users },
  { view: 'photos', label: 'Photos', Icon: Camera },
  { view: 'scripture', label: 'Scripture', Icon: BookOpen },
  { view: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export interface NavigationTrayProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /**
   * Unseen counts per destination. Missing, zero or negative entries render no
   * badge, and an empty total renders no aggregate indicator on the hamburger,
   * which is the state this ships in.
   */
  badgeCounts?: Partial<Record<ViewType, number>>;
}

function pluralisedBadgeLabel(count: number): string {
  return `${count} new item${count === 1 ? '' : 's'}`;
}

export function NavigationTray({ currentView, onViewChange, badgeCounts }: NavigationTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // useFocusTrap lists onEscape in its effect deps and re-focuses
  // initialFocusRef on every run, so an unstable handler drags focus back to
  // the first destination on every render. Latest-ref plus an empty-dep
  // useCallback is the shape NoteRemoveConfirmation.tsx:58-67 settled on, and
  // it holds even though `close` is already stable here -- the stability is
  // then a property of this component rather than of one call site.
  const onCloseRef = useRef(close);
  useEffect(() => {
    onCloseRef.current = close;
  }, [close]);

  const handleEscape = useCallback(() => {
    onCloseRef.current();
  }, []);

  // Closing returns focus to the hamburger without anything here doing so:
  // useFocusTrap's restore effect is keyed on `enabled` alone, and the header
  // stays mounted behind the panel, so the opener is still connected.
  useFocusTrap(panelRef, isOpen, {
    onEscape: handleEscape,
    initialFocusRef: firstItemRef,
  });

  const aggregateCount = useMemo(() => {
    if (!badgeCounts) return 0;
    return DESTINATIONS.reduce((total, { view }) => {
      const count = badgeCounts[view] ?? 0;
      return count > 0 ? total + count : total;
    }, 0);
  }, [badgeCounts]);

  const handleSelect = (view: ViewType) => {
    onViewChange(view);
    setIsOpen(false);
  };

  return (
    <>
      <header
        className="safe-top sticky top-0 z-40 border-b border-gray-200 bg-white"
        data-testid="app-header"
      >
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="relative flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800"
            data-testid="nav-menu-toggle"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls={PANEL_ID}
          >
            <Menu className="h-6 w-6" />
            {aggregateCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1 text-xs font-bold text-white shadow-md"
                onClick={(e) => {
                  // The badge sits inside the toggle, so a bare click would
                  // both bubble and be handled here. Stop it and re-issue the
                  // open explicitly, so the badge is never a dead spot on the
                  // control it decorates.
                  e.stopPropagation();
                  setIsOpen(true);
                }}
                data-testid="nav-menu-badge"
                aria-label={pluralisedBadgeLabel(aggregateCount)}
              >
                {aggregateCount}
              </span>
            )}
          </button>

          {/* The app name rather than the active destination, and a span rather
              than a heading: Mood, Notes, Partner, Scripture and Settings each
              render their own level-1 heading naming themselves, so a chrome
              heading would duplicate that title on screen and make a
              level-1-heading query ambiguous -- which is exactly what broke
              notes/love-notes.spec.ts:27 when this was an h1. */}
          <span className="flex-1 truncate text-center text-lg font-semibold text-gray-800">
            My Love
          </span>

          {/* Balances the toggle so the title stays optically centred. */}
          <span aria-hidden="true" className="min-h-[48px] min-w-[48px]" />
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={close}
              data-testid="nav-tray-backdrop"
            />

            <motion.div
              ref={panelRef}
              id={PANEL_ID}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="safe-top safe-bottom fixed top-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-2xl outline-none"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              data-testid="nav-tray"
              tabIndex={-1}
            >
              <div className="flex h-16 items-center justify-between px-4">
                <span className="text-lg font-semibold text-gray-800">Menu</span>
                <button
                  type="button"
                  onClick={close}
                  className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  data-testid="nav-tray-close"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1 px-2 pb-4" aria-label="Primary">
                {DESTINATIONS.map(({ view, label, Icon }, index) => {
                  const isActive = currentView === view;
                  const count = badgeCounts?.[view] ?? 0;

                  return (
                    <button
                      key={view}
                      ref={index === 0 ? firstItemRef : undefined}
                      type="button"
                      onClick={() => handleSelect(view)}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-pink-50 text-pink-500'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      data-testid={`nav-${view}`}
                      aria-label={label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? 'fill-current' : ''}`} />
                      <span className="flex-1 text-base font-medium">{label}</span>
                      {count > 0 && (
                        <span
                          className="flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs font-bold text-white"
                          onClick={(e) => {
                            // Same reason as the aggregate: stop the bubble,
                            // then do what the row would have done, so the
                            // badge never swallows a tap on its own row.
                            e.stopPropagation();
                            handleSelect(view);
                          }}
                          data-testid={`nav-${view}-badge`}
                          aria-label={pluralisedBadgeLabel(count)}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
