// app/(pro)/business/[id].tsx
// Affiche directement CatalogSection (qui a son propre header + navigation)
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { CatalogSection } from '@/components/pro/CatalogSection';

export default function ProBusinessScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return null;
  return <CatalogSection businessId={id}/>;
}
