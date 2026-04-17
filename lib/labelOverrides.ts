import { supabase } from '@/lib/supabase'
import { LabelOverride, applyLabelOverrides } from '@/lib/hebrewDate'

// Fetch all label overrides from DB. Returns empty array on error or if table missing.
export async function fetchLabelOverrides(): Promise<LabelOverride[]> {
  try {
    const { data, error } = await supabase
      .from('label_overrides')
      .select('original_text, replacement_text')
    if (error) return []
    return (data ?? []) as LabelOverride[]
  } catch {
    return []
  }
}

export { applyLabelOverrides }
