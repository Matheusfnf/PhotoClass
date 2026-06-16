import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Tipos espelho do banco local ───────────────────────────────────────────

export interface RemoteSpace {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteFolder {
  id: string;
  user_id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteItem {
  id: string;
  user_id: string;
  folder_id: string;
  type: string;
  title: string | null;
  storage_key: string | null;
  thumbnail_key: string | null;
  duration: number | null;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
