import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useERP } from './ERPContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type ThemeColorId = 'blue' | 'green' | 'red' | 'dark_grey';

export interface ThemePreset {
  id: ThemeColorId;
  name: string;
  hex: string;
  // Primary Interactive Accent (Buttons, Focus Rings, Active Controls)
  primary: string;
  hover: string;
  active: string;
  light: string;
  subtle: string;
  border: string;
  ring: string;
  foreground: string;
  // Coordinated Sidebar Palette (Rich darker theme shade for readability)
  sidebarBg: string;           // Darker shade of the accent color for sidebar background
  sidebarHeader: string;       // Coordinated header background
  sidebarBorder: string;       // Border and separator color
  sidebarActive: string;       // Slightly lighter shade than sidebar background
  sidebarActiveBorder: string; // Accent border highlight for active item
  sidebarActiveText: string;   // High contrast crisp text
  sidebarHover: string;        // Subtle hover state
  sidebarMuted: string;        // Readable secondary text & icons (WCAG AA > 4.5:1)
  sidebarBadgeBg: string;      // Badge background
  sidebarBadgeText: string;    // Badge text
}

export const THEME_PRESETS: Record<ThemeColorId, ThemePreset> = {
  blue: {
    id: 'blue',
    name: 'Blue',
    hex: '#1760F5',
    primary: '#1760F5',
    hover: '#114ed1',
    active: '#0d3ea8',
    light: '#eff5ff',
    subtle: 'rgba(23, 96, 245, 0.08)',
    border: 'rgba(23, 96, 245, 0.25)',
    ring: 'rgba(23, 96, 245, 0.35)',
    foreground: '#ffffff',
    // Coordinated dark navy blue sidebar
    sidebarBg: '#0B172E',
    sidebarHeader: '#081020',
    sidebarBorder: 'rgba(255, 255, 255, 0.12)',
    sidebarActive: '#173570',
    sidebarActiveBorder: 'rgba(96, 165, 250, 0.50)',
    sidebarActiveText: '#ffffff',
    sidebarHover: 'rgba(255, 255, 255, 0.08)',
    sidebarMuted: '#94A3B8',
    sidebarBadgeBg: 'rgba(23, 96, 245, 0.35)',
    sidebarBadgeText: '#ffffff'
  },
  green: {
    id: 'green',
    name: 'Green',
    hex: '#2EAF87',
    primary: '#2EAF87',
    hover: '#249572',
    active: '#1c7a5c',
    light: '#effaf6',
    subtle: 'rgba(46, 175, 135, 0.08)',
    border: 'rgba(46, 175, 135, 0.25)',
    ring: 'rgba(46, 175, 135, 0.35)',
    foreground: '#ffffff',
    // Coordinated dark forest-green sidebar
    sidebarBg: '#081E17',
    sidebarHeader: '#051510',
    sidebarBorder: 'rgba(255, 255, 255, 0.12)',
    sidebarActive: '#124233',
    sidebarActiveBorder: 'rgba(74, 222, 128, 0.50)',
    sidebarActiveText: '#ffffff',
    sidebarHover: 'rgba(255, 255, 255, 0.08)',
    sidebarMuted: '#94A3B8',
    sidebarBadgeBg: 'rgba(46, 175, 135, 0.35)',
    sidebarBadgeText: '#ffffff'
  },
  red: {
    id: 'red',
    name: 'Red',
    hex: '#DC2626',
    primary: '#DC2626',
    hover: '#b91c1c',
    active: '#991b1b',
    light: '#fef2f2',
    subtle: 'rgba(220, 38, 38, 0.08)',
    border: 'rgba(220, 38, 38, 0.25)',
    ring: 'rgba(220, 38, 38, 0.35)',
    foreground: '#ffffff',
    // Coordinated dark burgundy/wine sidebar
    sidebarBg: '#1F0D11',
    sidebarHeader: '#14070A',
    sidebarBorder: 'rgba(255, 255, 255, 0.12)',
    sidebarActive: '#44141E',
    sidebarActiveBorder: 'rgba(248, 113, 113, 0.50)',
    sidebarActiveText: '#ffffff',
    sidebarHover: 'rgba(255, 255, 255, 0.08)',
    sidebarMuted: '#94A3B8',
    sidebarBadgeBg: 'rgba(220, 38, 38, 0.35)',
    sidebarBadgeText: '#ffffff'
  },
  dark_grey: {
    id: 'dark_grey',
    name: 'Dark Grey',
    hex: '#4B5565',
    primary: '#4B5565',
    hover: '#374151',
    active: '#1f2937',
    light: '#f1f5f9',
    subtle: 'rgba(75, 85, 101, 0.08)',
    border: 'rgba(75, 85, 101, 0.25)',
    ring: 'rgba(75, 85, 101, 0.35)',
    foreground: '#ffffff',
    // Coordinated dark charcoal sidebar
    sidebarBg: '#0F141E',
    sidebarHeader: '#090D14',
    sidebarBorder: 'rgba(255, 255, 255, 0.12)',
    sidebarActive: '#232E40',
    sidebarActiveBorder: 'rgba(148, 163, 184, 0.50)',
    sidebarActiveText: '#ffffff',
    sidebarHover: 'rgba(255, 255, 255, 0.08)',
    sidebarMuted: '#94A3B8',
    sidebarBadgeBg: 'rgba(75, 85, 101, 0.40)',
    sidebarBadgeText: '#ffffff'
  }
};

