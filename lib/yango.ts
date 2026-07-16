import type { DeliveryEstimate } from '@/types';

const YANGO_API_KEY = process.env.YANGO_API_KEY ?? '';
const YANGO_BASE_URL = 'https://api.yango.com/v2';

export interface YangoPayload {
  pickup: { lat: number; lon: number; address: string };
  dropoff: { lat: number; lon: number; address: string };
  comment?: string;
  client_phone: string;
}

/** Get delivery estimate from Yango */
export async function getYangoEstimate(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
): Promise<DeliveryEstimate> {
  try {
    const res = await fetch(`${YANGO_BASE_URL}/estimate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': YANGO_API_KEY,
      },
      body: JSON.stringify({
        source: { lat: pickupLat, lon: pickupLng },
        destination: { lat: dropLat, lon: dropLng },
      }),
    });
    if (!res.ok) throw new Error('Yango API error');
    const data = await res.json();
    return {
      provider: 'yango',
      price: data.price ?? 1200,
      duration_minutes: data.eta ?? 18,
      currency: 'FCFA',
    };
  } catch {
    // Fallback estimate when API is unavailable
    return { provider: 'yango', price: 1200, duration_minutes: 18, currency: 'FCFA' };
  }
}

/** Create a Yango delivery order */
export async function createYangoDelivery(payload: YangoPayload): Promise<{ order_id: string }> {
  const res = await fetch(`${YANGO_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': YANGO_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create Yango delivery');
  return res.json();
}
