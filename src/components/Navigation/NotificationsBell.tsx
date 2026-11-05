/**
 * NotificationsBell
 *
 * The native shell's header bell, in the header's top-left slot (AppNavigation
 * renders it there only under `Capacitor.isNativePlatform()`; the website keeps
 * the empty span). It is sized and coloured like the Settings gear, and carries
 * a dot while a live update is ready (`nativeUpdates`' status). A tap opens the
 * Notifications drop-down under it, a general list whose only kind of entry
 * today is "Update now"; a tap on the entry closes the list and opens the
 * update confirm dialog (`openUpdateConfirm`). Opening the list never clears the
 * dot: only applying the update does, by reloading the web view.
 *
 * The drop-down is an overlay, not a view: no URL, no history entry. It is
 * portalled to <body>, because the header's backdrop-filter makes it the
 * containing block of any fixed child. A transparent full-screen catcher under
 * the card takes a tap outside it, so that tap closes the list and presses
 * nothing underneath, the bell included. It also closes on a change of view and
 * when the app goes to the background.
 */
import { AnimatePresence, m as motion, useReducedMotion } from 'motion/react';
import { Bell, RefreshCw } from 'lucide-react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getUpdateStatus, openUpdateConfirm, subscribeUpdateStatus } from '../../services/nativeUpdates';
import type { ViewType } from '../../stores/slices/navigationSlice';
import { GROUP_TILE } from '../shared/kitClasses';

interface NotificationsBellProps {
  /** The current view; a change closes the drop-down. */
  currentView: ViewType;
}

export function NotificationsBell({ currentView }: NotificationsBellProps) {
  const status = useSyncExternalStore(subscribeUpdateStatus, getUpdateStatus);
  const updateReady = status.state === 'ready';
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const labelId = useId();

  // A change of view closes the list (adjusting state while rendering, so the
  // new view never paints with it open).
  const [openedView, setOpenedView] = useState(currentView);
  if (openedView !== currentView) {
    setOpenedView(currentView);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setOpen(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [open]);

  const handleEntryTap = () => {
    setOpen(false);
    openUpdateConfirm();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:text-ink active:text-ink ${
          open ? 'text-ink' : 'text-muted'
        }`}
        data-testid="nav-notifications"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        <Bell className="h-5 w-5" />
        {updateReady && (
          <span
            className="absolute top-2.5 right-2.75 h-2.5 w-2.5 rounded-full bg-fill ring-2 ring-glass"
            data-testid="nav-notifications-dot"
            aria-hidden="true"
          />
        )}
      </button>

      {createPortal(
        <>
          {open && (
            <div
              className="fixed inset-0 z-105"
              onClick={() => setOpen(false)}
              data-testid="notifications-catcher"
              aria-hidden="true"
            />
          )}
          <AnimatePresence>
            {open && (
              <motion.div
                key="notifications-list"
                id={listId}
                role="group"
                aria-labelledby={labelId}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                // Hangs 4px below the header (4rem under the status bar), lined
                // up with the bell's 12px inset; narrowed to fit between the dock
                // sides and two gutters, and scrolls past 12px above the dock.
                style={{
                  top: 'calc(env(safe-area-inset-top) + 4rem + 4px)',
                  width: 'min(320px, calc(100vw - var(--dock-left) - var(--dock-right) - 32px))',
                  maxHeight:
                    'calc(100dvh - env(safe-area-inset-top) - 4rem - 4px - var(--dock-top) - 12px)',
                }}
                className="fixed left-3 z-110 flex flex-col overflow-y-auto rounded-[20px] border border-line bg-card p-2 shadow-float"
                data-testid="notifications-list"
              >
                <span
                  id={labelId}
                  className="px-2 pt-1.5 pb-2 text-xs font-semibold tracking-[.08em] text-muted uppercase"
                >
                  Notifications
                </span>
                {updateReady ? (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={handleEntryTap}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent active:bg-tint"
                      data-testid="notifications-update-entry"
                    >
                      <span className={GROUP_TILE} aria-hidden="true">
                        <RefreshCw className="h-4.5 w-4.5" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] font-semibold text-ink">Update now</span>
                        <span className="text-[13px] leading-[1.4] text-muted">
                          A new version of My Love is ready.
                        </span>
                      </span>
                    </button>
                  </div>
                ) : (
                  <p
                    className="flex min-h-11 items-center justify-center text-sm text-muted"
                    data-testid="notifications-empty"
                  >
                    No notifications
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
}