export const normalizeThemeColor = (val?: string): ThemeColorId => {
  if (!val) return 'blue';
  const lower = val.toLowerCase().trim();
  if (lower === 'green' || lower === 'emerald' || lower === '#2eaf87') return 'green';
  if (lower === 'red' || lower === 'crimson' || lower === '#dc2626') return 'red';
  if (
    lower === 'dark_grey' ||
    lower === 'darkgrey' ||
    lower === 'dark-grey' ||
    lower === 'gray' ||
    lower === 'grey' ||
    lower === 'slate' ||
    lower === '#4b5565'
  ) {
    return 'dark_grey';
  }
  // Graceful fallback for deprecated purple
  if (lower === 'purple' || lower === 'pink' || lower === '#a238f5') {
    return 'red';
  }
  return 'blue';
};

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  return null;
};

export const getUserStoredThemeColor = (userId?: string, companyId?: string): ThemeColorId | null => {
  try {
    const storage = getStorage();
    if (!storage) return null;
    // 1. Check user-specific preference key first
    if (userId) {
      const userKey = `universal_billing_theme_user_${userId}`;
      const storedUser = storage.getItem(userKey);
      if (storedUser) {
        return normalizeThemeColor(storedUser);
      }
    }
    // 2. Fallback to tenant key or active key
    const tenantKey = companyId ? `universal_billing_theme_${companyId}` : null;
    const stored =
      (tenantKey && storage.getItem(tenantKey)) ||
      storage.getItem('universal_billing_theme_active');
    if (stored) {
      return normalizeThemeColor(stored);
    }
  } catch (err) {
    console.warn('Failed to read theme from localStorage:', err);
  }
  return null;
};

export const getStoredThemeColor = (companyId?: string): ThemeColorId | null => {
  return getUserStoredThemeColor(undefined, companyId);
};

