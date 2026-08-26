import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hsdautlwgdhhdprlwnjz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZGF1dGx3Z2RoaGRwcmx3bmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTYwODUsImV4cCI6MjEwMzMzMjA4NX0.673dptcdQLtZKul7btWO89SFSGpeJTJ0En7d919_qxo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
