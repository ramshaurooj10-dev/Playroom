import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { soundManager } from '../../utils/audio';
import { submitFeedback } from '../../utils/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleClose = () => {
    soundManager.playPop();
    setIsSubmitted(false);
    setFeedbackText('');
    setRating(5);
    setErrorMessage('');
    onClose();
  };

  const handleRatingSelect = (selectedStar: number) => {
    soundManager.playPop();
    setRating(selectedStar);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (rating < 1 || rating > 5) {
      setErrorMessage('Please select a star rating (1–5).');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({
        rating,
        feedback: feedbackText,
        userEmail,
      });

      soundManager.playSuccess();
      soundManager.speak('Thank you for your feedback!');
      setIsSubmitted(true);
    } catch (err) {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white border-4 border-amber-300 rounded-3xl shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 p-5 text-amber-950 flex items-center justify-between border-b-2 border-amber-300">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/40 rounded-2xl flex items-center justify-center text-2xl border border-white/50 shadow-inner shrink-0">
                💬
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  FEEDBACK
                </h2>
                <p className="text-xs text-amber-900 font-bold">
                  Help us improve Playroom
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="bg-white/30 hover:bg-white/50 text-amber-950 rounded-full p-2 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Form / Content */}
          <div className="p-6">
            {isSubmitted ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 border-2 border-emerald-300 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-xl text-slate-900 uppercase tracking-wide mb-1">
                  Thank you for your feedback!
                </h3>
                <p className="text-xs text-slate-600 font-medium mb-6">
                  Your response has been saved and shared with our team.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 1. Rate Playroom (1-5 stars) */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-center">
                  <label className="block font-black text-xs uppercase tracking-wider text-amber-950 mb-2">
                    ⭐ RATE PLAYROOM
                  </label>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {[1, 2, 3, 4, 5].map((starNum) => {
                      const isFilled = (hoverRating !== null ? hoverRating : rating) >= starNum;
                      return (
                        <button
                          key={starNum}
                          type="button"
                          onClick={() => handleRatingSelect(starNum)}
                          onMouseEnter={() => setHoverRating(starNum)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1.5 transform hover:scale-115 transition-transform cursor-pointer focus:outline-hidden"
                          title={`${starNum} / 5 Stars`}
                        >
                          <Star
                            className={`w-8 h-8 ${
                              isFilled
                                ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                                : 'fill-slate-100 text-slate-300'
                            } transition-colors`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="font-black text-xs text-amber-900">
                    {rating} / 5 Stars
                  </div>
                </div>

                {/* 2. Your Feedback / Query */}
                <div>
                  <label className="block font-black text-xs uppercase tracking-wide text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                    <span>YOUR FEEDBACK / QUERY</span>
                  </label>
                  <textarea
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Tell us what you think or ask us a question..."
                    className="w-full p-3.5 text-xs text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-amber-400 focus:bg-white focus:outline-hidden transition-all placeholder:text-slate-400 font-medium resize-none"
                  />
                </div>

                {errorMessage && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {errorMessage}
                  </p>
                )}

                {/* 3. Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider py-3 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'SUBMIT FEEDBACK'}</span>
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
