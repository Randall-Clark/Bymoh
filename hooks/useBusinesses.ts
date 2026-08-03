import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isBusinessOpen } from '@/lib/utils';
import type { Business, Service } from '@/types';

export interface BusinessFilters {
  city?: string;
  category?: string;
  searchQuery?: string;
  openNow?: boolean;
}

async function fetchBusinesses(filters: BusinessFilters): Promise<Business[]> {
  let q = supabase
    .from('businesses')
    .select('*, hours:business_hours(*)')
    .eq('is_active', true);

  if (filters.city)        q = q.ilike('city', `%${filters.city}%`);
  if (filters.category)    q = q.eq('category', filters.category);
  if (filters.searchQuery) q = q.or(
    `name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
  );

  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;

  const businesses = (data ?? []) as Business[];
  if (filters.openNow) return businesses.filter((b) => isBusinessOpen(b.hours));
  return businesses;
}

// ── useBusinesses — passe null pour désactiver le fetch ──────────────────────
export function useBusinesses(filters: BusinessFilters | null) {
  return useQuery<Business[]>({
    queryKey:  ['businesses', filters],
    queryFn:   () => fetchBusinesses(filters as BusinessFilters),
    enabled:   filters !== null,
    staleTime: 60_000,
  });
}

// ── useBusiness — une seule boutique par ID ───────────────────────────────────
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
    enabled:   !!id,
    staleTime: 30_000,
  });
}

// ── useMyBusinesses — boutiques d'un marchand ────────────────────────────────
export function useMyBusinesses(ownerId: string | undefined) {
  return useQuery<Business[]>({
    queryKey: ['my-businesses', ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .eq('owner_id', ownerId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
    enabled:   !!ownerId,
    staleTime: 30_000,
  });
}

// ── useBusinessCatalog — catalogue d'une boutique ────────────────────────────
export function useBusinessCatalog(businessId: string) {
  return useQuery<Service[]>({
    queryKey: ['catalog', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_available', true)
        .order('title');
      if (error) throw error;
      return (data ?? []) as Service[];
    },
    enabled:   !!businessId,
    staleTime: 30_000,
  });
}
