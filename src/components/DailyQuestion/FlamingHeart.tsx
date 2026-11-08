/**
 * FlamingHeart -- the milestone screen's flaming heart (the design's
 * `Milestone` board): an outer flame, an inner flame and a heart rotated -8
 * degrees with two highlight ellipses, on a 64 x 64 canvas.
 *
 * The flaming heart is used only by the milestone screen (`Milestone.tsx`):
 * the counter, the +1, the Partner card and the dock keep the plain `Flame`.
 * With `animated` the flames flicker and the heart beats (the keyframes are in
 * `index.css`, each also off under `motion-reduce`); without it the picture is
 * still, as the badges always are. The gradient hexes are illustration colours,
 * the same in both themes, so they are named here and not kit tokens. The
 * gradient ids come from `useId()` so several hearts on one page never share
 * one.
 *
 * @component
 */

import { useId } from 'react';

const OUTER_FLAME = ['#f97316', '#fb923c', '#fcd34d'] as const;
const INNER_FLAME = ['#fbbf24', '#fef08a'] as const;
const HEART = ['#ef4444', '#dc2626', '#f97316'] as const;
const HEART_EDGE = '#991b1b';
const HIGHLIGHT = '#fff';

const FLAME_BASE = '[transform-box:fill-box] origin-bottom';
const OUTER_ANIMATION = 'animate-flame-outer motion-reduce:animate-none';
const INNER_ANIMATION = 'animate-flame-inner motion-reduce:animate-none';
const HEART_ANIMATION = 'animate-heart-beat-flame motion-reduce:animate-none';

export function FlamingHeart({
  size,
  animated,
  className,
  testId,
  highlights = true,
}: {
  /** Width and height in px. */
  size: number;
  animated: boolean;
  className?: string;
  testId?: string;
  /** The two white highlight ellipses on the heart; the badges leave them out. */
  highlights?: boolean;
}) {
  const id = useId();
  const outerId = `${id}-outer`;
  const innerId = `${id}-inner`;
  const heartId = `${id}-heart`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      style={{ overflow: 'visible' }}
      data-animated={animated ? 'true' : 'false'}
      data-testid={testId}
    >
      <defs>
        <linearGradient id={outerId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={OUTER_FLAME[0]} />
          <stop offset=".55" stopColor={OUTER_FLAME[1]} />
          <stop offset="1" stopColor={OUTER_FLAME[2]} />
        </linearGradient>
        <linearGradient id={innerId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={INNER_FLAME[0]} />
          <stop offset="1" stopColor={INNER_FLAME[1]} />
        </linearGradient>
        <linearGradient id={heartId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={HEART[0]} />
          <stop offset=".55" stopColor={HEART[1]} />
          <stop offset="1" stopColor={HEART[2]} />
        </linearGradient>
      </defs>
      <path
        className={animated ? `${FLAME_BASE} ${OUTER_ANIMATION}` : undefined}
        d="M31 61C15 58 6 47 7 34c1-8 5-13 8-21 1 5 1 9 3 11 0-7 4-14 7-20 2 8 2 13 5 16 2-6 6-10 9-15 0 7 1 12 4 15 2-3 4-6 4-10 7 9 11 21 8 32-3 11-12 18-24 19Z"
        fill={`url(#${outerId})`}
        stroke="none"
      />
      <path
        className={animated ? `${FLAME_BASE} ${INNER_ANIMATION}` : undefined}
        d="M31 57C20 55 13 47 13 37c0-6 3-10 5-15 1 4 2 6 4 7 0-6 3-11 6-15 1 6 2 10 5 12 2-4 4-7 7-10 0 5 1 9 3 11 1-2 2-4 2-6 4 6 6 14 4 21-2 9-9 14-18 15Z"
        fill={`url(#${innerId})`}
        stroke="none"
      />
      <g
        className={
          animated ? `origin-[50%_60%] [transform-box:fill-box] ${HEART_ANIMATION}` : undefined
        }
      >
        <g transform="rotate(-8 32 42)">
          <path
            d="M32 58C20 50 13 44 13 35a9.5 9.5 0 0 1 19-4.5A9.5 9.5 0 0 1 51 35c0 9-7 15-19 23Z"
            fill={`url(#${heartId})`}
            stroke={HEART_EDGE}
            strokeWidth=".8"
          />
          {highlights && (
            <>
              <ellipse
                cx="20.5"
                cy="32"
                rx="3.2"
                ry="2.2"
                transform="rotate(-35 20.5 32)"
                fill={HIGHLIGHT}
                stroke="none"
                opacity=".55"
              />
              <ellipse
                cx="42.5"
                cy="31.5"
                rx="2.6"
                ry="1.8"
                transform="rotate(-35 42.5 31.5)"
                fill={HIGHLIGHT}
                stroke="none"
                opacity=".45"
              />
            </>
          )}
        </g>
      </g>
    </svg>
  );
}
