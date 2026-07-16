import type { DeliveryEstimate } from '@/types';

const GOZEM_API_KEY = process.env.GOZEM_API_KEY ?? '';
const GOZEM_BASE_URL = 'https://api.gozem.co/v1';

export interface GozemPayload {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  orderId: string;
  clientPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}

/** Get delivery estimate from Gozem */
export async function getGozemEstimate(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
): Promise<DeliveryEstimate> {
  try {
    const res = await fetch(`${GOZEM_BASE_URL}/estimate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GOZEM_API_KEY}`,
      },
      body: JSON.stringify({
        pickup: { latitude: pickupLat, longitude: pickupLng },
        dropoff: { latitude: dropLat, longitude: dropLng },
      }),
    });
    if (!res.ok) throw new Error('Gozem API error');
    const data = await res.json();
    return {
      provider: 'gozem',
      price: data.price ?? 1500,
      duration_minutes: data.eta_minutes ?? 20,
      currency: 'FCFA',
    };
  } catch {
    // Fallback estimate when API is unavailable
    return { provider: 'gozem', price: 1500, duration_minutes: 20, currency: 'FCFA' };
  }
}

/** Create a Gozem delivery order */
export async function createGozemDelivery(payload: GozemPayload): Promise<{ delivery_id: string }> {
  const res = await fetch(`${GOZEM_BASE_URL}/deliveries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GOZEM_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create Gozem delivery');
  return res.json();
}