export const applyThemeVariables = (colorId: ThemeColorId) => {
  const preset = THEME_PRESETS[colorId] || THEME_PRESETS.blue;
  const root = document.documentElement;

  // 1. Centralized CSS Custom Properties
  root.style.setProperty('--primary', preset.primary);
  root.style.setProperty('--primary-foreground', preset.foreground);
  root.style.setProperty('--primary-accent', preset.primary);
  root.style.setProperty('--primary-accent-hover', preset.hover);
  root.style.setProperty('--primary-accent-active', preset.active);
  root.style.setProperty('--primary-accent-light', preset.light);
  root.style.setProperty('--primary-accent-subtle', preset.subtle);
  root.style.setProperty('--primary-accent-border', preset.border);
  root.style.setProperty('--primary-accent-ring', preset.ring);
  root.style.setProperty('--primary-accent-foreground', preset.foreground);

  // 2. Coordinated Sidebar Theme Variables (Darker shade + clear hierarchy)
  root.style.setProperty('--sidebar-background', preset.sidebarBg);
  root.style.setProperty('--sidebar-header', preset.sidebarHeader);
  root.style.setProperty('--sidebar-border', preset.sidebarBorder);
  root.style.setProperty('--sidebar-active', preset.sidebarActive);
  root.style.setProperty('--sidebar-active-border', preset.sidebarActiveBorder);
  root.style.setProperty('--sidebar-active-text', preset.sidebarActiveText);
  root.style.setProperty('--sidebar-hover', preset.sidebarHover);
  root.style.setProperty('--sidebar-foreground', preset.foreground);
  root.style.setProperty('--sidebar-muted', preset.sidebarMuted);

  // 3. Map Tailwind's brand blue utility tokens to active theme
  root.style.setProperty('--color-blue-600', preset.primary);
  root.style.setProperty('--color-blue-700', preset.hover);
  root.style.setProperty('--color-blue-800', preset.active);
  root.style.setProperty('--color-blue-500', preset.primary);
  root.style.setProperty('--color-blue-400', preset.hover);
  root.style.setProperty('--color-blue-50', preset.light);
  root.style.setProperty('--color-blue-100', preset.subtle);
  root.style.setProperty('--color-blue-200', preset.border);

  // 4. Mark data-theme-color attribute on html root
  root.setAttribute('data-theme-color', colorId);
};

export interface ThemeContextType {
  color: ThemeColorId;
  preset: ThemePreset;
  presets: typeof THEME_PRESETS;
  setColor: (color: ThemeColorId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { company } = useERP();
  const { user, companyId } = useAuth();

  const getInitialColor = (): ThemeColorId => {
    // 1. Authoritative user preference from localStorage FIRST
    const stored = getUserStoredThemeColor(user?.id, companyId);
    if (stored) {
      return stored;
    }
    // 2. Company profile saved color (only if non-empty and not default placeholder when no local preference exists)
    if (company?.primaryColor && company.primaryColor !== 'blue') {
      return normalizeThemeColor(company.primaryColor);
    }
    // 3. Fallback to default blue
    return 'blue';
  };

  const [activeColor, setActiveColor] = useState<ThemeColorId>(getInitialColor);

  // Synchronize CSS variables whenever activeColor changes or on initial mount
  useEffect(() => {
    applyThemeVariables(activeColor);
  }, [activeColor]);

  // Synchronize when authenticated user changes or loads their preference
  useEffect(() => {
    if (user?.id) {
      const userStored = getUserStoredThemeColor(user.id, companyId);
      if (userStored && userStored !== activeColor) {
        setActiveColor(userStored);
        applyThemeVariables(userStored);
      }
    }
  }, [user?.id, companyId]);

  const setColor = useCallback(
    async (newColor: ThemeColorId) => {
      const normalized = normalizeThemeColor(newColor);
      setActiveColor(normalized);
      applyThemeVariables(normalized);

      // Persist to user-scoped local storage synchronously
      try {
        if (user?.id) {
          localStorage.setItem(`universal_billing_theme_user_${user.id}`, normalized);
        }
        localStorage.setItem('universal_billing_theme_active', normalized);
      } catch (err) {
        console.warn('Could not save theme to localStorage:', err);
      }

      // Persist to Supabase user_preferences table asynchronously without touching company settings
      if (user?.id) {
        try {
          await supabase
            .from('user_preferences')
            .upsert({
              user_id: user.id,
              company_id: companyId || '00000000-0000-0000-0000-000000000001',
              accent_color: normalized,
              updated_at: new Date().toISOString()
            });
        } catch (err) {
          // Graceful fallback if database table is not connected or in test mode
        }
      }
    },
    [user?.id, companyId]
  );

  const value: ThemeContextType = {
    color: activeColor,
    preset: THEME_PRESETS[activeColor] || THEME_PRESETS.blue,
    presets: THEME_PRESETS,
    setColor
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
