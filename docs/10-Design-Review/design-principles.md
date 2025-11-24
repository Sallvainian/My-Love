# My-Love Design Principles

_Coral Heart Design System - Quality Checklist for Intimate Relationship Apps_

---

## Core Philosophy

**Users First**: Frank and his girlfriend - two partners who value transparency, emotional connection, and reliable performance.

**Emotional Design Goals**:
- **Trust** through reliability: When you send, it arrives. Always.
- **Warmth** through visuals: "Love" theme makes every interaction personal
- **Intimacy** through simplicity: Two-person focus means no noise
- **Joy** through feedback: Animations make actions satisfying

---

## 1. Color System - Coral Heart Palette

### Primary Palette
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | Coral Red | `#FF6B6B` | Main actions, key UI elements, brand identity |
| Secondary | Soft Coral | `#FFA8A8` | Supporting actions, hover states, accents |
| Surface | Blush White | `#FFF5F5` | Card backgrounds, elevated surfaces |
| Dark | Deep Coral | `#C92A2A` | Text emphasis, headers, active states |
| Background | Pure White | `#FFFFFF` | Main background color |
| Text | Warm Gray | `#495057` | Body text, readable and warm |

### Semantic Colors
| State | Color | Hex | Usage |
|-------|-------|-----|-------|
| Success | Green | `#51CF66` | Confirmations, sent successfully |
| Warning | Yellow | `#FCC419` | Caution, unsaved changes |
| Error | Coral Red | `#FF6B6B` | Errors, validation failures |
| Info | Blue | `#339AF0` | Informational messages |

### Dark Mode Palette
| Role | Light Mode | Dark Mode |
|------|------------|-----------|
| Background | `#FFFFFF` | `#1A1A1A` |
| Surface | `#FFF5F5` | `#2D2D2D` |
| Text | `#495057` | `#E0E0E0` |
| Primary | `#FF6B6B` | `#FF8787` |

### Checklist
- [ ] Primary actions use `#FF6B6B` (Coral Red)
- [ ] Text maintains `#495057` for readability
- [ ] Cards use `#FFF5F5` surface color
- [ ] Error states are visually distinct but cohesive
- [ ] Dark mode colors properly inverted with warmth preserved

---

## 2. Typography System

### Font Families
- **All Text**: System fonts (optimized for each platform)
- **Monospace**: Platform default (timestamps, codes)

### Type Scale
| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| H1 | 32px | Bold (700) | 1.2 | Screen titles |
| H2 | 24px | SemiBold (600) | 1.3 | Section headers |
| H3 | 20px | SemiBold (600) | 1.4 | Card titles |
| Body | 16px | Regular (400) | 1.5 | Main content |
| Small | 14px | Regular (400) | 1.4 | Secondary info |
| Caption | 12px | Medium (500) | 1.3 | Timestamps, labels |

### Checklist
- [ ] Headings use appropriate weight hierarchy
- [ ] Body text is 16px minimum for readability
- [ ] Line heights provide comfortable reading
- [ ] No font size below 12px (accessibility)
- [ ] Consistent font usage across similar elements

---

## 3. Spacing System

### Base Unit: 8px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing, inline elements |
| sm | 8px | Icon padding, small gaps |
| md | 16px | Standard component padding |
| lg | 24px | Section spacing, large gaps |
| xl | 32px | Screen margins, major sections |
| 2xl | 48px | Hero sections, emphasis |

### Layout Grid
- Single column layout (mobile-first)
- 16px horizontal margins
- 12px gap between cards/list items

### Checklist
- [ ] Spacing follows 8px grid system
- [ ] Consistent margins across screens
- [ ] Adequate whitespace for breathing room
- [ ] Touch targets properly spaced (no accidental taps)
- [ ] Visual hierarchy reinforced through spacing

---

## 4. Border Radius & Depth

### Corner Radius
| Size | Value | Usage |
|------|-------|-------|
| sm | 8px | Small elements, badges |
| md | 12px | Standard components, inputs |
| lg | 16px | Cards, modals |
| full | 9999px | Circular elements, pills |

### Depth Cues
- Subtle elevation on cards (2-4px shadows)
- Soft borders (1px `#F0F0F0`) or no borders with elevation
- **Goal**: Soft, approachable feel - NOT sharp/corporate

### Checklist
- [ ] Cards use 12-16px radius for soft feel
- [ ] Buttons have consistent radius
- [ ] Shadows are subtle, not harsh
- [ ] No sharp corners on interactive elements
- [ ] Depth creates warmth, not sterility

---

## 5. Interactive Elements

### Touch Targets
- **Minimum**: 44x44px for all interactive elements
- **Recommended**: 48px for primary actions
- **Large emoji buttons**: 48px minimum (MoodTracker)

### Button States
| Type | Style | Behavior |
|------|-------|----------|
| Primary | Filled coral | Haptic feedback, loading spinner |
| Secondary | Outlined coral | Subtle press state |
| Destructive | Deep coral | Confirmation required |
| Text/Link | Underlined coral | Immediate navigation |

### Feedback Mechanisms
| Type | Implementation | Duration |
|------|----------------|----------|
| Success Toast | Green background, check icon | 3 seconds |
| Error Toast | Coral background, X icon | 5 seconds |
| Loading State | Skeleton screens or spinner | Until loaded |
| Empty State | Friendly illustration + message | Persistent |

