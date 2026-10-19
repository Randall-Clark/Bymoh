/**
 * hooks/useFavoriteToggle.ts
 *
 * Hook partagé : source unique de vérité pour le cœur favori.
 * – Lecture  : Zustand (réactif, instantané)
 * – Écriture : Zustand en premier (UI optimiste) + Supabase en async
 * – Rollback : si Supabase échoue, Zustand revient en arrière
 *
 * Utilisé par BusinessCard, business/[id].tsx et favorites.tsx
 */
import { supabase } from '@/lib/supabase';
import { useFavoritesStore } from '@/stores/favoritesStore';

export function useFavoriteToggle(businessId: string) {
  const store  = useFavoritesStore();
  const isFav  = store.isFavorite(businessId);

  const toggle = async () => {
    if (!businessId) return;

    // 1. Mise à jour optimiste dans Zustand → UI réagit immédiatement
    store.setFavorite(businessId, !isFav);

    // 2. Récupérer l'utilisateur
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      store.setFavorite(businessId, isFav); // rollback
      return;
    }

    // 3. Écriture Supabase
    if (isFav) {
      // Retrait
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id',    user.id)
        .eq('business_id', businessId);
      if (error) store.setFavorite(businessId, isFav); // rollback
    } else {
      // Ajout
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, business_id: businessId });
      if (error) store.setFavorite(businessId, isFav); // rollback
    }
  };

  return { isFav, toggle };
}
