import { supabase } from '../config/supabase.js';

export async function getExamQuestions(examId) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .order('original_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
