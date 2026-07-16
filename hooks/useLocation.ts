import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    address: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState((s) => ({ ...s, isLoading: false, error: 'Permission de localisation refusée' }));
          return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = location.coords;

        // Reverse geocode to get address
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const address = place
          ? [place.district ?? place.subregion, place.city].filter(Boolean).join(', ')
          : null;

        setState({ latitude, longitude, address, isLoading: false, error: null });
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Impossible de récupérer votre position',
        }));
      }
    })();
  }, []);

  return state;
}
