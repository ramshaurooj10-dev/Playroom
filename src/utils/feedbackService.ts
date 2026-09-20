import { getSupabaseClient } from './supabaseClient';

export interface FeedbackSubmission {
  id: string;
  rating: number; // 1 to 5
  feedback: string;
  created_at: string;
  user_email?: string;
  date_formatted?: string;
  time_formatted?: string;
}

const LOCAL_FEEDBACK_KEY = 'playroom_user_feedback_submissions';

export const formatFeedbackDate = (isoString: string): { date: string; time: string } => {
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { date, time };
  } catch {
    return { date: 'Today', time: '' };
  }
};

/**
 * Submit feedback to Supabase and persistent storage
 */
export const submitFeedback = async (data: {
  rating: number;
  feedback: string;
  userEmail?: string;
}): Promise<{ success: boolean; error?: string }> => {
  const timestamp = new Date().toISOString();
  const { date, time } = formatFeedbackDate(timestamp);

  const newEntry: FeedbackSubmission = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    rating: Math.min(5, Math.max(1, data.rating)),
    feedback: data.feedback.trim(),
    created_at: timestamp,
    user_email: data.userEmail || undefined,
    date_formatted: date,
    time_formatted: time,
  };

  // 1. Always save to local cache so data is never lost
  try {
    const existingRaw = localStorage.getItem(LOCAL_FEEDBACK_KEY);
    const list: FeedbackSubmission[] = existingRaw ? JSON.parse(existingRaw) : [];
    list.unshift(newEntry);
    localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Could not cache feedback to localStorage:', err);
  }

  // 2. Try Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('feedback').insert([
        {
          id: newEntry.id,
          rating: newEntry.rating,
          message: newEntry.feedback,
          status: 'PENDING',
          created_at: newEntry.created_at,
          user_email: newEntry.user_email,
        },
      ]);
      if (error) {
        console.warn('Supabase feedback insert error (data preserved locally):', error.message);
      }
    } catch (err) {
      console.warn('Supabase feedback request failed (data preserved locally):', err);
    }
  }

  return { success: true };
};

/**
 * Fetch feedback submissions for Admin View
 */
export const fetchAllFeedback = async (): Promise<FeedbackSubmission[]> => {
  let localList: FeedbackSubmission[] = [];
  try {
    const existingRaw = localStorage.getItem(LOCAL_FEEDBACK_KEY);
    if (existingRaw) {
      localList = JSON.parse(existingRaw);
    }
  } catch {
    localList = [];
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const formattedSupabase: FeedbackSubmission[] = data.map((item: any) => {
          const { date, time } = formatFeedbackDate(item.created_at || new Date().toISOString());
          return {
            id: item.id || `sb_${Math.random()}`,
            rating: Number(item.rating) || 5,
            feedback: item.message || item.feedback || '',
            created_at: item.created_at || new Date().toISOString(),
            user_email: item.user_email || undefined,
            date_formatted: date,
            time_formatted: time,
          };
        });

        // Merge without duplicates by ID
        const idMap = new Map<string, FeedbackSubmission>();
        formattedSupabase.forEach((fb) => idMap.set(fb.id, fb));
        localList.forEach((fb) => {
          if (!idMap.has(fb.id)) {
            idMap.set(fb.id, fb);
          }
        });

        return Array.from(idMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch (err) {
      console.warn('Could not load from Supabase, using local feedback cache:', err);
    }
  }

  return localList.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};
