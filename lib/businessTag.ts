// lib/businessTag.ts
// ── Utilitaire de génération du tag unique d'une boutique ─────────────────────
// Format : # + 2 lettres initiales + 4 derniers chars de l'ID
// Exemple : "Chez Maman Restaurant" avec id "abc123def4567" → #CM4567

export function buildBusinessTag(name: string, id: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  // Extraire uniquement les chiffres de l'ID, prendre les 3 derniers
  const digits = id.replace(/\D/g, '').slice(-3)
    || id.replace(/-/g, '').slice(-3); // fallback si pas assez de chiffres

  return `#${letters}${digits}`;
}
