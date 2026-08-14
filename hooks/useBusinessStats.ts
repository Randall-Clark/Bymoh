// hooks/useBusinessStats.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type StatPeriod = 'today' | 'week' | 'month' | 'year';

export interface BusinessStats {
  orders:       number;
  bookings:     number;
  revenue:      number;
  rating:       number;
  reviewCount:  number;
  clients:      number;
}

// ── Calcule la date de début selon la période ─────────────────────────────────
function getFrom(period: StatPeriod): string {
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d.toISOString();
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString();
    }
  }
}

async function fetchStats(businessId: string, period: StatPeriod): Promise<BusinessStats> {
  const from = getFrom(period);

  // ── Commandes ─────────────────────────────────────────────────────────────
  const { count: ordersCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('created_at', from);

  // ── Revenus (somme des commandes livrées) ─────────────────────────────────
  const { data: revenueData } = await supabase
    .from('orders')
    .select('total')
    .eq('business_id', businessId)
    .in('status', ['delivered'])
    .gte('created_at', from);

  const revenue = (revenueData ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);

  // ── Réservations ──────────────────────────────────────────────────────────
  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('created_at', from);

  // ── Avis clients ──────────────────────────────────────────────────────────
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', from);

  // ── Note moyenne ──────────────────────────────────────────────────────────
  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('business_id', businessId)
    .gte('created_at', from);

  const ratings   = (ratingData ?? []).map((r) => r.rating).filter(Boolean);
  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 0;

  // ── Clients uniques (depuis commandes + réservations) ─────────────────────
  const { data: orderClients } = await supabase
    .from('orders')
    .select('user_id')
    .eq('business_id', businessId)
    .gte('created_at', from);

  const { data: bookingClients } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('business_id', businessId)
    .gte('created_at', from);

  const allClientIds = [
    ...(orderClients ?? []).map((o) => o.user_id),
    ...(bookingClients ?? []).map((b) => b.user_id),
  ];
  const uniqueClients = new Set(allClientIds.filter(Boolean)).size;

  return {
    orders:      ordersCount ?? 0,
    bookings:    bookingsCount ?? 0,
    revenue,
    rating:      avgRating,
    reviewCount: reviewCount ?? 0,
    clients:     uniqueClients,
  };
}

export function useBusinessStats(businessId: string, period: StatPeriod) {
  return useQuery<BusinessStats>({
    queryKey:  ['business-stats', businessId, period],
    queryFn:   () => fetchStats(businessId, period),
    enabled:   !!businessId,
    staleTime: 60_000,
  });
}
