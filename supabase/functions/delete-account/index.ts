// @ts-nocheck
// ============================================================================
// Edge Function: delete-account
// ----------------------------------------------------------------------------
// Apaga PERMANENTEMENTE a conta do usuário autenticado: arquivos no Storage,
// linhas (items/folders/spaces/profile) e a própria conta de auth.
//
// Roda no servidor (Deno) usando a SERVICE ROLE — a chave admin que NUNCA pode
// ir pro app. Ela vem do secret SUPABASE_SERVICE_ROLE_KEY, injetado automaticamente
// no ambiente das Edge Functions (você não coloca em lugar nenhum do código/repo).
//
// Deploy:
//   supabase functions deploy delete-account
// (Requer o Supabase CLI logado no projeto. A função fica protegida por JWT: só
//  o próprio usuário consegue apagar a própria conta.)
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'Não autenticado.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Valida o JWT e descobre quem está chamando (cada um só apaga a própria conta).
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Sessão inválida.' }, 401);
    const userId = userData.user.id;

    const bucket = 'photoclass-files';

    // 1) Apaga os arquivos do Storage na pasta do usuário (<uid>/<tipo>/...).
    for (const folder of ['photos', 'audio', 'documents', 'thumbnails']) {
      const { data: files } = await admin.storage.from(bucket).list(`${userId}/${folder}`, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${userId}/${folder}/${f.name}`);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }

    // 2) Apaga as linhas (ordem respeita as foreign keys).
    await admin.from('items').delete().eq('user_id', userId);
    await admin.from('folders').delete().eq('user_id', userId);
    await admin.from('spaces').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    // 3) Apaga a conta de autenticação.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
