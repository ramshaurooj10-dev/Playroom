import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Star, RefreshCw, Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import { fetchAllFeedback, FeedbackSubmission } from '../../utils/feedbackService';
import { soundManager } from '../../utils/audio';

interface UserFeedbackAdminToolProps {
  onBackToOverview?: () => void;
}

export const UserFeedbackAdminTool: React.FC<UserFeedbackAdminToolProps> = ({
  onBackToOverview,
}) => {
  const [feedbackList, setFeedbackList] = useState<FeedbackSubmission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllFeedback();
      setFeedbackList(data);
    } catch (err) {
      console.warn('Error loading feedback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleRefresh = () => {
    soundManager.playPop();
    loadFeedback();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Bar */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {onBackToOverview && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors cursor-pointer"
              title="Back to Educator Hub"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
          <div className="w-12 h-12 bg-amber-100 border-2 border-amber-300 rounded-2xl flex items-center justify-center text-2xl shrink-0">
            💬
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full mb-1">
              Admin & Educator Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              USER FEEDBACK
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              View real-time parent, teacher, and user feedback submissions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback List Container */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <h2 className="font-black text-sm text-slate-900 uppercase tracking-wide">
              Submissions ({feedbackList.length})
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            Sorted newest first
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-500 font-bold text-xs">
            Loading feedback submissions...
          </div>
        ) : feedbackList.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-black text-sm text-slate-700 uppercase tracking-wide mb-1">
              No feedback received yet.
            </h3>
            <p className="text-xs text-slate-500">
              When users submit ratings or queries from the Feedback card on Page 1, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbackList.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 sm:p-5 bg-slate-50 hover:bg-slate-100/80 border-2 border-slate-200 rounded-2xl transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  {/* Star Rating */}
                  <div className="flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1 rounded-full font-black text-xs">
                    <span className="text-amber-500">⭐</span>
                    <span>{item.rating} / 5</span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                    {item.date_formatted && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.date_formatted}</span>
                      </span>
                    )}
                    {item.time_formatted && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.time_formatted}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Feedback Query Text */}
                {item.feedback ? (
                  <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                    "{item.feedback}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-white p-3 rounded-xl border border-slate-200">
                    (No written comments provided with this rating)
                  </p>
                )}

                {item.user_email && (
                  <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Submitted by: {item.user_email}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
