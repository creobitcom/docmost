/**
 * Утилиты для диагностики проблем с монтированием редакторов
 */

export interface EditorDiagnostics {
  blockId: string;
  hasRef: boolean;
  hasCurrent: boolean;
  hasEditor: boolean;
  hasProvider: boolean;
  editorReady: boolean;
  providerStatus?: string;
  isReady: boolean;
  mountTime?: number;
  refSetTime?: number;
}

export interface PageEditorDiagnostics {
  blocksCount: number;
  blockRefsCount: number;
  blockIds: string[];
  blockRefsKeys: string[];
  isReady: boolean;
  readinessStatus: EditorDiagnostics[];
  missingRefs: string[];
  notReadyBlocks: string[];
}

/**
 * Собирает диагностическую информацию о состоянии редакторов
 */
export function collectEditorDiagnostics(
  blocks: any[],
  blockRefs: Map<string, any>,
  isReady: boolean
): PageEditorDiagnostics {
  const blockIds = blocks.map(b => b.id);
  const blockRefsKeys = Array.from(blockRefs.keys());
  const missingRefs = blockIds.filter(id => !blockRefs.has(id));
  
  const readinessStatus: EditorDiagnostics[] = blocks.map(block => {
    const ref = blockRefs.get(block.id);
    const isReady = ref?.editor && ref?.provider;
    
    return {
      blockId: block.id,
      hasRef: !!ref,
      hasCurrent: !!ref?.current,
      hasEditor: !!ref?.editor,
      hasProvider: !!ref?.provider,
      editorReady: ref?.editor?.isEditable,
      providerStatus: ref?.provider?.status,
      isReady
    };
  });
  
  const notReadyBlocks = readinessStatus
    .filter(status => !status.isReady)
    .map(status => status.blockId);
  
  return {
    blocksCount: blocks.length,
    blockRefsCount: blockRefs.size,
    blockIds,
    blockRefsKeys,
    isReady,
    readinessStatus,
    missingRefs,
    notReadyBlocks
  };
}

/**
 * Логирует диагностическую информацию в консоль
 */
export function logEditorDiagnostics(diagnostics: PageEditorDiagnostics): void {
  console.group('🔍 EDITOR DIAGNOSTICS');
  
  console.log('📊 Общая статистика:', {
    blocksCount: diagnostics.blocksCount,
    blockRefsCount: diagnostics.blockRefsCount,
    isReady: diagnostics.isReady,
    missingRefsCount: diagnostics.missingRefs.length,
    notReadyBlocksCount: diagnostics.notReadyBlocks.length
  });
  
  if (diagnostics.missingRefs.length > 0) {
    console.warn('❌ Отсутствующие рефы:', diagnostics.missingRefs);
  }
  
  if (diagnostics.notReadyBlocks.length > 0) {
    console.warn('⏳ Неготовые блоки:', diagnostics.notReadyBlocks);
  }
  
  console.log('📋 Детальная информация по блокам:');
  diagnostics.readinessStatus.forEach(status => {
    const statusIcon = status.isReady ? '✅' : '❌';
    console.log(`${statusIcon} ${status.blockId}:`, {
      hasRef: status.hasRef,
      hasCurrent: status.hasCurrent,
      hasEditor: status.hasEditor,
      hasProvider: status.hasProvider,
      editorReady: status.editorReady,
      providerStatus: status.providerStatus,
      isReady: status.isReady
    });
  });
  
  console.groupEnd();
}

/**
 * Проверяет, готовы ли все редакторы для DnD операций
 */
export function areAllEditorsReady(diagnostics: PageEditorDiagnostics): boolean {
  return diagnostics.blocksCount > 0 && 
         diagnostics.blocksCount === diagnostics.blockRefsCount &&
         diagnostics.notReadyBlocks.length === 0;
}

/**
 * Возвращает рекомендации по исправлению проблем
 */
export function getDiagnosticRecommendations(diagnostics: PageEditorDiagnostics): string[] {
  const recommendations: string[] = [];
  
  if (diagnostics.missingRefs.length > 0) {
    recommendations.push(`Добавить рефы для блоков: ${diagnostics.missingRefs.join(', ')}`);
  }
  
  if (diagnostics.notReadyBlocks.length > 0) {
    recommendations.push(`Дождаться готовности редакторов для блоков: ${diagnostics.notReadyBlocks.join(', ')}`);
  }
  
  if (diagnostics.blocksCount === 0) {
    recommendations.push('Проверить загрузку данных блоков');
  }
  
  if (diagnostics.blockRefsCount === 0) {
    recommendations.push('Проверить инициализацию blockRefs');
  }
  
  return recommendations;
}

/**
 * Создает детальный отчет о проблемах
 */
export function createDiagnosticReport(diagnostics: PageEditorDiagnostics): string {
  const recommendations = getDiagnosticRecommendations(diagnostics);
  
  let report = '🔍 ОТЧЕТ ДИАГНОСТИКИ РЕДАКТОРОВ\n\n';
  
  report += `📊 Статистика:\n`;
  report += `- Блоков: ${diagnostics.blocksCount}\n`;
  report += `- Рефов: ${diagnostics.blockRefsCount}\n`;
  report += `- Готовность: ${diagnostics.isReady ? '✅' : '❌'}\n`;
  report += `- Отсутствующие рефы: ${diagnostics.missingRefs.length}\n`;
  report += `- Неготовые блоки: ${diagnostics.notReadyBlocks.length}\n\n`;
  
  if (diagnostics.missingRefs.length > 0) {
    report += `❌ Отсутствующие рефы:\n${diagnostics.missingRefs.map(id => `- ${id}`).join('\n')}\n\n`;
  }
  
  if (diagnostics.notReadyBlocks.length > 0) {
    report += `⏳ Неготовые блоки:\n${diagnostics.notReadyBlocks.map(id => `- ${id}`).join('\n')}\n\n`;
  }
  
  if (recommendations.length > 0) {
    report += `💡 Рекомендации:\n${recommendations.map(rec => `- ${rec}`).join('\n')}\n`;
  }
  
  return report;
}

/**
 * Хук для автоматической диагностики редакторов
 */
export function useEditorDiagnostics(
  blocks: any[],
  blockRefs: Map<string, any>,
  isReady: boolean,
  logToConsole: boolean = true
) {
  const diagnostics = collectEditorDiagnostics(blocks, blockRefs, isReady);
  
  if (logToConsole) {
    logEditorDiagnostics(diagnostics);
  }
  
  return {
    diagnostics,
    areReady: areAllEditorsReady(diagnostics),
    recommendations: getDiagnosticRecommendations(diagnostics),
    report: createDiagnosticReport(diagnostics)
  };
}

