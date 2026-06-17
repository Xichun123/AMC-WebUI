import React from 'react';
import { ImageIcon, FileCode2, FileText, FileJson } from 'lucide-react';
import { type ExportType } from './useMessageExport';
import { useResponsiveValue } from '@/hooks/useDevice';
import { useI18n } from '@/contexts/I18nContext';

interface ExportOptionsProps {
  onExport: (type: ExportType) => void;
  variant?: 'message' | 'chat';
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({ onExport, variant = 'message' }) => {
  const { t } = useI18n();
  const buttonIconSize = useResponsiveValue(24, 28);

  const descriptions = {
    message: {
      png: t('exportOptionMessagePngDesc'),
      html: t('exportOptionMessageHtmlDesc'),
      txt: t('exportOptionMessageTxtDesc'),
      json: t('exportOptionMessageJsonDesc'),
    },
    chat: {
      png: t('exportOptionChatPngDesc'),
      html: t('exportOptionChatHtmlDesc'),
      txt: t('exportOptionChatTxtDesc'),
      json: t('exportOptionChatJsonDesc'),
    },
  };

  const currentDesc = descriptions[variant];

  const options = [
    {
      id: 'png' as const,
      icon: ImageIcon,
      label: t('exportOptionPngLabel'),
      desc: currentDesc.png,
      colorClass: 'text-[var(--theme-text-link)]',
    },
    {
      id: 'html' as const,
      icon: FileCode2,
      label: t('exportOptionHtmlLabel'),
      desc: currentDesc.html,
      colorClass: 'text-green-500',
    },
    {
      id: 'txt' as const,
      icon: FileText,
      label: t('exportOptionTxtLabel'),
      desc: currentDesc.txt,
      colorClass: 'text-blue-500',
    },
    {
      id: 'json' as const,
      icon: FileJson,
      label: t('exportOptionJsonLabel'),
      desc: currentDesc.json,
      colorClass: 'text-orange-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {options.map((exportOption) => {
        const ExportIcon = exportOption.icon;

        return (
          <button
            key={exportOption.id}
            onClick={() => onExport(exportOption.id)}
            className={`
                        flex flex-col items-center justify-center gap-3 p-6 
                        bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] 
                        rounded-lg border border-[var(--theme-border-secondary)] 
                        transition-all duration-200 
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--theme-bg-primary)] focus:ring-[var(--theme-border-focus)] 
                        transform hover:-translate-y-1 hover:shadow-lg
                    `}
          >
            <ExportIcon size={buttonIconSize} className={exportOption.colorClass} strokeWidth={1.5} />
            <span className="font-semibold text-base text-[var(--theme-text-primary)]">{exportOption.label}</span>
            <span className="text-xs text-center text-[var(--theme-text-tertiary)]">{exportOption.desc}</span>
          </button>
        );
      })}
    </div>
  );
};
