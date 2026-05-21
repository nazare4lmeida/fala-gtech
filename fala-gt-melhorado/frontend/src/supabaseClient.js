import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://whghsvoaaumqjhyrvixf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZ2hzdm9hYXVtcWpoeXJ2aXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDg3NTksImV4cCI6MjA5NDg4NDc1OX0.SUztf3OEisb7YvLZzjO2qDsx3ImFmM5YMMMGbXNJCfo';

export const supabase = createClient(supabaseUrl, supabaseKey);