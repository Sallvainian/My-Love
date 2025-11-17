# Animation Specifications

All interactive components use Framer Motion with these patterns:

```typescript
// Standard entrance animation
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

// Button press feedback
const tapAnimation = {
  whileTap: { scale: 0.95 },
};

// Hover state
const hoverAnimation = {
  whileHover: { scale: 1.05 },
};
```

---
