# 💕 My Love - Daily Reminder App

![Playwright Tests](https://github.com/Sallvainian/My-Love/actions/workflows/playwright.yml/badge.svg)

A beautiful Progressive Web App (PWA) that sends daily love messages and reminders to your girlfriend. Built with React, TypeScript, Tailwind CSS, and Framer Motion for smooth animations.

## ✨ Features

- **Daily Love Messages**: Rotating heartfelt messages (reasons, memories, affirmations, future dreams)
- **100 Pre-written Messages**: Curated sweet messages ready to use or customize
- **Love Notes Chat**: Real-time messaging with your partner - send love notes instantly
- **Beautiful Animations**: Smooth, delightful animations with Framer Motion
- **PWA Support**: Installable on mobile devices, works offline
- **Photo Memories**: Store and view photos with captions in a beautiful gallery
- **Anniversary Countdown Timers**: Real-time countdown to special dates with celebration animations
- **Mood Tracker**: Daily mood logging with emoji moods and optional notes
- **Partner Mood View**: See your partner's current mood in real-time
- **Partner Interactions**: Send pokes, kisses, and farts with fun animations and real-time delivery
- **Mood History**: View your mood timeline and patterns over time
- **Multiple Themes**: Sunset, Ocean, Lavender, and Rose themes
- **Privacy First**: Row Level Security for data protection
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

3. **Configure the app constants** by editing `src/config/constants.ts`:

   ```typescript
   export const APP_CONFIG = {
     defaultPartnerName: 'Gracie', // Edit this with your partner's name
     defaultStartDate: '2025-10-18', // Edit this with the relationship start date (YYYY-MM-DD)
     isPreConfigured: true,
   } as const;
   ```

4. Start the development server:

```bash
npm run dev
```

6. Open http://localhost:5173/My-Love/ in your browser

## ⚙️ Configuration

### How to Customize the App

The app uses pre-configured constants for relationship data. To customize for your relationship, edit `src/config/constants.ts`:

```typescript
// src/config/constants.ts
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie', // Change to your partner's name
  defaultStartDate: '2025-10-18', // Change to relationship start date (YYYY-MM-DD)
  isPreConfigured: true,
} as const;
```

**That's it!** The app will automatically use these values when it starts. No environment files, no build configuration needed.

### What Gets Pre-Configured

When you set `defaultPartnerName` and `defaultStartDate` in `constants.ts`:

- Partner name displays throughout the app
- Relationship duration counter calculates automatically
- No onboarding wizard shown (pre-configured mode is always active)
- Settings are initialized on first app load
- Users can still edit these values later if needed (via Settings panel, when available)

## 📱 Deployment

**Live URL**: https://sallvainian.github.io/My-Love/

### Automatic Deployment (CI/CD)

Every push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. **Build** - `npm ci && npm run build`
2. **Supabase Types** - Generates TypeScript types from database
3. **Smoke Tests** - Runs `npm run test:smoke`
4. **Deploy** - Uploads `dist/` to GitHub Pages
5. **Health Check** - Verifies site is live and Supabase connects

**Timeline**: ~2-3 minutes from push to live.

### Required GitHub Secrets

Configure in **Settings** → **Secrets and variables** → **Actions**:

| Secret                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `DOTENV_PRIVATE_KEY`    | dotenvx private key for decrypting `.env`   |
| `SUPABASE_ACCESS_TOKEN` | For generating TypeScript types             |

### GitHub Pages Setup

1. Go to **Settings** → **Pages**
2. Under **Source**, select "GitHub Actions"
3. Click **Save**

### Manual Deploy

```bash
npm run deploy
```

### Post-Deploy Verification

- [ ] Site loads at https://sallvainian.github.io/My-Love/
- [ ] No console errors
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Offline mode works
- [ ] Supabase connection works (login/data loads)

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

## 🔧 Backend Setup (Supabase)

The app uses Supabase for real-time mood tracking and partner interactions. Follow these steps to set up your backend:

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and fill in:
   - **Project Name**: `my-love-backend` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose the closest region to you
3. Click **Create New Project** (takes ~2 minutes)

### 2. Get Your API Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon/Public Key**: Long string starting with `eyJ...`

### 3. Environment Variables (dotenvx)

This project uses [dotenvx](https://dotenvx.com) for secrets management. Secrets are encrypted in `.env` (safe to commit) and decrypted at runtime using `.env.keys`.

**For local development**:

1. Get the `.env.keys` file from dotenvx-ops:

```bash
npx dotenvx-ops login
npx dotenvx-ops sync
```

2. Run commands with dotenvx (automatically decrypts secrets):

```bash
dotenvx run -- npm run dev
```

**Note**: The `.env.keys` file is gitignored and backed up to [dotenvx-ops](https://dotenvx.com/ops) cloud. Never commit it.

### 4. Database Schema (✅ Already Executed)

**Status**: ✅ **Schema execution complete** (as of 2025-11-15)

The database schema has been created with:

- ✅ 3 tables: `users`, `moods`, `interactions`
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ 10 RLS policies enforcing access control
- ✅ Indexes for efficient queries
- ✅ Realtime enabled for `moods` and `interactions` tables

You can verify this in your Supabase dashboard:

- **Database** → **Tables**: Should show `users`, `moods`, `interactions`
- **Authentication** → **Policies**: Should show RLS policies for all tables
- **Database** → **Replication**: `moods` and `interactions` should be in `supabase_realtime` publication

**Schema source**: See `docs/migrations/001_initial_schema.sql` for the complete SQL migration.

### 5. Create User Accounts

The app uses email/password authentication. Create accounts for you and your partner:

**Option 1: Using Supabase Dashboard** (Recommended)

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add User** → **Create New User**
3. Create two users:
   - **User 1** (You): Enter your email and password
   - **User 2** (Partner): Enter partner's email and password
4. ✅ Auto-confirm both users (no email verification needed)
5. Share the login credentials with your partner

**Option 2: Using the App** (If sign-up is enabled in Supabase)

1. Start the app and click "Sign Up" on login screen
2. Enter your email and password
3. Have your partner do the same

**Important**: The app expects exactly 2 users in the system. The "partner" is automatically detected as the other user in the database.

### 6. Add Test Users for E2E Tests (Optional)

Test user credentials are already included in the encrypted `.env` file. If you need to add or change them:

1. Update the credentials: `dotenvx set KEY=value && dotenvx encrypt`
2. Back up keys: `npx dotenvx-ops backup`

**Note**: Create this test user in Supabase Auth with the same credentials.

### 7. Verify Connection

Start the dev server and check the browser console:

```bash
npm run dev
```

You should see:

- ✅ `[Supabase] Client initialized`
- ✅ No errors about missing environment variables

### Backend Features

Once set up, your app supports:

- **Love Notes**: Real-time chat with your partner - messages delivered instantly
- **Mood Tracking**: Log your daily mood with 12 emoji options and optional notes
- **Partner Mood View**: See your partner's current mood in real-time
- **Poke, Kiss & Fart**: Send playful interactions with fun animations
- **Photo Sharing**: Upload and share photos with captions
- **Offline-first**: All features work offline, sync when online
- **Privacy**: Row Level Security ensures only you and your partner can see your data

### Troubleshooting Backend

#### "Missing environment variables" error

- Verify `.env` file exists in project root
- Check both variables are set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Restart dev server after changing `.env`

#### "Table not found" error

- Run the SQL migration script in Supabase Dashboard → SQL Editor
- Verify tables exist in Database → Tables

#### "RLS policy violation" error

- Ensure you're signed in with a valid Google OAuth account
- Verify Row Level Security policies are enabled (they're created by the migration script)
- Check that your user account exists in Supabase Auth → Users

#### Realtime not working

- Enable Realtime for `moods` and `interactions` tables in Database → Replication
- Check browser console for WebSocket connection errors
- Verify Supabase project is not paused (free tier pauses after 1 week of inactivity)

For more details, see [Supabase Documentation](https://supabase.com/docs).

---

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
├── .env.example             # Template for environment variables
├── .env                     # Encrypted env vars (safe to commit)
├── .envrc                   # Loads secrets via dotenvx (direnv)
├── docs/
│   └── migrations/          # SQL migration scripts for Supabase
├── public/
│   └── icons/               # App icons for PWA
├── src/
│   ├── api/                 # Supabase API integration (Epic 6)
│   │   ├── supabaseClient.ts      # Supabase client singleton
│   │   ├── moodSyncService.ts     # Mood sync service
│   │   ├── interactionService.ts  # Poke/kiss interactions
│   │   └── errorHandlers.ts       # Error handling utilities
│   ├── components/
│   │   ├── DailyMessage/    # Main message card component
│   │   ├── love-notes/      # Real-time chat messaging
│   │   ├── MoodTracker/     # Mood logging with emoji selection
│   │   ├── PartnerMoodView/ # View partner's mood in real-time
│   │   ├── PokeKissInterface/ # Playful interactions (poke/kiss/fart)
│   │   ├── PhotoGallery/    # Photo grid with lazy loading
│   │   └── ...
│   ├── config/
│   │   └── constants.ts     # Environment configuration constants
│   ├── stores/
│   │   └── useAppStore.ts   # Zustand state management
│   ├── services/
│   │   ├── storage.ts              # IndexedDB & localStorage
│   │   ├── BaseIndexedDBService.ts # Base service class
│   │   └── ...
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
- [Supabase](https://supabase.com/) - Backend and real-time sync
- [IDB](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- [Lucide React](https://lucide.dev/) - Icons
- [Vite PWA](https://vite-pwa-org.netlify.app/) - PWA support

## 🎯 Roadmap

- [x] Daily message rotation
- [x] Onboarding flow
- [x] Beautiful animations
- [x] PWA support
- [x] Theme system
- [x] Photo gallery with upload, carousel, and lazy loading
- [x] Anniversary countdown timers with celebration animations
- [x] Mood tracker with emoji moods and notes
- [x] Partner mood view with real-time sync
- [x] Partner poke/kiss/fart interactions with animations
- [x] Supabase backend integration with Row Level Security
- [x] Mood history timeline view
- [x] Love Notes real-time chat
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

**Cause**: Missing or invalid configuration in `src/config/constants.ts`

**Solution**:

1. Edit `src/config/constants.ts` and verify your values are set
2. Clear browser IndexedDB:
   - Open DevTools → Application → IndexedDB
   - Delete the `my-love-db` database
3. Refresh the page

### Console errors about configuration

**Symptom**: `Configuration not set` warnings in console

**Solution**:

- Edit `src/config/constants.ts` with your partner name and relationship start date
- Ensure `defaultPartnerName` and `defaultStartDate` are not empty strings

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

**Remember**: This app uses Supabase for real-time sync between you and your partner. Row Level Security ensures only you two can see your data - complete privacy with real-time connection. Perfect for keeping your love notes personal and special! 💕
