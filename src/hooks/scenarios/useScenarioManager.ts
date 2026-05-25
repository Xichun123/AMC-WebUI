import { logService } from '@/services/logService';
import { type ChangeEvent, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { type SavedScenario } from '@/types';
import { type translations } from '@/i18n/translations';
import { generateUniqueId } from '@/utils/chat/ids';
import { createManagedObjectUrl } from '@/services/objectUrlManager';
import { triggerDownload, sanitizeFilename } from '@/utils/export/core';
import {
  buildSavedScenarios,
  buildScenarioExportPayload,
  getExportableUserScenarios,
  mergeImportedScenarios,
  SYSTEM_SCENARIO_IDS,
} from '@/features/scenarios/scenarioLibrary';

type ModalView = 'list' | 'editor';

interface UseScenarioManagerProps {
  isOpen: boolean;
  savedScenarios: SavedScenario[];
  onSaveAllScenarios: (scenarios: SavedScenario[]) => void;
  onClose: () => void;
  t: (key: keyof typeof translations, fallback?: string) => string;
}

export const useScenarioManager = ({
  isOpen,
  savedScenarios,
  onSaveAllScenarios,
  onClose,
  t,
}: UseScenarioManagerProps) => {
  const [scenarios, setScenarios] = useState<SavedScenario[]>(savedScenarios);
  const [view, setView] = useState<ModalView>('list');
  const [editingScenario, setEditingScenario] = useState<SavedScenario | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current !== null) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearFeedbackTimeout(), [clearFeedbackTimeout]);

  useEffect(() => {
    if (isOpen) {
      clearFeedbackTimeout();
      setScenarios(savedScenarios);
      setView('list');
      setEditingScenario(null);
      setFeedback(null);
      setSearchQuery('');
    }
  }, [clearFeedbackTimeout, isOpen, savedScenarios]);

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(getExportableUserScenarios(scenarios)) !==
      JSON.stringify(getExportableUserScenarios(savedScenarios)),
    [savedScenarios, scenarios],
  );

  const showFeedback = useCallback(
    (type: 'success' | 'error' | 'info', message: string, duration: number = 3000) => {
      clearFeedbackTimeout();
      setFeedback({ type, message });
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimeoutRef.current = null;
      }, duration);
    },
    [clearFeedbackTimeout],
  );

  const handleStartAddNew = useCallback(() => {
    setEditingScenario({ id: generateUniqueId(), title: '', messages: [] });
    setView('editor');
  }, []);

  const handleStartEdit = useCallback((scenario: SavedScenario) => {
    setEditingScenario(scenario);
    setView('editor');
  }, []);

  const handleDuplicateScenario = useCallback(
    (scenario: SavedScenario) => {
      const newScenario: SavedScenario = {
        ...scenario,
        id: generateUniqueId(),
        title: t('scenarios_copy_title').replace('{title}', scenario.title),
        messages: scenario.messages.map((message) => ({ ...message, id: generateUniqueId() })),
      };

      setScenarios((prev) => buildSavedScenarios([newScenario, ...getExportableUserScenarios(prev)]));
      showFeedback('success', t('scenarios_feedback_duplicated'));
    },
    [showFeedback, t],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingScenario(null);
    setView('list');
  }, []);

  const handleSaveScenario = useCallback(
    (scenarioToSave: SavedScenario) => {
      if (!scenarioToSave.title.trim()) {
        showFeedback('error', t('scenarios_title_required'));
        return;
      }
      setScenarios((prev) => {
        const nextUserScenarios = getExportableUserScenarios(prev);
        const existing = nextUserScenarios.find((scenario) => scenario.id === scenarioToSave.id);
        if (existing) {
          return buildSavedScenarios(
            nextUserScenarios.map((scenario) => (scenario.id === scenarioToSave.id ? scenarioToSave : scenario)),
          );
        }
        return buildSavedScenarios([...nextUserScenarios, scenarioToSave]);
      });
      showFeedback('success', t('scenarios_feedback_saved'));
      setView('list');
      setEditingScenario(null);
    },
    [showFeedback, t],
  );

  const handleDeleteScenario = useCallback(
    (scenarioId: string) => {
      setScenarios((prev) =>
        buildSavedScenarios(getExportableUserScenarios(prev).filter((scenario) => scenario.id !== scenarioId)),
      );
      showFeedback('info', t('scenarios_feedback_cleared'));
    },
    [showFeedback, t],
  );

  const handleSaveAllAndClose = useCallback(() => {
    onSaveAllScenarios(scenarios);
    onClose();
  }, [onSaveAllScenarios, scenarios, onClose]);

  const handleExportScenarios = useCallback(() => {
    const scenariosToExport = getExportableUserScenarios(scenarios);

    if (scenariosToExport.length === 0) {
      showFeedback('info', t('scenarios_feedback_emptyExport'));
      return;
    }

    const exportPayload = buildScenarioExportPayload(scenariosToExport);
    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(createManagedObjectUrl(blob), `scenarios-export-${date}.json`);
    showFeedback('success', t('scenarios_feedback_exported'));
  }, [scenarios, showFeedback, t]);

  const handleExportSingleScenario = useCallback(
    (scenario: SavedScenario) => {
      const exportPayload = {
        type: 'AllModelChat-Scenarios',
        version: 1,
        scenarios: [scenario],
      };
      const safeTitle = sanitizeFilename(scenario.title);
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      triggerDownload(createManagedObjectUrl(blob), `scenario-${safeTitle}.json`);
      showFeedback('success', t('scenarios_feedback_exported'));
    },
    [showFeedback, t],
  );

  const handleImportScenarios = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const data = JSON.parse(text);

          if (data && data.type === 'AllModelChat-Scenarios' && Array.isArray(data.scenarios)) {
            const importedScenarios = data.scenarios as SavedScenario[];
            setScenarios((prev) =>
              buildSavedScenarios(
                mergeImportedScenarios({
                  existingScenarios: prev,
                  importedScenarios,
                  createId: generateUniqueId,
                }),
              ),
            );
            showFeedback('success', t('scenarios_feedback_imported'));
          } else {
            throw new Error('Invalid format');
          }
        } catch (error) {
          logService.error('Import failed', error);
          showFeedback('error', t('scenarios_feedback_importFailed'));
        } finally {
          if (importInputRef.current) importInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    },
    [showFeedback, t],
  );

  return {
    scenarios,
    view,
    editingScenario,
    searchQuery,
    setSearchQuery,
    feedback,
    importInputRef,
    systemScenarioIds: SYSTEM_SCENARIO_IDS,
    hasUnsavedChanges,
    showFeedback,
    actions: {
      handleStartAddNew,
      handleStartEdit,
      handleDuplicateScenario,
      handleCancelEdit,
      handleSaveScenario,
      handleDeleteScenario,
      handleSaveAllAndClose,
      handleExportScenarios,
      handleExportSingleScenario,
      handleImportScenarios,
    },
  };
};
