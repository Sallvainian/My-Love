# 💕 My Love - Daily Reminder App

A beautiful Progressive Web App (PWA) that sends daily love messages and reminders to your girlfriend. Built with React, TypeScript, Tailwind CSS, and Framer Motion for smooth animations.

## ✨ Features

- **Daily Love Messages**: Rotating heartfelt messages (reasons, memories, affirmations, future dreams)
- **100 Pre-written Messages**: Curated sweet messages ready to use or customize
- **Beautiful Animations**: Smooth, delightful animations with Framer Motion
- **PWA Support**: Installable on mobile devices, works offline
- **Photo Memories**: Store photos with captions (coming soon)
- **Countdown Timers**: Track anniversaries and special dates (coming soon)
- **Mood Tracker**: Daily mood logging with insights (coming soon)
- **Multiple Themes**: Sunset, Ocean, Lavender, and Rose themes
- **Privacy First**: All data stored locally on device
- **Super Clean UI**: Modern, romantic design with glassmorphism

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/My-Love.git
cd My-Love
```

2. Install dependencies:
```bash
npm install
```

3. **Configure development environment variables**:
   ```bash
   cp .env.production.example .env.development
   ```

4. **Edit `.env.development`** with your relationship data:
   ```bash
   # Partner's name displayed throughout the app
   VITE_PARTNER_NAME=YourPartnerName

   # Relationship start date in ISO 8601 format (YYYY-MM-DD)
   VITE_RELATIONSHIP_START_DATE=2025-10-18
   ```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:5173/My-Love/ in your browser

## ⚙️ Environment Configuration

### Development vs Production

Vite loads different environment files based on the mode:

- **Development mode** (`npm run dev`):
  - Loads `.env`, `.env.local`, or `.env.development`
  - Use `.env.development` for local development with your test data

- **Production mode** (`npm run build`):
  - Loads `.env`, `.env.local`, or `.env.production`
  - Use `.env.production` for production builds with real relationship data

**Important**: Both `.env.development` and `.env.production` are in `.gitignore` to protect your personal data.

**Story 1.4 Update**: The app now requires environment variables to pre-configure relationship data, eliminating the onboarding flow for single-user deployment.

### Production Environment Setup

1. **Create the environment file**:
   ```bash
   cp .env.production.example .env.production
   ```

2. **Edit `.env.production`** with your relationship data:
   ```bash
   # Partner's name displayed throughout the app
   VITE_PARTNER_NAME=YourPartnerName

   # Relationship start date in ISO 8601 format (YYYY-MM-DD)
   VITE_RELATIONSHIP_START_DATE=2025-10-18
   ```

3. **Security Notes**:
   - ⚠️ **NEVER commit `.env.production` to version control** (already in `.gitignore`)
   - This file contains personal relationship data
   - Only `.env.production.example` (template) should be committed to git
   - When deploying, ensure `.env.production` exists locally before building

### How It Works

- Environment variables are **injected at build time** via Vite
- Values are statically replaced in the production bundle
- No runtime configuration needed - values are "baked in" during build
- Settings are automatically initialized on first app load
- Users can still edit settings later if needed (via Settings component, if implemented)

### Fallback Behavior

If `.env.production` is missing during build:
- App will build successfully (no hard failure)
- Console warnings logged on app initialization
- App may not function correctly without pre-configured data
- **Always ensure `.env.production` exists before production builds**

## 📱 Deploying to GitHub Pages

### First Time Setup

1. **Configure environment variables** (see Environment Configuration section above)

2. Initialize git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit: My Love app"
```

3. Create a new repository on GitHub named `My-Love`

4. Connect your local repository to GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/My-Love.git
git branch -M main
git push -u origin main
```

### Deploy

**Important**: Ensure `.env.production` exists locally before deploying!

Run the deploy script:
```bash
npm run deploy
```

This will:
- Read environment variables from `.env.production`
- Inject values into the production build
- Build the production version
- Deploy to GitHub Pages
- Make your app available at: `https://YOUR_USERNAME.github.io/My-Love/`

### Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select `gh-pages` branch
4. Click **Save**
5. Your app will be live in a few minutes!

### Deployment Checklist

- [ ] `.env.production` file created with correct values
- [ ] `.env.production` is in `.gitignore` (never commit!)
- [ ] Verified `VITE_PARTNER_NAME` and `VITE_RELATIONSHIP_START_DATE` are set
- [ ] Ran `npm run build` successfully locally
- [ ] Tested with `npm run preview` before deploying
- [ ] Committed all code changes except `.env.production`
- [ ] Ran `npm run deploy`
- [ ] Verified app works on GitHub Pages URL

## 📝 Customizing Messages

All messages are stored in `/src/data/defaultMessages.ts`. You can:

