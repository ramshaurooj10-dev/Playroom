import { getSupabaseClient } from './supabaseClient';

export interface SchoolTierConfig {
  id: string; // 'school_1month' | 'school_3months' | 'school_6months' | 'school_12months'
  durationMonths: number; // 1, 3, 6, 12
  label: string; // e.g., '1 Month'
  title: string; // e.g., '1 Month - Starter Term'
  description: string;
  pricePkr: number;
  priceUsd: number;
  maxDevices: number;
  page1Access: boolean;
  page2Access: boolean;
  isActive: boolean;
}

export interface SchoolPricingConfig {
  tiers: SchoolTierConfig[];
  updatedAt: string;
}

export const DEFAULT_SCHOOL_TIERS: SchoolTierConfig[] = [
  {
    id: 'school_1month',
    durationMonths: 1,
    label: '1 Month',
    title: 'School Monthly License',
    description: 'Preschool classroom license for 15 student devices for 30 days with full app access.',
    pricePkr: 25000,
    priceUsd: 100,
    maxDevices: 15,
    page1Access: true,
    page2Access: true,
    isActive: true,
  },
  {
    id: 'school_3months',
    durationMonths: 3,
    label: '3 Months',
    title: 'School 3 Months License',
    description: 'Preschool classroom license for 15 student devices for 90 days with full app access.',
    pricePkr: 70000,
    priceUsd: 280,
    maxDevices: 15,
    page1Access: true,
    page2Access: true,
    isActive: true,
  },
  {
    id: 'school_6months',
    durationMonths: 6,
    label: '6 Months',
    title: 'School 6 Months License',
    description: 'Preschool classroom license for 15 student devices for 180 days with full app access.',
    pricePkr: 120000,
    priceUsd: 480,
    maxDevices: 15,
    page1Access: true,
    page2Access: true,
    isActive: true,
  },
  {
    id: 'school_12months',
    durationMonths: 12,
    label: '12 Months (1 Year)',
    title: 'School 12 Months License',
    description: 'Comprehensive preschool annual license for 15 student devices for 365 days with full app access.',
    pricePkr: 220000,
    priceUsd: 880,
    maxDevices: 15,
    page1Access: true,
    page2Access: true,
    isActive: true,
  },
];

const STORAGE_KEY_SCHOOL_PRICING = 'playroom_school_pricing_config';

/**
 * Retrieve Admin-configured school pricing tiers
 */
export const getSchoolPricingConfig = (): SchoolTierConfig[] => {
  if (typeof window === 'undefined') return DEFAULT_SCHOOL_TIERS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SCHOOL_PRICING);
    if (saved) {
      const parsed: SchoolTierConfig[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all 4 standard durations exist
        const durations = [1, 3, 6, 12];
        const merged = durations.map((d) => {
          const found = parsed.find((p) => p.durationMonths === d);
          const def = DEFAULT_SCHOOL_TIERS.find((t) => t.durationMonths === d)!;
          if (found) {
            return {
              ...def,
              ...found,
              pricePkr: Number(found.pricePkr) || def.pricePkr,
              priceUsd: Number(found.priceUsd) || def.priceUsd,
              maxDevices: Number(found.maxDevices) || def.maxDevices,
              page1Access: found.page1Access !== undefined ? Boolean(found.page1Access) : def.page1Access,
              page2Access: found.page2Access !== undefined ? Boolean(found.page2Access) : def.page2Access,
              isActive: found.isActive !== undefined ? Boolean(found.isActive) : true,
            };
          }
          return def;
        });
        return merged;
      }
    }
  } catch (e) {
    console.warn('Could not parse school pricing config:', e);
  }
  return DEFAULT_SCHOOL_TIERS;
};

/**
 * Save Admin-configured school pricing tiers
 */
export const saveSchoolPricingConfig = async (tiers: SchoolTierConfig[]): Promise<boolean> => {
  try {
    localStorage.setItem(STORAGE_KEY_SCHOOL_PRICING, JSON.stringify(tiers));

    // Sync to Supabase products table
    const supabase = getSupabaseClient();
    if (supabase) {
      for (const tier of tiers) {
        await supabase.from('products').upsert({
          id: tier.id,
          name: tier.title,
          description: tier.description,
          type: 'school_license',
          price_pkr: tier.pricePkr,
          price_usd: tier.priceUsd,
          duration_months: tier.durationMonths,
          is_active: tier.isActive,
          updated_at: new Date().toISOString(),
        });
      }
    }
    return true;
  } catch (e) {
    console.warn('Error saving school pricing config:', e);
    return false;
  }
};

/**
 * Helper to get pricing for a specific duration
 */
export const getSchoolTierByDuration = (durationMonths: number): SchoolTierConfig => {
  const tiers = getSchoolPricingConfig();
  const found = tiers.find((t) => t.durationMonths === durationMonths);
  if (found) return found;
  const def = DEFAULT_SCHOOL_TIERS.find((t) => t.durationMonths === durationMonths);
  return def || DEFAULT_SCHOOL_TIERS[0];
};
