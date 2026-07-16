import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';

const { width: W } = Dimensions.get('window');
const BG = '#E84B1A';

const SLIDES = [
  {
    id: '1',
    image: require('../assets/images/illus_1.png'),
    title: 'Tous les commerces\nprès de chez vous',
    subtitle: 'Restaurants, artisans, beauté, santé —\ntout près de chez vous.',
  },
  {
    id: '2',
    image: require('../assets/images/illus_2.png'),
    title: 'Réservez & commandez\nen 3 clics',
    subtitle: 'Un service ou une livraison, directement\ndepuis votre mobile.',
  },
  {
    id: '3',
    image: require('../assets/images/illus_3.png'),
    title: 'Livraison rapide\nà domicile',
    subtitle: 'Via votre livreur ou retrait sur place —\nvous choisissez.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, isLoading } = useAuthStore();

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/(client)');
    }
  }, [session, isLoading]);

  if (session) return null;

  const topPad = Platform.OS === 'web' ? 48 : insets.top + 16;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const ready = !isLoading;

  return (
    <View style={styles.root}>
      {/* Logo */}
      <View style={[styles.logoRow, { paddingTop: topPad }]}>
        <Image
          source={require('../assets/images/bymoh-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Carousel */}
      <View style={styles.carouselArea}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W);
            setActiveIndex(idx);
            startTimer();
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.illustrationFrame}>
                <Image source={item.image} style={styles.illustration} resizeMode="contain" />
              </View>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* Buttons */}
      <View style={[styles.bottom, { paddingBottom: botPad + 24 }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, !ready && { opacity: 0.6 }]}
          onPress={() => ready && router.push({ pathname: '/(auth)/phone', params: { mode: 'login' } })}
          activeOpacity={0.88}
          disabled={!ready}
        >
          <Text style={styles.ctaText}>{isLoading ? 'Chargement…' : 'Se connecter'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.registerBtn, !ready && { opacity: 0.6 }]}
          onPress={() => ready && router.push({ pathname: '/(auth)/phone', params: { mode: 'signup' } })}
          activeOpacity={0.88}
          disabled={!ready}
        >
          <Text style={styles.registerText}>Créer un compte</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          En continuant, vous acceptez nos{' '}
          <Text style={styles.legalLink}>conditions d'utilisation</Text>
        </Text>
      </View>
    </View>
  );
}

const ILLUS_SIZE = Math.min(W * 0.62, 260);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  logoRow: { alignItems: 'center', paddingBottom: 8 },
  logo: { width: 120, height: 72 },
  carouselArea: { flex: 1, justifyContent: 'center' },
  slide: { width: W, alignItems: 'center', paddingHorizontal: 32, paddingTop: 8, paddingBottom: 24 },
  illustrationFrame: {
    width: ILLUS_SIZE, height: ILLUS_SIZE, borderRadius: 28,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 32, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  illustration: { width: '100%', height: '100%' },
  slideTitle: {
    fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    letterSpacing: -0.4, lineHeight: 33, marginBottom: 10,
  },
  slideSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.80)', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, backgroundColor: '#FFFFFF' },
  bottom: { gap: 12, paddingHorizontal: 32, paddingTop: 8 },
  ctaBtn: {
    backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 100, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: BG },
  registerBtn: { paddingVertical: 16, borderRadius: 100, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  registerText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  legal: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 },
  legalLink: { color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' },
});
