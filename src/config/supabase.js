import { createClient } from '@supabase/supabase-js';

// Reutiliza el cliente global (window.sb) si ya fue inicializado por supabase-global.js
// para evitar dos instancias separadas con estado de sesión independiente.
function getOrCreateClient() {
  if (typeof window !== 'undefined' && window.sb) return window.sb;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  }

  return createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const supabase = getOrCreateClient();
