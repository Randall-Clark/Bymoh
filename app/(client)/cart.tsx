/**
 * app/(client)/cart.tsx
 * Entrée de la tab bar "Panier" — redirige vers order/cart
 */
import { Redirect } from 'expo-router';

export default function CartTab() {
  return <Redirect href="/(client)/order/cart" />;
}
