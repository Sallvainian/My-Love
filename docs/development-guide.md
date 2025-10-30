# Development Guide

## Prerequisites

### Required Software
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher (comes with Node.js)
- **Git**: For version control

### Optional Tools
- **VSCode**: Recommended IDE with TypeScript support
- **Chrome/Firefox DevTools**: For debugging and PWA testing

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/My-Love.git
cd My-Love
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- React 19.1.1
- TypeScript 5.9.3
- Vite 7.1.7
- Tailwind CSS 3.4.18
- Framer Motion 12.23.24
- Zustand 5.0.8
- IDB 8.0.3
- And all dev dependencies

### 3. Verify Installation
```bash
npm run lint      # Check for linting errors
```

## Development Commands

### Start Development Server
```bash
npm run dev
```
- Starts Vite dev server on `http://localhost:5173/My-Love/`
- Hot Module Replacement (HMR) enabled
- Automatic browser refresh on file changes

### Build for Production
```bash
npm run build
```
- Compiles TypeScript: `tsc -b`
- Bundles with Vite: Optimized production build
- Generates PWA service worker
- Output: `dist/` directory

### Preview Production Build
```bash
npm run preview
```
- Serves the `dist/` folder locally
- Test production build before deployment

### Lint Code
```bash
npm run lint
```
- Runs ESLint on all TypeScript files
- Checks for code quality issues
- Uses React Hooks and React Refresh plugins

### Deploy to GitHub Pages
```bash
npm run deploy
```
- Builds the project
- Deploys to `gh-pages` branch
- Live at: `https://YOUR_USERNAME.github.io/My-Love/`

## Project Structure Reference

```
src/
├── components/       # React UI components
├── data/            # Static data (messages)
├── hooks/           # Custom React hooks
├── services/        # Business logic (IndexedDB)
├── stores/          # Zustand state management
├── types/           # TypeScript definitions
├── utils/           # Helper functions
├── App.tsx          # Root component
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Development Workflow

### Adding a New Feature

1. **Create Component**
   ```bash
   mkdir src/components/NewFeature
   touch src/components/NewFeature/NewFeature.tsx
   ```

2. **Define Types** (if needed)
   ```typescript
   // src/types/index.ts
   export interface NewFeatureData {
     id: number;
     // ...
   }
   ```

3. **Add State** (if needed)
   ```typescript
   // src/stores/useAppStore.ts
   interface AppState {
     // Add new state
     newFeatureData: NewFeatureData[];

     // Add actions
     addNewFeatureData: (data: NewFeatureData) => void;
   }
   ```

4. **Implement Component**
   ```typescript
   import { motion } from 'framer-motion';
   import { useAppStore } from '../../stores/useAppStore';

   export function NewFeature() {
     const { newFeatureData, addNewFeatureData } = useAppStore();

     return (
       <motion.div>
         {/* Component UI */}
       </motion.div>
     );
   }
   ```

5. **Test in Development**
   ```bash
   npm run dev
   ```

### Customizing Messages

Edit `/src/data/defaultMessages.ts`:

```typescript
{
  text: "Your custom message here",
  category: 'reason', // or 'memory', 'affirmation', 'future', 'custom'
  isFavorite: false
}
```

Categories:
- `reason`: Why you love them
- `memory`: Special memories
- `affirmation`: Daily encouragement
- `future`: Plans and dreams
- `custom`: Anything else

### Adding a New Theme

Edit `/src/utils/themes.ts`:

```typescript
export const themes: Record<ThemeName, Theme> = {
  // Existing themes...

  newTheme: {
    name: 'newTheme',
    displayName: 'New Theme Name',
    colors: {
      primary: '#hex',
      secondary: '#hex',
      background: '#hex',
      text: '#hex',
      accent: '#hex',
    },
    gradients: {
      background: 'linear-gradient(...)',
      card: 'linear-gradient(...)',
    },
  },
};
```

Update TypeScript types in `/src/types/index.ts`:
```typescript
export type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose' | 'newTheme';
```

## Testing

### Manual Testing Checklist
- [ ] Onboarding flow works correctly
- [ ] Daily message displays properly
- [ ] Favorite toggle works
- [ ] Share functionality works
- [ ] Theme changes apply correctly
- [ ] PWA installs on mobile devices
- [ ] Offline functionality works
- [ ] Data persists after browser refresh

### Testing PWA Locally
1. Build the project: `npm run build`
2. Preview: `npm run preview`
3. Open Chrome DevTools → Application tab
4. Check Service Worker status
5. Test offline by checking "Offline" in Network tab

### Testing on Mobile Devices
1. Deploy to GitHub Pages: `npm run deploy`
2. Open on mobile device browser
3. Test "Add to Home Screen" functionality
4. Verify PWA icon and splash screen
5. Test offline functionality

## Build Process

### TypeScript Compilation
- Config: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Process: `tsc -b` compiles all `.ts` and `.tsx` files
- Output: Type checking and `.d.ts` files

### Vite Bundling
- Entry: `index.html`
- Config: `vite.config.ts`
- Process:
  1. Transform JSX/TSX to JavaScript
  2. Bundle modules with tree-shaking
  3. Process CSS with PostCSS + Tailwind
  4. Optimize images and assets
  5. Generate PWA manifest and service worker
- Output: Optimized `dist/` folder

### PWA Generation
- Plugin: `vite-plugin-pwa`
- Service Worker: Workbox-powered
- Manifest: Defined in `vite.config.ts`
- Caching Strategy:
  - App shell: CacheFirst
  - Google Fonts: CacheFirst (1 year expiration)
  - Runtime: NetworkFirst with fallback

## Common Development Tasks

### Clearing IndexedDB (Dev Reset)
```javascript
// In browser console:
indexedDB.deleteDatabase('my-love-db');
localStorage.clear();
location.reload();
```

### Clearing LocalStorage Only
```javascript
// In browser console:
localStorage.removeItem('my-love-storage');
location.reload();
```

### Viewing IndexedDB Contents
1. Open Chrome DevTools
2. Application tab → Storage → IndexedDB
3. Expand `my-love-db`
4. View `photos` and `messages` stores

### Debugging Service Worker
1. Chrome DevTools → Application → Service Workers
2. Check registration status
3. Unregister if needed for testing
4. View cached resources in Cache Storage

### Hot Reload Not Working?
```bash
# Kill dev server
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## Code Style Guidelines

