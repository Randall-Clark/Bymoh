import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isBusinessOpen } from '@/lib/utils';

export type SearchFilterType = 'all' | 'boutique' | 'prestation' | 'article' | 'lieu';

export interface SearchFilters {
  type:         SearchFilterType;
  openNow:      boolean;
  nearMe:       boolean;
  minRating:    number | null;
  maxPrice:     number | null;
  localisation: string;
  categoryId?:  string;
}

export interface SearchResult {
  type:      'boutique' | 'prestation' | 'article' | 'lieu';
  id:        string;
  title:     string;
  subtitle?: string;
  meta?:     string;
  emoji?:    string;
  tag?:      string;
  rating?:   number;
  isOpen?:   boolean;
  raw:       Record<string, any>;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  type:         'all',
  openNow:      false,
  nearMe:       false,
  minRating:    null,
  maxPrice:     null,
  localisation: '',
  categoryId:   undefined,
};

// ── Multi-mots : "pc gaming" → name ILIKE '%pc%' OR name ILIKE '%gaming%' ────
function buildOrConditions(query: string, columns: string[]): string {
  const tokens = query.trim().split(/\s+/).filter((t) => t.length > 0);
  const conditions: string[] = [];
  for (const token of tokens) {
    for (const col of columns) {
      conditions.push(`${col}.ilike.%${token}%`);
    }
  }
  return conditions.join(',');
}

async function performSearch(
  query: string,
  filters: SearchFilters,
): Promise<SearchResult[]> {
  const q             = query.trim();
  const isTag         = q.startsWith('#');
  const isCategoryOnly = !q && !!filters.categoryId;
  const results: SearchResult[] = [];

  // ── Boutiques + Lieux ─────────────────────────────────────────────────────
  if (filters.type === 'all' || filters.type === 'boutique' || filters.type === 'lieu') {
    let dbq = supabase
      .from('businesses')
      .select('id, name, tag, category, category_icon, city, address, rating, is_open, is_active, hours:business_hours(*)')
      .eq('is_active', true);

    // Filtre localisation
    if (filters.localisation) dbq = dbq.ilike('city', `%${filters.localisation}%`);

    // Filtre catégorie (clic sur tuile catégorie)
    if (filters.categoryId) dbq = dbq.eq('category', filters.categoryId);

    if (!isCategoryOnly) {
      if (isTag) {
        // ✅ Recherche SQL directe sur la colonne tag stockée en DB
        dbq = dbq.ilike('tag', `%${q}%`);
      } else if (filters.type === 'lieu') {
        dbq = dbq.or(buildOrConditions(q, ['city', 'address']));
      } else if (q) {
        dbq = dbq.or(buildOrConditions(q, ['name', 'description']));
      }
    }

    if (filters.minRating !== null) dbq = dbq.gte('rating', filters.minRating);

    const { data: bizData } = await dbq
      .order('rating', { ascending: false })
      .limit(40);

    (bizData ?? []).forEach((b: any) => {
      const open = isBusinessOpen(b.hours);

      // Filtre "Ouvert maintenant"
      if (filters.openNow && !open) return;

      results.push({
        type:     filters.type === 'lieu' ? 'lieu' : 'boutique',
        id:       b.id,
        title:    b.name,
        subtitle: b.category,
        meta:     b.city,
        emoji:    b.category_icon,
        tag:      b.tag ?? undefined,   // ✅ tag depuis la DB directement
        rating:   b.rating,
        isOpen:   open,
        raw:      b,
      });
    });
  }

  // ── Prestations ───────────────────────────────────────────────────────────
  if ((filters.type === 'all' || filters.type === 'prestation') && (q || isCategoryOnly)) {
    let dbq = supabase
      .from('services')
      .select('id, title, description, price, currency, business_id, businesses(name, city, category_icon, category, is_active)')
      .eq('is_available', true);

    if (filters.categoryId) {
      dbq = (dbq as any).eq('businesses.category', filters.categoryId);
    }

    if (q && !isTag) {
      dbq = dbq.or(buildOrConditions(q, ['title', 'description']));
    }

    if (filters.maxPrice !== null) dbq = dbq.lte('price', filters.maxPrice);

    const { data: svcData } = await dbq.limit(20);
    (svcData ?? []).forEach((s: any) => {
      const biz = s.businesses;
      if (!biz?.is_active) return;
      results.push({
        type:     'prestation',
        id:       s.id,
        title:    s.title,
        subtitle: biz?.name,
        meta:     s.price ? `${s.price.toLocaleString('fr-FR')} ${s.currency ?? 'FCFA'}` : undefined,
        emoji:    biz?.category_icon ?? '🔧',
        raw:      s,
      });
    });
  }

  // ── Articles ──────────────────────────────────────────────────────────────
  if (filters.type === 'article' && (q || isCategoryOnly)) {
    let dbq = supabase
      .from('services')
      .select('id, title, description, price, currency, business_id, businesses(name, city, category_icon, is_active)')
      .eq('is_available', true);

    if (q && !isTag) dbq = dbq.or(buildOrConditions(q, ['title', 'description']));
    if (filters.maxPrice !== null) dbq = dbq.lte('price', filters.maxPrice);

    const { data: artData } = await dbq.limit(20);
    (artData ?? []).forEach((a: any) => {
      const biz = a.businesses;
      if (!biz?.is_active) return;
      results.push({
        type:     'article',
        id:       a.id,
        title:    a.title,
        subtitle: biz?.name,
        meta:     a.price ? `${a.price.toLocaleString('fr-FR')} ${a.currency ?? 'FCFA'}` : undefined,
        emoji:    biz?.category_icon ?? '📦',
        raw:      a,
      });
    });
  }

  return results;
}

export function useSearch(
  query: string,
  filters: SearchFilters,
  enabled: boolean,
) {
  const isCategoryOnly = !query.trim() && !!filters.categoryId;
  return useQuery<SearchResult[]>({
    queryKey:  ['search', query, filters],
    queryFn:   () => performSearch(query, filters),
    enabled:   enabled && (query.trim().length >= 1 || isCategoryOnly),
    staleTime: 30_000,
  });
}
