import React, { useState, useEffect } from 'react';
import { analyzeFeedback } from '../services/geminiService';
import Spinner from './Spinner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'suggestion';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Reset state when modal is opened or closed
    if (!isOpen) {
      setTimeout(() => {
        setFeedbackText('');
        setFeedbackType('bug');
        setIsSubmitting(false);
        setError(null);
        setSuccess(false);
      }, 300); // Wait for closing animation
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!feedbackText.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await analyzeFeedback(feedbackText, feedbackType);
      console.log('Feedback Analysis Result:', result); // For demonstration
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000); // Close modal after 2 seconds on success
    } catch (err: any) {
      setError(err.message || 'Không thể gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
        <style>{`
          @keyframes fade-in-scale {
            0% { scale: 0.95; opacity: 0; }
            100% { scale: 1; opacity: 1; }
          }
          .animate-fade-in-scale {
            animation: fade-in-scale 0.2s ease-out forwards;
          }
        `}</style>
        <div className="flex justify-between items-center p-4 border-b dark:border-border flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-foreground">Gửi Phản Hồi</h3>
          <button onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50 text-2xl font-bold leading-none" aria-label="Đóng">&times;</button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center justify-center text-center flex-grow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-foreground">Cảm ơn bạn đã gửi phản hồi!</h4>
            <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">Chúng tôi sẽ xem xét và cải thiện sản phẩm.</p>
          </div>
        ) : (
          <>
            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-muted-foreground">Loại phản hồi</label>
                <div className="mt-2 flex gap-4">
                  <div className="flex items-center">
                    <input id="feedback-bug" name="feedback-type" type="radio" checked={feedbackType === 'bug'} onChange={() => setFeedbackType('bug')} className="h-4 w-4 text-primary border-gray-300 focus:ring-primary" />
                    <label htmlFor="feedback-bug" className="ml-2 block text-sm text-gray-900 dark:text-foreground">Báo cáo lỗi</label>
                  </div>
                  <div className="flex items-center">
                    <input id="feedback-suggestion" name="feedback-type" type="radio" checked={feedbackType === 'suggestion'} onChange={() => setFeedbackType('suggestion')} className="h-4 w-4 text-primary border-gray-300 focus:ring-primary" />
                    <label htmlFor="feedback-suggestion" className="ml-2 block text-sm text-gray-900 dark:text-foreground">Đề xuất tính năng</label>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="feedback-text" className="text-sm font-medium text-gray-700 dark:text-muted-foreground">Nội dung</label>
                <textarea
                  id="feedback-text"
                  rows={6}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-slate-50 dark:bg-input"
                  placeholder="Vui lòng mô tả vấn đề bạn gặp phải hoặc đề xuất cải tiến của bạn..."
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="p-4 border-t dark:border-border flex-shrink-0 flex justify-end items-center gap-4">
              <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-secondary dark:text-secondary-foreground font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-secondary/80 disabled:opacity-50 transition-colors">
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !feedbackText.trim()}
                className="flex items-center justify-center min-w-[100px] px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-accent-hover disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? <Spinner /> : 'Gửi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;