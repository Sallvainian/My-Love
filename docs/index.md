# My Love - Project Documentation Index

> **Primary AI Retrieval Source**: This index is the starting point for understanding the My Love PWA codebase.

## Project Overview

- **Type**: Monolith (Single Part)
- **Primary Language**: TypeScript
- **Architecture**: Component-based SPA with Offline-First PWA capabilities
- **Generated**: 2025-10-30
- **Documentation Version**: 1.0.0

## Quick Reference

### Technology Stack
- **Frontend**: React 19.1.1 + TypeScript 5.9.3
- **Build Tool**: Vite 7.1.7
- **Styling**: Tailwind CSS 3.4.18
- **Animations**: Framer Motion 12.23.24
- **State Management**: Zustand 5.0.8
- **Data Persistence**: IndexedDB (IDB 8.0.3) + LocalStorage
- **PWA**: Vite PWA Plugin + Workbox
- **Icons**: Lucide React

### Entry Points
- **Main Entry**: `src/main.tsx`
- **Root Component**: `src/App.tsx`
- **Build Config**: `vite.config.ts`

### Key Features
- 💕 Daily rotating love messages (100 pre-written)
- 🎨 4 Beautiful themes (Sunset, Ocean, Lavender, Rose)
- 📱 Progressive Web App (installable, offline-first)
- 💾 Local data storage (IndexedDB + LocalStorage)
- ✨ Smooth animations with Framer Motion
- 📅 Relationship day tracking
- ⭐ Message favoriting system

## Generated Documentation

### Start Here
- **[Project Overview](./project-overview.md)** - High-level project summary, goals, and features
  - What is My Love?
  - Current features and roadmap
  - Use cases and user flows
  - Browser support

### Architecture & Design
- **[Architecture](./architecture.md)** - Complete system architecture documentation
  - Technology stack breakdown
  - Component-based SPA pattern
  - PWA architecture (Service Worker, Manifest)
  - Data persistence strategy
  - Deployment architecture

- **[Data Models](./data-models.md)** - TypeScript interfaces and database schemas
  - Core types: Message, Photo, Settings, Anniversary, MoodEntry
  - IndexedDB schema (photos, messages stores)
  - Type definitions for state management
  - Data validation patterns

- **[State Management](./state-management.md)** - Zustand store architecture
  - useAppStore structure and slices
  - State persistence with middleware
  - Actions and update patterns
  - Performance optimization techniques

### Codebase Structure
- **[Source Tree Analysis](./source-tree-analysis.md)** - Detailed codebase structure
  - Directory organization
  - Critical folders explained
  - Entry points and integration points
  - Code organization patterns

- **[Component Inventory](./component-inventory.md)** - UI component catalog
  - Implemented: DailyMessage, Onboarding
  - Planned: PhotoMemory, MoodTracker, CountdownTimer, CustomNotes, Settings
  - Component features and dependencies
  - Animation specifications

### Development
- **[Development Guide](./development-guide.md)** - Setup and development workflows
  - Prerequisites and environment setup
  - Development commands (`npm run dev`, `build`, `deploy`)
  - Adding new features
  - Customizing messages and themes
  - Testing PWA functionality
  - Troubleshooting guide

## Existing Project Documentation

- **[README.md](../README.md)** - User-facing project documentation
  - Quick start guide
  - Deployment instructions
  - Customization guide
  - Project structure overview

## Documentation Usage Guide

### For AI Agents / LLMs
This documentation is optimized for AI-assisted development:

1. **Start with [Project Overview](./project-overview.md)** to understand project goals
2. **Review [Architecture](./architecture.md)** for system design decisions
3. **Check [Source Tree Analysis](./source-tree-analysis.md)** for codebase navigation
4. **Consult specific docs** as needed:
   - Adding features? → [Development Guide](./development-guide.md) + [Component Inventory](./component-inventory.md)
   - State changes? → [State Management](./state-management.md)
   - Data model changes? → [Data Models](./data-models.md)
   - Architecture questions? → [Architecture](./architecture.md)

### For Human Developers

**First Time Setup**:
1. Read [README.md](../README.md) for quick start
2. Review [Development Guide](./development-guide.md) for environment setup
3. Skim [Project Overview](./project-overview.md) for context

**Working on Features**:
1. Check [Component Inventory](./component-inventory.md) for existing components
2. Review [State Management](./state-management.md) if modifying state
3. Refer to [Data Models](./data-models.md) for type definitions
4. Follow patterns in [Source Tree Analysis](./source-tree-analysis.md)

