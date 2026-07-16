import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessHeader } from '@/components/business/BusinessHeader';
import { CatalogItemCard } from '@/components/catalog/CatalogItemCard';
import { Badge } from '@/components/ui/Badge';
import { useCart } from '@/hooks/useCart';
import { useBusiness, useBusinessCatalog } from '@/hooks/useBusinesses';
import { formatPrice } from '@/lib/utils';
import type { CatalogItem } from '@/types';

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: business, isLoading: bizLoading } = useBusiness(id ?? '');
  const { data: catalog = [], isLoading: catLoading } = useBusinessCatalog(id ?? '');
  const { items: cartItems, totalItems, totalAmount, addToCart, removeFromCart, updateQuantity } = useCart();
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');

  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const products = (catalog as CatalogItem[]).filter((i) => !i.allows_booking);
  const services = (catalog as CatalogItem[]).filter((i) => i.allows_booking);
  const displayItems = activeTab === 'products' ? products : services;

  const getQty = (itemId: string) => cartItems.find((i) => i.service_id === itemId)?.quantity ?? 0;

  if (bizLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FF6835" size="large" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Commerce introuvable</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + (totalItems > 0 ? 100 : 40) }]} showsVerticalScrollIndicator={false}>
        <BusinessHeader business={business} />

        {/* Description */}
        {business.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.desc}>{business.description}</Text>
          </View>
        )}

        {/* Contact */}
        {(business.phone || business.email) && (
          <View style={styles.contactRow}>
            {business.phone && (
              <View style={styles.contactItem}>
                <Feather name="phone" size={14} color="#6B7280" />
                <Text style={styles.contactText}>{business.phone}</Text>
              </View>
            )}
            {business.email && (
              <View style={styles.contactItem}>
                <Feather name="mail" size={14} color="#6B7280" />
                <Text style={styles.contactText}>{business.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* Tabs */}
        {catalog.length > 0 && (
          <View style={styles.section}>
            <View style={styles.tabRow}>
              {(['products', 'services'] as const).map((t) => {
                const count = t === 'products' ? products.length : services.length;
                if (count === 0) return null;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
                    onPress={() => setActiveTab(t)}
                  >
                    <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>
                      {t === 'products' ? `Produits (${count})` : `Services (${count})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {catLoading ? (
              <ActivityIndicator color="#FF6835" style={{ marginTop: 20 }} />
            ) : displayItems.length === 0 ? (
              <Text style={styles.emptyText}>Aucun élément dans cette catégorie.</Text>
            ) : (
              <View style={styles.catalogList}>
                {displayItems.map((item) => (
                  <CatalogItemCard
                    key={item.id}
                    item={item}
                    quantity={getQty(item.id)}
                    onAdd={() => addToCart(item, business.id, business.name)}
                    onRemove={() => {
                      const qty = getQty(item.id);
                      if (qty <= 1) removeFromCart(item.id);
                      else updateQuantity(item.id, qty - 1);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Book a service */}
        {services.length > 0 && (
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => router.push({ pathname: '/(client)/booking/[businessId]', params: { businessId: business.id } })}
            activeOpacity={0.85}
          >
            <Feather name="calendar" size={18} color="#fff" />
            <Text style={styles.bookBtnText}>Réserver un service</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Cart footer */}
      {totalItems > 0 && (
        <View style={[styles.cartFooter, { paddingBottom: botPad + 8 }]}>
          <View>
            <Text style={styles.cartCount}>{totalItems} article{totalItems > 1 ? 's' : ''}</Text>
            <Text style={styles.cartTotal}>{formatPrice(totalAmount)}</Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push('/(client)/order/cart')}
            activeOpacity={0.88}
          >
            <Text style={styles.cartBtnText}>Voir le panier</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F7F4', gap: 16 },
  errorText: { fontSize: 16, color: '#374151' },
  backLink: { fontSize: 15, color: '#FF6835', fontWeight: '700' },
  scrollContent: { gap: 0 },
  section: { backgroundColor: '#fff', padding: 20, marginTop: 8, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, marginTop: 1 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, color: '#6B7280' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  tabBtnActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#fff' },
  catalogList: { gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1E3A5F', margin: 20, padding: 16, borderRadius: 16 },
  bookBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cartFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  cartCount: { fontSize: 12, color: '#6B7280' },
  cartTotal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cartBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF6835', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 100 },
  cartBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
