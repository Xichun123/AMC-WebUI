import type React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface OpenAICompatibleModelFetchResultProps {
  status: 'idle' | 'success' | 'error';
  message?: string | null;
}

export const OpenAICompatibleModelFetchResult: React.FC<OpenAICompatibleModelFetchResultProps> = ({
  status,
  message,
}) => {
  if (status === 'idle' || !message) {
    return null;
  }

  const resultClass =
    status === 'success'
      ? 'border-green-500/20 bg-green-500/10 text-green-600'
      : 'border-red-500/20 bg-red-500/10 text-red-600';

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-2 text-xs animate-in fade-in slide-in-from-top-1 ${resultClass}`}
    >
      {status === 'success' ? (
        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle size={14} className="mt-0.5 flex-shrink-0" />
      )}
      <span className="break-all">{message}</span>
    </div>
  );
};