### Checklist
- [ ] All interactive elements meet 44px minimum
- [ ] Primary actions are visually prominent
- [ ] Loading states provide feedback
- [ ] Error states are clear but not alarming
- [ ] Empty states are warm and helpful

---

## 6. Component-Specific Standards

### MoodTracker
- [ ] 3x4 emoji grid clearly visible
- [ ] Single-tap selection (no confirmation needed)
- [ ] Large, easily tappable emoji buttons (48px+)
- [ ] Partner's mood visible at top
- [ ] Flow completes in <5 seconds

### PhotoCarousel / PhotoGallery
- [ ] Grid view with square thumbnails (3 columns)
- [ ] Smooth swipe gestures
- [ ] Loading placeholders visible
- [ ] Tap to expand works reliably
- [ ] Upload progress clearly shown

### DailyMessage
- [ ] Message text is warm and readable
- [ ] Date/attribution clearly shown
- [ ] Visual presentation feels special
- [ ] Swipe navigation intuitive

### CountdownTimer
- [ ] Numbers are large and celebratory
- [ ] Emotional impact is positive
- [ ] Animation enhances (doesn't distract)
- [ ] Works correctly across time zones

### PokeKiss Interface
- [ ] Playful interaction feedback
- [ ] Clear visual distinction between actions
- [ ] Satisfying animation on tap
- [ ] Partner notifications feel delightful

### LoginScreen
- [ ] Clean, focused layout
- [ ] Clear call to action
- [ ] Error states are helpful
- [ ] Forgot password accessible

### AdminPanel
- [ ] Functional but warm aesthetic
- [ ] Clear action buttons
- [ ] Confirmation for destructive actions
- [ ] Message preview accurate

---

## 7. Animation Standards (Framer Motion)

### Timing
- **Quick interactions**: 150-200ms
- **Transitions**: 200-300ms
- **Emphasis**: 300-400ms

### Principles
- Purposeful animations (not decorative)
- Immediate feedback without delay
- Respect prefers-reduced-motion
- Enhance understanding, not distract

### Checklist
- [ ] Page transitions feel smooth
- [ ] Button press feedback is immediate
- [ ] Loading transitions aren't jarring
- [ ] Carousel swipes are fluid
- [ ] No animations block user input

---

## 8. Accessibility Standards (WCAG 2.1 AA)

### Requirements
| Criterion | Standard | Implementation |
|-----------|----------|----------------|
| Color Contrast | Text 4.5:1, UI 3:1 | All Coral Heart colors tested |
| Touch Targets | 44x44px minimum | All interactive elements |
| Focus Indicators | Visible 2px ring | Keyboard navigation support |
| Screen Reader | Labels on all elements | Semantic HTML/ARIA |
| Text Scaling | Support up to 200% | Layouts don't break |
| Reduce Motion | Honor system setting | Disable animations |

### Checklist
- [ ] All text passes contrast requirements
- [ ] Interactive elements have focus states
- [ ] Images have meaningful alt text
- [ ] Form labels are associated with inputs
- [ ] Error messages are announced
- [ ] No information conveyed by color alone

---

## 9. Responsive Design

### Breakpoints
| Device | Width | Adjustments |
|--------|-------|-------------|
| Small Phone | 320-375px | Compact spacing, 2-col photo grid |
| Standard Phone | 376-428px | Default layout, 3-col photo grid |
| Large Phone | 429-480px | Expanded spacing, 3-col grid |
| Tablet | 481px+ | Center content (max 480px), 4-col grid |

### Checklist
- [ ] Layout works at 320px width
- [ ] No horizontal scrolling
- [ ] Text remains readable at all sizes
- [ ] Touch targets scale appropriately
- [ ] Images resize gracefully

---

## 10. PWA-Specific Standards

### Offline Behavior
- [ ] Graceful degradation when offline
- [ ] "Offline" indicator visible
- [ ] Cached content accessible
- [ ] Queued actions sync on reconnect

### Service Worker
- [ ] Assets cached appropriately
- [ ] Updates don't disrupt usage
- [ ] Install prompt non-intrusive

### Performance
- [ ] Initial load under 3 seconds
- [ ] Interactions feel instant
- [ ] No layout shift on load

---

## 11. Emotional Design Validation

### The "Warmth Test"
Ask yourself for each screen:
1. Does this feel like it was made with love?
2. Would I enjoy receiving a notification from this app?
3. Does the design make me want to connect with my partner?
4. Is this warm and intimate, or cold and corporate?

### Red Flags
- Sharp corners everywhere
- Gray, clinical color palette
- Dense, information-heavy layouts
- Missing loading/empty states
- Jarring transitions
- Generic, template-like appearance

### Green Flags
- Soft, rounded corners
- Warm coral accent colors
- Breathing room in layouts
- Delightful micro-interactions
- Smooth, purposeful animations
- Feels personal and intentional

---

## Quick Reference Card

```
Colors:     Primary #FF6B6B | Surface #FFF5F5 | Text #495057
Spacing:    xs:4 | sm:8 | md:16 | lg:24 | xl:32 (8px grid)
Radius:     sm:8 | md:12 | lg:16 | full:9999
Touch:      44px min | 48px recommended
Animation:  150-300ms | purposeful only
Font:       Body 16px | Min 12px | System fonts
```

---

_This design principles document is adapted from [OneRedOak claude-code-workflows](https://github.com/OneRedOak/claude-code-workflows) for the My-Love intimate relationship app._
