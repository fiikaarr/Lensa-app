import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://itretogfrtjwsscrwicc.supabase.co'
const supabaseKey = 'sb_publishable_SfRwD2COKx1R0THsyciitQ_PukUGCHG'

export const supabase = createClient(supabaseUrl, supabaseKey)