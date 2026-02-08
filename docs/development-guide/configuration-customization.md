# Configuration Customization

Edit `src/config/constants.ts` to personalize the app:

```typescript
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie',       // Your partner's name
  defaultStartDate: '2025-10-18',     // Relationship start date (YYYY-MM-DD)
  isPreConfigured: true,
} as const;
```

- `defaultPartnerName` -- Displayed throughout the app as your partner's name.
- `defaultStartDate` -- Used for the anniversary countdown and duration counter.

---
