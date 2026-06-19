import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, driversTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.post("/drivers/register", requireAuth, async (req: AuthRequest, res) => {
  const {
    licenseNumber, licenseExpiry, licensePhotoUrl,
    idPhotoUrl, vehicleType, vehicleModel, vehiclePlate, vehiclePhotoUrl,
  } = req.body as {
    licenseNumber?: string; licenseExpiry?: string; licensePhotoUrl?: string;
    idPhotoUrl?: string; vehicleType?: "moto" | "voiture" | "velo" | "tricycle";
    vehicleModel?: string; vehiclePlate?: string; vehiclePhotoUrl?: string;
  };

  if (!licenseNumber || !vehicleType || !vehicleModel || !vehiclePlate) {
    res.status(400).json({ error: "Champs requis : licenseNumber, vehicleType, vehicleModel, vehiclePlate" }); return;
  }

  const [existing] = await db.select({ id: driversTable.id }).from(driversTable).where(eq(driversTable.userId, req.userId!)).limit(1);
  if (existing) { res.status(409).json({ error: "Vous avez déjà soumis une candidature livreur" }); return; }

  const [driver] = await db.insert(driversTable).values({
    userId: req.userId!,
    licenseNumber,
    licenseExpiry: licenseExpiry ?? null,
    licensePhotoUrl: licensePhotoUrl ?? null,
    idPhotoUrl: idPhotoUrl ?? null,
    vehicleType,
    vehicleModel,
    vehiclePlate,
    vehiclePhotoUrl: vehiclePhotoUrl ?? null,
    status: "pending",
  }).returning();

  await db.update(usersTable).set({ role: "driver", updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));

  res.status(201).json(driver);
});

router.get("/drivers/me", requireAuth, async (req: AuthRequest, res) => {
  const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, req.userId!)).limit(1);
  if (!driver) { res.status(404).json({ error: "Aucun profil livreur trouvé" }); return; }
  res.json(driver);
});

router.patch("/drivers/me", requireAuth, async (req: AuthRequest, res) => {
  const { isAvailable, currentLat, currentLng } = req.body as {
    isAvailable?: boolean; currentLat?: number; currentLng?: number;
  };
  const [driver] = await db.select({ id: driversTable.id }).from(driversTable).where(eq(driversTable.userId, req.userId!)).limit(1);
  if (!driver) { res.status(404).json({ error: "Profil livreur introuvable" }); return; }
  const updates: Partial<typeof driversTable.$inferInsert> = { updatedAt: new Date() };
  if (isAvailable !== undefined) updates.isAvailable = isAvailable;
  if (currentLat !== undefined) updates.currentLat = currentLat;
  if (currentLng !== undefined) updates.currentLng = currentLng;
  const [updated] = await db.update(driversTable).set(updates).where(eq(driversTable.id, driver.id)).returning();
  res.json(updated);
});

export default router;
