# My Love - Project Overview

## What is My Love?

**My Love** is a Progressive Web Application (PWA) designed to send daily love messages to your significant other. It's a personal, intimate app that helps you express appreciation, share memories, and strengthen your relationship through daily affirmations and reminders.

Think of it as a digital love letter that changes every day, with features to preserve memories, track moods, and celebrate special moments together.

## Key Features

### Current Features (v0.1.0)

**Daily Love Messages**

- Receive a new heartfelt message every day
- 100 pre-written messages across 5 categories:
  - Reasons why you love them
  - Shared memories
  - Daily affirmations
  - Future plans and dreams
  - Custom messages
- Intelligent rotation algorithm ensures variety
- Favorite messages get prioritized in rotation

**Beautiful Themes**

- 4 romantic color themes:
  - Sunset Bliss (warm pinks and oranges) - default
  - Ocean Dreams (cool blues and teals)
  - Lavender Fields (purple and violet hues)
  - Rose Garden (deep pinks and roses)
- Smooth theme transitions
- Consistent design language across themes

**Progressive Web App (PWA)**

- Install to home screen on mobile and desktop
- Works offline after first visit
- Fast loading with service worker caching
- Native app-like experience
- No app store required

**Interactive Features**

- Favorite messages with animated heart effects
- Share messages via native share or clipboard
- Relationship duration counter (days together)
- Smooth, delightful animations throughout

**Privacy-First Design**

- All data stored locally on your device
- No backend server or cloud storage
- No user accounts or authentication
- No tracking or analytics
- Your messages stay private

### Planned Features (Roadmap)

**Photo Memories** (v0.2.0)

- Upload photos with captions
- Searchable tag system
- Beautiful photo gallery
- Lightbox viewing experience

**Mood Tracker** (v0.3.0)

- Log daily moods (loved, happy, content, thoughtful, grateful)
- Calendar view of mood history
- Optional notes with each entry
- Visualize mood trends over time

**Anniversary Countdown** (v0.4.0)

- Track multiple special dates
- Real-time countdown timer
- Celebration animations when dates arrive
- Reminders for upcoming anniversaries

**Custom Messages** (v0.5.0)

- Write your own personalized messages
- Add to daily rotation
- Edit and manage custom messages
- Preview before saving

**Enhanced Customization** (v0.6.0)

- Custom accent colors
- Font selection
- Import/export data for backup
- Advanced theme editor

## Technology Stack

### Core Technologies

| Technology     | Version | Purpose                                        |
| -------------- | ------- | ---------------------------------------------- |
| **React**      | 19.1.1  | UI framework for component-based architecture  |
| **TypeScript** | 5.9.3   | Type-safe development and better IDE support   |
| **Vite**       | 7.1.7   | Lightning-fast dev server and optimized builds |
| **Zustand**    | 5.0.8   | Lightweight state management with persistence  |

### Styling & UI

| Technology        | Version  | Purpose                                       |
| ----------------- | -------- | --------------------------------------------- |
| **Tailwind CSS**  | 3.4.18   | Utility-first CSS framework for rapid styling |
| **Framer Motion** | 12.23.24 | Declarative animations and transitions        |
| **Lucide React**  | 0.475.0  | Beautiful, consistent icon library            |

### Data & Storage

| Technology              | Version | Purpose                                      |
| ----------------------- | ------- | -------------------------------------------- |
| **IndexedDB** (via idb) | 8.0.3   | Client-side database for photos and messages |
| **LocalStorage**        | Native  | Settings and small data persistence          |

### PWA & Build

| Technology          | Version      | Purpose                                |
| ------------------- | ------------ | -------------------------------------- |
| **vite-plugin-pwa** | 0.21.3       | Service worker and manifest generation |
| **Workbox**         | (via plugin) | Intelligent caching strategies         |
| **gh-pages**        | 6.3.0        | Deployment to GitHub Pages             |

### Developer Experience

| Technology       | Version | Purpose                         |
| ---------------- | ------- | ------------------------------- |
| **ESLint**       | 9.19.0  | Code quality and consistency    |
| **PostCSS**      | 8.4.51  | CSS processing and optimization |
| **Autoprefixer** | 10.4.20 | Browser compatibility for CSS   |

## Architecture Summary

**Pattern**: Component-based Single Page Application (SPA)

**Data Flow**: Unidirectional (Zustand store → Components → User actions → Store updates)

**Persistence Strategy**:

- **IndexedDB**: Large data (photos, messages)
- **LocalStorage**: Settings and small state
- **Service Worker**: Static assets and offline support

**Offline-First**: App fully functional without internet after first load

## Project Goals

### Primary Goals

1. **Strengthen Relationships**: Provide daily touchpoints to express love and appreciation
2. **Privacy-Focused**: Keep personal data completely private and secure
3. **Delightful UX**: Create a joyful, emotionally engaging user experience
4. **Offline-First**: Work seamlessly without internet connectivity
5. **Personal Touch**: Feel intimate and customized, not generic

### Non-Goals

- Multi-user functionality (designed for single user)
- Social sharing features (keep it private)
- Monetization (free and ad-free forever)
- Cross-device sync (local-only by design)
- Backend infrastructure (client-side only)

## Use Cases

### Daily Routine

