import { PremiumProduct } from '../../types/payment';
import { getSupabaseClient } from '../../utils/supabaseClient';
import { getSchoolPricingConfig } from '../../utils/schoolPricingService';

export const INDIVIDUAL_PREMIUM_PRODUCTS: PremiumProduct[] = [
  {
    id: 'level_1_free',
    title: 'Level 1: Nursery Explorers (Free Starter)',
    type: 'free_level_1',
    pricePkr: 0,
    priceUsd: 0,
    durationDays: 365,
    description: '100% Free forever starter activities: Letter shapes, first phonics sounds, and colors.',
    isActive: true,
    levelNumber: 1,
  },
  {
    id: 'watch_ad_unlock',
    title: 'Watch Ad (Unlock 1 Activity)',
    type: 'ad_unlock',
    pricePkr: 0,
    priceUsd: 0,
    durationDays: 1,
    description: 'Watch a quick 5-second kid-safe sponsor ad to immediately unlock any individual learning activity.',
    isActive: true,
  },
  {
    id: 'three_activities_7days',
    title: '3 Activities Pass (7 Days)',
    type: 'three_activities',
    pricePkr: 300,
    priceUsd: 2,
    durationDays: 7,
    description: 'Unlock any 3 premium learning activities of your choice with full access for 7 days.',
    isActive: true,
  },
  {
    id: 'all_activities',
    title: 'All Activities + Education Hub (Full App Pass)',
    type: 'all_activities',
    pricePkr: 5000,
    priceUsd: 20,
    durationDays: 30,
    description: 'Full App Access: Unlocks 100% of all Playroom activities (Levels 1–6) AND full Preschool Educator Hub access for 30 days.',
    isActive: true,
  },
  {
    id: 'prod_indiv_all_activities',
    title: 'All Activities + Education Hub (Full App Pass)',
    type: 'all_activities',
    pricePkr: 5000,
    priceUsd: 20,
    durationDays: 30,
    description: 'Full App Access: Unlocks 100% of all Playroom activities (Levels 1–6) AND full Preschool Educator Hub access for 30 days.',
    isActive: true,
  },
];

/**
 * Get dynamic school products generated from admin-controlled tiers
 */
export const getDynamicSchoolProducts = (): PremiumProduct[] => {
  const tiers = getSchoolPricingConfig();
  return tiers.map((t) => ({
    id: `school_${t.durationMonths}m`,
    title: `School License (${t.label})`,
    type: t.durationMonths === 1 ? 'school_monthly' : t.durationMonths === 12 ? 'school_yearly' : 'school_monthly',
    pricePkr: t.pricePkr,
    priceUsd: t.priceUsd,
    durationDays: t.durationMonths * 30,
    description: `Preschool license for up to ${t.maxDevices} devices. Page 1: ${t.page1Access ? 'Yes' : 'No'}, Page 2: ${t.page2Access ? 'Yes' : 'No'}.`,
    isActive: true,
  }));
};

export const getCombinedProducts = (): PremiumProduct[] => {
  return [...INDIVIDUAL_PREMIUM_PRODUCTS, ...getDynamicSchoolProducts()];
};

export const DEFAULT_PREMIUM_PRODUCTS: PremiumProduct[] = getCombinedProducts();

let cachedSupabaseProducts: PremiumProduct[] = [...DEFAULT_PREMIUM_PRODUCTS];

/**
 * Fetch and sync products dynamically from Supabase database
 */
export const fetchProductsFromSupabase = async (): Promise<PremiumProduct[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) return cachedSupabaseProducts;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      return cachedSupabaseProducts;
    }

    const mapped: PremiumProduct[] = data.map((item: any) => ({
      id: item.id,
      title: item.name || item.title,
      type: item.type || (item.level_number ? 'one_level' : 'all_activities'),
      pricePkr: Number(item.price_pkr) || 800,
      priceUsd: Number(item.price_usd) || 5,
      durationDays: (item.duration_months || 1) * 30,
      description: item.description || '',
      isActive: item.is_active !== false,
    }));

    // Merge with defaults so lookups by alias IDs still work
    const combined = [...mapped];
    for (const d of DEFAULT_PREMIUM_PRODUCTS) {
      if (!combined.some((c) => c.id === d.id)) {
        combined.push(d);
      }
    }

    cachedSupabaseProducts = combined;
    return cachedSupabaseProducts;
  } catch (err) {
    console.warn('Failed to load products from Supabase:', err);
    return cachedSupabaseProducts;
  }
};

export const PREMIUM_PRODUCTS = cachedSupabaseProducts;

export const getProductById = (id: string): PremiumProduct | undefined => {
  return cachedSupabaseProducts.find((p) => p.id === id) || DEFAULT_PREMIUM_PRODUCTS.find((p) => p.id === id);
};

export const getProductByType = (type: string): PremiumProduct | undefined => {
  return cachedSupabaseProducts.find((p) => p.type === type) || DEFAULT_PREMIUM_PRODUCTS.find((p) => p.type === type);
};

export const getProductByLevel = (level: number): PremiumProduct | undefined => {
  const levelId = `level_${level}`;
  return getProductById(levelId) || getProductById('prod_indiv_one_level');
};
