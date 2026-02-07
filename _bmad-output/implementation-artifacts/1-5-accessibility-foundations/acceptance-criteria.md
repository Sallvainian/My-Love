# Acceptance Criteria

1. **Keyboard Navigation — Full Tab Order**
   - **Given** the user navigates with keyboard only
   - **When** they tab through Scripture Reading screens
   - **Then** all interactive elements are reachable in logical tab order
   - **And** focus is visible on all controls (ring-2 ring-purple-400 or existing focus style)
   - **And** buttons activate with Enter or Space
   - **And** no keyboard traps exist

2. **Screen Reader — ARIA Labels & Live Announcements**
   - **Given** the user has a screen reader active
   - **When** they interact with Scripture Reading
   - **Then** all buttons have descriptive aria-labels
   - **And** the progress indicator has aria-label "Currently on verse X of 17"
   - **And** phase transitions are announced via aria-live="polite" region ("Now on verse 5", "Now in reflection")
   - **And** announcements fire only on semantic state changes (not on re-renders)

3. **Focus Management — Logical Focus Target on Transitions**
   - **Given** the user transitions between phases (verse to response, step to step)
   - **When** the transition completes
   - **Then** focus moves to the logical target:
     - Verse screen: verse heading (verse reference text)
     - Response screen: navigation button that was used (View Response / Back to Verse)
     - New step: verse heading (verse reference text)
     - Reflection/completion: completion heading

4. **Reduced Motion — useMotionConfig Hook**
   - **Given** the user has prefers-reduced-motion enabled
   - **When** animations would normally play
   - **Then** all crossfade transitions are replaced with instant swaps (duration: 0)
   - **And** the `useMotionConfig` hook is created in `src/hooks/useMotionConfig.ts`
   - **And** all Scripture Reading components use this hook for animation configuration

5. **Color Independence & Contrast**
   - **Given** any state indicator in Scripture Reading
   - **When** it communicates information via color
   - **Then** an icon or text label accompanies the color
   - **And** WCAG AA contrast ratios are met (4.5:1 normal text, 3:1 large text)
   - **And** all touch targets are minimum 48x48px with 8px spacing between targets
