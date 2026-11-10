// supabase/functions/delete-service/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return Response.json({ error: 'Non authentifié' }, { status: 401, headers: cors });
    }

    // Décoder le JWT pour extraire l'user_id
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Response.json({ error: 'Token invalide' }, { status: 401, headers: cors });
    }

    let payload: any;
    try {
      payload = JSON.parse(atob(parts[1]));
    } catch {
      return Response.json({ error: 'Token malformé' }, { status: 401, headers: cors });
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return Response.json({ error: 'Session expirée' }, { status: 401, headers: cors });
    }

    const userId = payload.sub as string;
    if (!userId) {
      return Response.json({ error: 'User ID manquant' }, { status: 401, headers: cors });
    }

    const { serviceId } = await req.json();
    if (!serviceId) {
      return Response.json({ error: 'serviceId manquant' }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier que l'article appartient bien à l'utilisateur
    const { data: service, error: fetchErr } = await admin
      .from('services')
      .select('id, image_url, image_urls, business_id')
      .eq('id', serviceId)
      .single();

    if (fetchErr || !service) {
      return Response.json({ error: 'Article introuvable' }, { status: 404, headers: cors });
    }

    // Vérifier que le business appartient à l'utilisateur
    const { data: business, error: bizErr } = await admin
      .from('businesses')
      .select('id')
      .eq('id', service.business_id)
      .eq('owner_id', userId)
      .single();

    if (bizErr || !business) {
      return Response.json({ error: 'Non autorisé' }, { status: 403, headers: cors });
    }

    // Collecter toutes les URLs d'images
    const imagePaths: string[] = [];

    if (service.image_url) {
      const path = extractPath(service.image_url);
      if (path) imagePaths.push(path);
    }

    if (service.image_urls) {
      let urls: string[] = [];
      if (Array.isArray(service.image_urls)) {
        urls = service.image_urls;
      } else if (typeof service.image_urls === 'string') {
        try { urls = JSON.parse(service.image_urls); } catch { urls = [service.image_urls]; }
      }
      for (const u of urls) {
        const path = extractPath(u);
        if (path) imagePaths.push(path);
      }
    }

    // Supprimer les images du Storage
    if (imagePaths.length > 0) {
      const { error: storageErr } = await admin.storage
        .from('businesses')
        .remove(imagePaths);
      if (storageErr) {
        console.error('Erreur suppression images:', storageErr.message);
        // On continue quand même — on veut supprimer l'article même si les images échouent
      }
    }

    // Supprimer l'article de la DB
    const { error: deleteErr } = await admin
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (deleteErr) {
      return Response.json({ error: deleteErr.message }, { status: 500, headers: cors });
    }

    console.log(`Article supprimé: ${serviceId} (${imagePaths.length} image(s) supprimée(s))`);
    return Response.json({ success: true, deletedImages: imagePaths.length }, { headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Erreur:', msg);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});

/**
 * Extrait le chemin relatif dans le bucket "businesses" depuis une URL complète.
 * Ex: https://xxx.supabase.co/storage/v1/object/public/businesses/services/bizId/file.jpg
 *     → services/bizId/file.jpg
 */
function extractPath(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public\/)?businesses\/(.+)$/);
  return match ? match[1] : null;
}