1. User opens app (or receives notification)
2. Sees today's love message with relationship stats
3. Can favorite the message or share it privately
4. Message changes automatically at midnight

### First-Time Setup

1. User completes onboarding wizard
2. Enters partner's name and relationship start date
3. Configures notification preferences (optional)
4. Receives first daily message immediately

### Photo Memories (Planned)

1. User uploads photo from a special moment
2. Adds caption and tags
3. Photos stored securely in IndexedDB
4. Can browse gallery and relive memories

### Mood Tracking (Planned)

1. User logs daily mood with optional note
2. Can view mood history in calendar format
3. Identify patterns and celebrate positive days

## Project Structure

```
My-Love/
├── src/                      # Application source code
│   ├── components/           # React UI components
│   ├── data/                 # Static data (default messages)
│   ├── services/             # Business logic (IndexedDB wrapper)
│   ├── stores/               # State management (Zustand)
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Helper functions
│   ├── App.tsx               # Root component
│   └── main.tsx              # Application entry point
├── public/                   # Static assets (icons, manifest)
├── docs/                     # Project documentation
├── dist/                     # Production build output
├── vite.config.ts            # Build configuration
├── tailwind.config.js        # Tailwind customization
└── package.json              # Dependencies and scripts
```

## Getting Started

### For Users

1. Visit the live app: `https://YOUR_USERNAME.github.io/My-Love/`
2. Complete the onboarding wizard
3. Enjoy your first daily message
4. (Optional) Add to home screen for quick access

### For Developers

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/My-Love.git
   cd My-Love
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development server:

   ```bash
   npm run dev
   ```

4. Open browser to `http://localhost:5173/My-Love/`

## Development Commands

| Command           | Purpose                          |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start development server         |
| `npm run build`   | Build for production             |
| `npm run preview` | Preview production build locally |
| `npm run lint`    | Check code quality               |
| `npm run deploy`  | Deploy to GitHub Pages           |

## Documentation

### Core Documentation

- **[Architecture](./architecture.md)** - System design, patterns, and technical architecture
- **[Development Guide](./development-guide.md)** - Setup, workflows, and development practices
- **[Source Tree Analysis](./source-tree-analysis.md)** - Detailed codebase structure explanation

### Reference Documentation

- **[Data Models](./data-models.md)** - TypeScript interfaces and data structures
- **[State Management](./state-management.md)** - Zustand store architecture and usage
- **[Component Inventory](./component-inventory.md)** - Catalog of all UI components

## Browser Support

**Minimum Requirements**:

- Modern browsers with ES6 support
- IndexedDB support
- Service Worker support (for offline functionality)

**Recommended Browsers**:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile: iOS Safari 14+, Chrome Mobile 90+

**PWA Installation**:

- Desktop: Chrome, Edge, Firefox (limited)
- Mobile: Safari (iOS), Chrome (Android)

## Performance

**Metrics** (Lighthouse scores):

- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 90+
- PWA: 100

**Bundle Size**:

- Initial JS: ~150KB (gzipped)
- CSS: ~10KB (gzipped)
- Total assets: ~200KB

**Load Time**:

- First Contentful Paint: <1s
- Time to Interactive: <2s
- Offline load: <500ms (after first visit)

## Security & Privacy

**Data Storage**:

- All data stored in browser's IndexedDB and LocalStorage
- No transmission to external servers
- No cloud backup or sync

**No Tracking**:

- No analytics or telemetry
- No third-party scripts
- No cookies or tracking pixels

**Open Source**:

- Code is transparent and auditable
- No hidden functionality
- MIT License (free to use and modify)

## Contributing

This is a personal project, but contributions are welcome!

**Areas for Contribution**:

- Bug fixes and improvements
- New message suggestions
- Additional themes
- Translations (future feature)
- Performance optimizations

**How to Contribute**:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

**MIT License** - Free to use, modify, and distribute

See `LICENSE` file for full details.

## Credits

**Created by**: [Your Name]

**Built with**:

- React Team for the amazing UI framework
- Zustand team for simple state management
- Framer for the delightful motion library
- Tailwind Labs for the utility-first CSS framework
- And all the open-source contributors who make projects like this possible

## Support

**Questions or Issues?**

- Open an issue on GitHub
- Check existing documentation in `/docs/`
- Review the development guide for common problems

**Feature Requests?**

- Open a discussion on GitHub
- Describe your use case
- Explain how it aligns with project goals

## Version History

**v0.1.0** (Current) - Initial Release

- Daily message rotation with 100 pre-written messages
- Onboarding wizard
- 4 romantic themes
- Favorite and share functionality
- PWA support with offline capability
- Relationship duration tracking

**Planned Releases**:

- v0.2.0 - Photo memories
- v0.3.0 - Mood tracker
- v0.4.0 - Anniversary countdown
- v0.5.0 - Custom messages
- v0.6.0 - Enhanced customization

## Related Links

- **GitHub Repository**: `https://github.com/YOUR_USERNAME/My-Love`
- **Live Demo**: `https://YOUR_USERNAME.github.io/My-Love/`
- **Documentation**: `/docs/` directory
- **Issue Tracker**: `https://github.com/YOUR_USERNAME/My-Love/issues`

---

**Made with love for someone special 💕**