### TypeScript
- Use strict type checking
- Prefer interfaces over types for objects
- Use `unknown` instead of `any`
- Export types from `src/types/index.ts`

### React Components
- Functional components with hooks
- Use Framer Motion for animations
- Extract reusable logic to custom hooks
- Keep components under 300 lines

### State Management
- Single Zustand store in `useAppStore`
- Persist critical state with middleware
- Use selectors for performance: `useAppStore(state => state.specificValue)`

### CSS
- Tailwind utility classes preferred
- Custom CSS in `index.css` for global styles
- Use Tailwind config for theme customization
- Avoid inline styles

### File Naming
- Components: `PascalCase.tsx`
- Utilities/Services: `camelCase.ts`
- Types: `index.ts`
- Constants: `UPPER_SNAKE_CASE`

## Performance Optimization

### Bundle Size
- Check bundle: `npm run build` (shows gzipped sizes)
- Lazy load routes (future): `React.lazy()` + `Suspense`
- Tree-shake unused dependencies

### Runtime Performance
- Memoize expensive computations: `useMemo`
- Memoize callbacks: `useCallback`
- Optimize re-renders: Zustand selectors
- Use Framer Motion's `AnimatePresence` for exit animations

### PWA Performance
- Service worker caches all assets
- IndexedDB for large data
- LocalStorage for small settings
- Offline-first architecture

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm install
npm run build
```

### TypeScript Errors
```bash
# Check TypeScript config
npm run lint
# Rebuild type definitions
npx tsc --noEmit
```

### PWA Not Installing
- Must be served over HTTPS (GitHub Pages does this)
- Check manifest in `vite.config.ts`
- Verify service worker registered in DevTools
- Try incognito/private mode

### IndexedDB Errors
- Check browser support (all modern browsers)
- Clear database and retry
- Check console for quota exceeded errors
- Verify `await storageService.init()` is called

### Tailwind Styles Not Applying
- Verify `tailwind.config.js` content paths
- Check PostCSS is processing: `postcss.config.js`
- Rebuild: `npm run build`
- Clear browser cache

## Additional Resources

- [React Documentation](https://react.dev/)
- [Vite Guide](https://vite.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Framer Motion API](https://www.framer.com/motion/)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [PWA Guide](https://web.dev/progressive-web-apps/)