1. **Edit existing messages**: Open the file and modify any message text
2. **Add new messages**: Add new objects to the arrays
3. **Categories**:
   - `reason`: Why you love her
   - `memory`: Special memories together
   - `affirmation`: Daily affirmations and encouragement
   - `future`: Dreams and plans for the future
   - `custom`: Any custom messages

Example:
```typescript
{
  text: "Your smile makes my day instantly better",
  category: 'reason',
  isFavorite: false
}
```

## 🎨 Customizing Themes

Themes are defined in `/src/utils/themes.ts`. Each theme has:
- Primary and secondary colors
- Background gradients
- Text colors
- Accent colors

You can add new themes or modify existing ones.

## 📱 Installing on Mobile

### iOS (iPhone/iPad)
1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Give it a name (e.g., "My Love")
5. Tap "Add"

### Android
1. Open the app in Chrome
2. Tap the three dots menu
3. Tap "Add to Home screen" or "Install app"
4. Follow the prompts

The app will now appear on your home screen like a native app!

## 🔧 Project Structure

```
My-Love/
├── .env.production.example  # Template for environment variables
├── .env.production          # Your actual env vars (gitignored)
├── public/
│   └── icons/          # App icons for PWA
├── src/
│   ├── components/
│   │   ├── DailyMessage/    # Main message card component
│   │   ├── Onboarding/      # DEPRECATED (Story 1.4) - To be removed in Story 1.5
│   │   └── ...
│   ├── config/
│   │   └── constants.ts     # Environment configuration constants
│   ├── stores/
│   │   └── useAppStore.ts   # Zustand state management
│   ├── services/
│   │   └── storage.ts       # IndexedDB & localStorage
│   ├── utils/
│   │   ├── messageRotation.ts  # Daily message logic
│   │   ├── themes.ts           # Theme configurations
│   │   └── dateHelpers.ts      # Date utilities
│   ├── data/
│   │   └── defaultMessages.ts  # 100 pre-written messages
│   └── types/
│       └── index.ts         # TypeScript types
```

## 🛠️ Built With

- [React 19](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vite.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Zustand](https://zustand.docs.pmnd.rs/) - State management
- [IDB](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- [Lucide React](https://lucide.dev/) - Icons
- [Vite PWA](https://vite-pwa-org.netlify.app/) - PWA support

## 🎯 Roadmap

- [x] Daily message rotation
- [x] Onboarding flow
- [x] Beautiful animations
- [x] PWA support
- [x] Theme system
- [ ] Photo gallery with upload
- [ ] Countdown timers for anniversaries
- [ ] Mood tracker with insights
- [ ] Custom notes section
- [ ] Push notifications
- [ ] Export/import data
- [ ] More themes

## 💡 Tips for the Best Experience

1. **Personalize the messages**: Edit the default messages to make them truly yours
2. **Set up notifications**: Enable daily reminders during onboarding
3. **Install on home screen**: Makes it feel like a real app
4. **Add photos**: Once the photo feature is complete, add memories together
5. **Mark favorites**: Favorite messages will appear more frequently

## 📄 License

This project is open source and available for personal use. Feel free to customize it for your own relationship!

## 💖 Made with Love

Created with care to help you express your love every single day.

---

## 🐛 Troubleshooting

### App shows "Loading your daily message..." forever
**Cause**: Missing environment variables in development mode

**Solution**:
1. Create `.env.development` file: `cp .env.production.example .env.development`
2. Edit `.env.development` with your relationship data
3. Clear browser IndexedDB:
   - Open DevTools → Application → IndexedDB
   - Delete the `my-love-db` database
4. Refresh the page

### Console errors about environment variables
**Symptom**: `Environment variables not configured` warnings in console

**Solution**:
- For development: Create `.env.development` file (see above)
- For production: Create `.env.production` before building

### ConstraintError: Key already exists
**Cause**: IndexedDB schema mismatch or duplicate initialization

**Solution**:
1. Clear browser IndexedDB (DevTools → Application → IndexedDB)
2. Delete `my-love-db` database
3. Refresh the page
4. If persists, clear all browser data for localhost

### Development server won't start
- Make sure Node.js v18+ is installed
- Delete `node_modules` and run `npm install` again

### Build fails
- Run `npm run lint` to check for errors
- Make sure all dependencies are installed
- Verify `.env.production` exists before building

### PWA not installing
- Must be served over HTTPS (GitHub Pages does this automatically)
- Check browser console for errors
- Try clearing browser cache

### Messages not updating
- Check browser console for IndexedDB errors
- Try clearing application data in browser dev tools
- Ensure JavaScript is enabled

## 📞 Support

If you run into issues:
1. Check the browser console for errors
2. Ensure all dependencies are installed
3. Try clearing browser data
4. Rebuild the project: `npm run build`

---

**Remember**: This app stores all data locally on the device. There's no server, no tracking, and complete privacy. Perfect for keeping your love notes personal and special! 💕