**Architecture Decisions**:
1. Review [Architecture](./architecture.md) for existing patterns
2. Understand data flow via [State Management](./state-management.md)
3. Consider PWA implications in [Architecture](./architecture.md)

## Project Statistics

### Codebase
- **Languages**: TypeScript (primary), CSS (Tailwind), HTML
- **Components**: 2 implemented, 6 planned
- **State Slices**: 8 (Settings, Onboarding, Messages, Moods, Anniversary, Theme, UI, Initialization)
- **Data Models**: 7 primary interfaces
- **Utilities**: 3 utility modules (themes, messageRotation, dateHelpers)
- **Services**: 1 storage service (IndexedDB wrapper)

### Documentation
- **Total Files**: 7 documentation files + 1 index
- **Total Size**: ~104 KB
- **Coverage**: Complete (100% of implemented features documented)

## Getting Started

### For Users
1. Visit the deployed app: `https://YOUR_USERNAME.github.io/My-Love/`
2. Complete onboarding flow
3. Install to home screen for best experience

### For Developers
```bash
# Clone and setup
git clone https://github.com/YOUR_USERNAME/My-Love.git
cd My-Love
npm install

# Start development
npm run dev
# → http://localhost:5173/My-Love/

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

See [Development Guide](./development-guide.md) for detailed instructions.

## Key Architectural Decisions

### Why Progressive Web App?
- Installable on mobile devices without app stores
- Works offline after first visit
- Native-like experience
- Easy updates through service worker

### Why IndexedDB?
- Large storage capacity for photos and messages
- Async API (non-blocking)
- Better than LocalStorage for structured data
- Native browser support

### Why Zustand?
- Simpler than Redux (less boilerplate)
- Better TypeScript support
- Built-in persistence middleware
- Excellent performance with selectors

### Why Tailwind CSS?
- Rapid development with utility classes
- Custom theme system matches design requirements
- Small bundle size (tree-shaken)
- Great DX with VSCode IntelliSense

### Why Vite?
- Fast HMR during development
- Optimized production builds
- Native ESM support
- Excellent PWA plugin ecosystem

## Browser Support

- **Chrome/Edge**: ✅ Full support (recommended)
- **Safari**: ✅ Full support
- **Firefox**: ✅ Full support
- **Mobile Safari**: ✅ Full PWA support
- **Chrome Mobile**: ✅ Full PWA support

## Performance Targets

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Lighthouse PWA Score**: 100
- **Bundle Size**: < 200KB (gzipped)
- **Service Worker**: Precaches all assets

## Security & Privacy

- **No Server**: 100% client-side application
- **No Analytics**: No tracking or data collection
- **No External Services**: All data stored locally
- **HTTPS**: Required for PWA features (GitHub Pages provides)
- **Content Security Policy**: Configured in production

## Version History

### v1.0.0 (Current - 2025-10-30)
- Initial release
- Daily message rotation
- Onboarding flow
- 4 themes
- PWA support
- Offline functionality
- 100 pre-written messages

### Roadmap
- Photo gallery with upload
- Countdown timers for anniversaries
- Mood tracker with insights
- Custom notes section
- Push notifications
- Export/import data

## Documentation Maintenance

This documentation was automatically generated using the BMAD document-project workflow with **exhaustive scan** level.

**Last Updated**: 2025-10-30
**Workflow Version**: 1.2.0
**Scan Level**: Exhaustive (all source files analyzed)

To regenerate or update this documentation, run:
```bash
/bmad:bmm:workflows:document-project
```

## Need Help?

### Troubleshooting
See [Development Guide - Troubleshooting](./development-guide.md#troubleshooting) for common issues.

### Code Questions
- Check [Source Tree Analysis](./source-tree-analysis.md) for file locations
- Review [Architecture](./architecture.md) for design patterns
- Consult [Component Inventory](./component-inventory.md) for component usage

### Feature Development
1. Review [Component Inventory](./component-inventory.md) for planned features
2. Check [State Management](./state-management.md) for state patterns
3. Follow [Development Guide](./development-guide.md) for implementation

---

**🎯 Quick Navigation**: [Overview](./project-overview.md) | [Architecture](./architecture.md) | [Development](./development-guide.md) | [Components](./component-inventory.md) | [State](./state-management.md) | [Data](./data-models.md) | [Source Tree](./source-tree-analysis.md)

*Generated with ❤️ using BMAD document-project workflow*
