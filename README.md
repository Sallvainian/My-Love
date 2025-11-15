# 💕 My Love - Daily Reminder App

![Playwright Tests](https://github.com/Sallvainian/My-Love/actions/workflows/playwright.yml/badge.svg)

A beautiful Progressive Web App (PWA) that sends daily love messages and reminders to your girlfriend. Built with React, TypeScript, Tailwind CSS, and Framer Motion for smooth animations.

## ✨ Features

- **Daily Love Messages**: Rotating heartfelt messages (reasons, memories, affirmations, future dreams)
- **100 Pre-written Messages**: Curated sweet messages ready to use or customize
- **Beautiful Animations**: Smooth, delightful animations with Framer Motion
- **PWA Support**: Installable on mobile devices, works offline
- **Photo Memories**: Store and view photos with captions in a beautiful gallery
- **Anniversary Countdown Timers**: Real-time countdown to special dates with celebration animations
- **Mood Tracker**: Daily mood logging with offline-first sync to Supabase backend
- **Partner Interactions**: Send pokes and kisses with real-time delivery
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

Before deploying, make sure you've edited `src/config/constants.ts` with your relationship data. Then run:

```bash
npm run deploy
```

This will:

- Build the production version with your configured constants
- Run automated smoke tests to verify everything is correct
- Deploy to GitHub Pages
- Make your app available at: `https://YOUR_USERNAME.github.io/My-Love/`

### Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select `gh-pages` branch
4. Click **Save**
5. Your app will be live in a few minutes!

### Deployment Checklist

- [ ] Edited `src/config/constants.ts` with your partner name and relationship start date
- [ ] Ran `npm run build` successfully locally
- [ ] Tested with `npm run preview` before deploying
- [ ] Committed all code changes
- [ ] Ran `npm run deploy`
- [ ] Verified app works on GitHub Pages URL
- [ ] Checked that partner name and relationship duration display correctly

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

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-dashboard
```

**Note**: The anon key is safe for client-side use. Supabase uses Row Level Security to protect your data.

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

If running end-to-end tests, add test user credentials to `.env`:

```env
# Test user for E2E tests (optional)
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_PASSWORD=testpassword123
```

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

- **Mood Tracking**: Log your daily mood (loved, happy, content, thoughtful, grateful)
- **Real-time Sync**: See your partner's moods instantly
- **Poke & Kiss**: Send playful interactions to your partner
- **Offline-first**: All features work offline, sync when online
- **Privacy**: Row Level Security ensures only you and your partner can see your data

### Troubleshooting Backend

#### "Missing environment variables" error

- Verify `.env` file exists in project root
- Check both variables are set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
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
├── .env                     # Your actual env vars (gitignored)
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
│   │   ├── Onboarding/      # DEPRECATED (Story 1.4) - To be removed in Story 1.5
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
- [x] Mood tracker with offline-first sync
- [x] Partner poke/kiss interactions with real-time delivery
- [x] Supabase backend integration with Row Level Security
- [ ] Mood history calendar view
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

**Remember**: This app stores all data locally on the device. There's no server, no tracking, and complete privacy. Perfect for keeping your love notes personal and special! 💕
