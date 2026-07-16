import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isBusinessOpen } from '@/lib/utils';
import type { Business, CatalogItem } from '@/types';

interface BusinessFilters {
  city?: string;
  category?: string;
  searchQuery?: string;
  openNow?: boolean;
}

async function fetchBusinesses(filters: BusinessFilters): Promise<Business[]> {
  let query = supabase
    .from('businesses')
    .select('*, hours:business_hours(*)')
    .eq('is_active', true);

  if (filters.city) query = query.ilike('city', `%${filters.city}%`);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.searchQuery) query = query.ilike('name', `%${filters.searchQuery}%`);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const businesses = (data ?? []) as Business[];

  if (filters.openNow) {
    return businesses.filter((b) => isBusinessOpen(b.hours));
  }

  return businesses;
}

export function useBusinesses(filters: BusinessFilters = {}) {
  return useQuery<Business[]>({
    queryKey: ['businesses', filters],
    queryFn: () => fetchBusinesses(filters),
    staleTime: 60_000,
  });
}

export function useBusiness(id: string) {
  return useQuery<Business>({
    queryKey: ['business', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Business;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useBusinessCatalog(businessId: string) {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_available', true)
        .order('title');
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}
