import type { Theme, ThemeName } from '../types';

export const themes: Record<ThemeName, Theme> = {
  sunset: {
    name: 'sunset',
    displayName: 'Sunset Romance',
    colors: {
      primary: '#FF6B9D',
      secondary: '#FFA07A',
      background: '#FFE5EC',
      text: '#4A4A4A',
      accent: '#FFD700',
    },
    gradients: {
      background: 'linear-gradient(135deg, #FFE5EC 0%, #FFF4E6 50%, #FFD5C8 100%)',
      card: 'linear-gradient(135deg, #FFFFFF 0%, #FFF0F3 100%)',
    },
  },
  ocean: {
    name: 'ocean',
    displayName: 'Ocean Breeze',
    colors: {
      primary: '#14b8a6',
      secondary: '#06b6d4',
      background: '#E0F7FA',
      text: '#2C5F6F',
      accent: '#0891b2',
    },
    gradients: {
      background: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 50%, #80DEEA 100%)',
      card: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDFA 100%)',
    },
  },
  lavender: {
    name: 'lavender',
    displayName: 'Lavender Dreams',
    colors: {
      primary: '#a855f7',
      secondary: '#c084fc',
      background: '#F3E5F5',
      text: '#4A1F6F',
      accent: '#d8b4fe',
    },
    gradients: {
      background: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 50%, #CE93D8 100%)',
      card: 'linear-gradient(135deg, #FFFFFF 0%, #FAF5FF 100%)',
    },
  },
  rose: {
    name: 'rose',
    displayName: 'Rose Garden',
    colors: {
      primary: '#e11d48',
      secondary: '#fb7185',
      background: '#FCE4EC',
      text: '#4A1129',
      accent: '#f43f5e',
    },
    gradients: {
      background: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 50%, #F48FB1 100%)',
      card: 'linear-gradient(135deg, #FFFFFF 0%, #FFF1F2 100%)',
    },
  },
};

export function getTheme(themeName: ThemeName): Theme {
  return themes[themeName];
}

export function applyTheme(themeName: ThemeName): void {
  const theme = getTheme(themeName);
  const root = document.documentElement;

  // Apply CSS variables
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-background', theme.colors.background);
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-accent', theme.colors.accent);
  root.style.setProperty('--gradient-background', theme.gradients.background);
  root.style.setProperty('--gradient-card', theme.gradients.card);

  // Apply body background
  document.body.style.background = theme.gradients.background;
}

export default themes;
