import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BusinessCard from "@/components/BusinessCard";
import EmptyState from "@/components/EmptyState";
import { MOCK_BUSINESSES } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const favorites = MOCK_BUSINESSES.filter((b) => user?.favoriteIds.includes(b.id));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Mes Favoris</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {favorites.length} business enregistré{favorites.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {favorites.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Aucun favori"
          subtitle="Ajoutez des business à vos favoris pour les retrouver facilement ici"
          actionLabel="Explorer"
          onAction={() => router.push("/(tabs)/search")}
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BusinessCard
              business={item}
              style={styles.card}
              onPress={() => router.push({ pathname: "/business/[id]", params: { id: item.id } })}
              isFavorite={true}
              onFavoriteToggle={() => toggleFavorite(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: "800" },
  sub: { fontSize: 13, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  card: {},
});
