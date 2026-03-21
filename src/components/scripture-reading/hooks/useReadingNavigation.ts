/**
 * useReadingNavigation Hook
 *
 * Manages verse navigation, step transitions, slide direction,
 * and related accessibility announcements/focus for the reading flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScriptureSession } from '../../../services/dbSchema';

// Sub-view within a step: verse or response
type StepSubView = 'verse' | 'response';

// Direction for slide animation
export type SlideDirection = 'left' | 'right';

interface UseReadingNavigationParams {
  session: ScriptureSession | null;
  advanceStep: () => Promise<void>;
  setAnnouncement: (text: string) => void;
}

export function useReadingNavigation({
  session,
  advanceStep,
  setAnnouncement,
}: UseReadingNavigationParams) {
  const [subView, setSubView] = useState<StepSubView>('verse');
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('left');

  // Story 1.5: Focus management refs (AC #3)
  const verseHeadingRef = useRef<HTMLParagraphElement>(null);
  const backToVerseRef = useRef<HTMLButtonElement>(null);

  // Story 1.5: Track previous values for announcement and focus logic
  const prevStepIndexRef = useRef<number | undefined>(undefined);
  const prevSubViewRef = useRef<StepSubView>('verse');

  // Navigation callbacks
  const handleNextVerse = useCallback(async () => {
    setSlideDirection('left');
    await advanceStep();
  }, [advanceStep]);

  const handleViewResponse = useCallback(() => {
    setSubView('response');
  }, []);

  const handleBackToVerse = useCallback(() => {
    setSubView('verse');
  }, []);

  // Story 1.5: Screen reader announcements + focus management on step change
  useEffect(() => {
    let focusRaf: number | null = null;

    if (
      session &&
      prevStepIndexRef.current !== undefined &&
      prevStepIndexRef.current !== session.currentStepIndex
    ) {
      setAnnouncement(`Now on verse ${session.currentStepIndex + 1}`);
      focusRaf = requestAnimationFrame(() => {
        verseHeadingRef.current?.focus();
      });
      prevStepIndexRef.current = session.currentStepIndex;
    } else {
      prevStepIndexRef.current = session?.currentStepIndex;
    }

    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [session?.currentStepIndex, session, setAnnouncement]);

  // Story 1.5 + 2.1: Screen reader announcements + focus management on sub-view change
  useEffect(() => {
    let focusRaf: number | null = null;

    if (prevSubViewRef.current !== subView) {
      if (subView === 'response') {
        setAnnouncement(`Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`);
        focusRaf = requestAnimationFrame(() => {
          backToVerseRef.current?.focus();
        });
      } else if (prevSubViewRef.current === 'response') {
        setAnnouncement(`Back to verse ${(session?.currentStepIndex ?? 0) + 1}`);
        focusRaf = requestAnimationFrame(() => {
          verseHeadingRef.current?.focus();
        });
      }
      prevSubViewRef.current = subView;
    }

    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [subView, session?.currentStepIndex, setAnnouncement]);

  return {
    subView,
    slideDirection,
    verseHeadingRef,
    backToVerseRef,
    handleNextVerse,
    handleViewResponse,
    handleBackToVerse,
  };
}
