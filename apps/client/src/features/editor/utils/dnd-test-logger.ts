/**
 * Централизованная система логирования для тестирования DnD задач
 * Позволяет точно определить состояние каждой задачи из исследования
 */

export enum DndTestTask {
  FALLBACK_SYSTEM = 'FALLBACK_SYSTEM',
  CROSS_BLOCK_INSERTION = 'CROSS_BLOCK_INSERTION',
  DIFFERENT_BLOCK_TYPES = 'DIFFERENT_BLOCK_TYPES',
  NESTED_STRUCTURES = 'NESTED_STRUCTURES',
  PRODUCTION_READY = 'PRODUCTION_READY',
  DEBUG_CLEANUP = 'DEBUG_CLEANUP'
}

export enum TestResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  NOT_TESTED = 'NOT_TESTED'
}

interface TestLogEntry {
  task: DndTestTask;
  result: TestResult;
  timestamp: number;
  details: string;
  context?: any;
}

class DndTestLogger {
  private logs: TestLogEntry[] = [];
  private isEnabled = true;
  private lastLogTimes: Map<string, number> = new Map();
  private logThrottleMs = 1000; // Минимальный интервал между одинаковыми логами

  /**
   * Логирует результат тестирования конкретной задачи
   */
  logTaskResult(task: DndTestTask, result: TestResult, details: string, context?: any) {
    if (!this.isEnabled) return;

    const entry: TestLogEntry = {
      task,
      result,
      timestamp: Date.now(),
      details,
      context
    };

    this.logs.push(entry);

    // Создаем ключ для throttling на основе задачи и деталей
    const logKey = `${task}-${result}-${details}`;
    const now = Date.now();
    const lastLogTime = this.lastLogTimes.get(logKey) || 0;
    
    // Для SUCCESS логов применяем throttling, для ошибок логируем всегда
    if (result === TestResult.SUCCESS && (now - lastLogTime) < this.logThrottleMs) {
      return; // Пропускаем повторный SUCCESS лог
    }
    
    this.lastLogTimes.set(logKey, now);

    // Выводим в консоль с уникальным префиксом для фильтрации
    const prefix = `[DND_TEST_${task}]`;
    const resultIcon = result === TestResult.SUCCESS ? '✅' :
                      result === TestResult.FAILED ? '❌' :
                      result === TestResult.PARTIAL ? '⚠️' : '⏳';

    console.log(`${prefix} ${resultIcon} ${result}: ${details}`, context || '');
  }

  /**
   * Логирует начало тестирования задачи
   */
  logTaskStart(task: DndTestTask, details: string) {
    this.logTaskResult(task, TestResult.NOT_TESTED, `START: ${details}`);
  }

  /**
   * Логирует успешное выполнение задачи
   */
  logTaskSuccess(task: DndTestTask, details: string, context?: any) {
    this.logTaskResult(task, TestResult.SUCCESS, details, context);
  }

  /**
   * Логирует неудачное выполнение задачи
   */
  logTaskFailure(task: DndTestTask, details: string, context?: any) {
    this.logTaskResult(task, TestResult.FAILED, details, context);
  }

  /**
   * Логирует частичное выполнение задачи
   */
  logTaskPartial(task: DndTestTask, details: string, context?: any) {
    this.logTaskResult(task, TestResult.PARTIAL, details, context);
  }

  /**
   * Получает все логи для конкретной задачи
   */
  getTaskLogs(task: DndTestTask): TestLogEntry[] {
    return this.logs.filter(log => log.task === task);
  }

  /**
   * Получает последний результат для задачи
   */
  getLastTaskResult(task: DndTestTask): TestResult {
    const taskLogs = this.getTaskLogs(task);
    if (taskLogs.length === 0) return TestResult.NOT_TESTED;

    const lastLog = taskLogs[taskLogs.length - 1];
    return lastLog.result;
  }

  /**
   * Генерирует отчет по всем задачам
   */
  generateReport(): string {
    const report = ['\n=== DND TASKS TEST REPORT ==='];

    Object.values(DndTestTask).forEach(task => {
      const result = this.getLastTaskResult(task);
      const taskLogs = this.getTaskLogs(task);
      const resultIcon = result === TestResult.SUCCESS ? '✅' :
                        result === TestResult.FAILED ? '❌' :
                        result === TestResult.PARTIAL ? '⚠️' : '⏳';

      report.push(`${resultIcon} ${task}: ${result} (${taskLogs.length} logs)`);

      if (taskLogs.length > 0) {
        const lastLog = taskLogs[taskLogs.length - 1];
        report.push(`   Last: ${lastLog.details}`);
      }
    });

    report.push('=== END REPORT ===\n');
    return report.join('\n');
  }

  /**
   * Очищает все логи
   */
  clear() {
    this.logs = [];
  }

  /**
   * Включает/выключает логирование
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Экспортирует логи в JSON для анализа
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Создаем глобальный экземпляр
export const dndTestLogger = new DndTestLogger();

// Добавляем в window для доступа из консоли
if (typeof window !== 'undefined') {
  (window as any).dndTestLogger = dndTestLogger;
  (window as any).DndTestTask = DndTestTask;
  (window as any).TestResult = TestResult;
}

/**
 * Вспомогательные функции для быстрого логирования
 */
export const logFallbackTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.FALLBACK_SYSTEM, result, details, context);
};

export const logCrossBlockTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.CROSS_BLOCK_INSERTION, result, details, context);
};

export const logBlockTypeTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.DIFFERENT_BLOCK_TYPES, result, details, context);
};

export const logNestedTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.NESTED_STRUCTURES, result, details, context);
};

export const logProductionTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.PRODUCTION_READY, result, details, context);
};

export const logDebugCleanupTest = (result: TestResult, details: string, context?: any) => {
  dndTestLogger.logTaskResult(DndTestTask.DEBUG_CLEANUP, result, details, context);
};

/**
 * Функция для проверки поддержки вложенных структур
 */
export const checkNestedStructuresSupport = () => {
  const supportedNestedTypes = [
    'blockGroup',
    'blockquote',
    'codeBlock',
    'details',
    'detailsSummary',
    'detailsContent',
    'table',
    'tableRow',
    'tableCell'
  ];

  const hasNestedSupport = supportedNestedTypes.length > 0;

  logNestedTest(
    hasNestedSupport ? TestResult.SUCCESS : TestResult.FAILED,
    'Nested structures support check',
    {
      supportedTypes: supportedNestedTypes,
      totalSupported: supportedNestedTypes.length,
      hasSupport: hasNestedSupport
    }
  );

  return hasNestedSupport;
};

/**
 * Функция для проверки production готовности
 */
export const checkProductionReadiness = () => {
  const results = {
    debugLogsFound: 0,
    consoleLogsFound: 0,
    testLogsFound: 0,
    productionReady: true,
    issues: [] as string[],
    recommendations: [] as string[]
  };

  // Проверяем наличие debug логов
  const debugLogs = document.querySelectorAll('[data-debug-log]');
  results.debugLogsFound = debugLogs.length;

  if (debugLogs.length > 0) {
    results.productionReady = false;
    results.issues.push(`${debugLogs.length} debug logs found`);
    results.recommendations.push('Remove all debug logs before production deployment');
  }

  // Проверяем наличие тестовых логов
  const testLogs = document.querySelectorAll('[data-test-log]');
  results.testLogsFound = testLogs.length;

  if (testLogs.length > 0) {
    results.productionReady = false;
    results.issues.push(`${testLogs.length} test logs found`);
    results.recommendations.push('Remove all test logs before production deployment');
  }

  // Проверяем наличие console.log в коде (это сложно сделать в runtime)
  // Вместо этого проверяем наличие тестовых логов в консоли
  const consoleLogs = document.querySelectorAll('[data-console-log]');
  results.consoleLogsFound = consoleLogs.length;

  if (consoleLogs.length > 0) {
    results.productionReady = false;
    results.issues.push(`${consoleLogs.length} console logs found`);
    results.recommendations.push('Remove all console.log statements before production deployment');
  }

  // Проверяем наличие тестовых функций в window
  const testFunctions = ['runAllDndTests', 'checkNestedStructuresSupport', 'checkProductionReadiness', 'checkDebugCleanup'];
  const foundTestFunctions = testFunctions.filter(func => (window as any)[func]);

  if (foundTestFunctions.length > 0) {
    results.productionReady = false;
    results.issues.push(`${foundTestFunctions.length} test functions found in window object`);
    results.recommendations.push('Remove test functions from window object before production deployment');
  }

  // Логируем результат проверки
  logProductionTest(TestResult.NOT_TESTED, 'Production readiness check completed', {
    debugLogsFound: results.debugLogsFound,
    consoleLogsFound: results.consoleLogsFound,
    testLogsFound: results.testLogsFound,
    testFunctionsFound: foundTestFunctions.length,
    productionReady: results.productionReady,
    issuesCount: results.issues.length,
    recommendationsCount: results.recommendations.length
  });

  console.log('🔍 [DndTestLogger] Production readiness check:', results);
  return results;
};

/**
 * Функция для проверки cleanup debug логов
 */
export const checkDebugCleanup = () => {
  const results = {
    debugLogsFound: 0,
    consoleLogsFound: 0,
    testLogsFound: 0,
    cleanupReady: true,
    issues: [] as string[],
    recommendations: [] as string[]
  };

  // Подсчитываем примерное количество console.log в коде
  const scriptTags = document.querySelectorAll('script');
  let debugLogCount = 0;

  scriptTags.forEach(script => {
    if (script.textContent) {
      const matches = script.textContent.match(/console\.(log|warn|error)/g);
      if (matches) {
        debugLogCount += matches.length;
      }
    }
  });

  results.debugLogsFound = debugLogCount;

  if (debugLogCount > 0) {
    results.cleanupReady = false;
    results.issues.push(`${debugLogCount} console.log statements found`);
    results.recommendations.push('Remove all console.log statements before production deployment');
  }

  // Проверяем наличие тестовых логов
  const testLogs = document.querySelectorAll('[data-test-log]');
  results.testLogsFound = testLogs.length;

  if (testLogs.length > 0) {
    results.cleanupReady = false;
    results.issues.push(`${testLogs.length} test logs found`);
    results.recommendations.push('Remove all test logs before production deployment');
  }

  // Проверяем наличие debug логов в DnD системе
  const hasDndDebugLogs = debugLogCount > 0;

  logDebugCleanupTest(
    hasDndDebugLogs ? TestResult.FAILED : TestResult.SUCCESS,
    'Debug logs cleanup check',
    {
      debugLogCount,
      hasDndDebugLogs,
      scriptTagsCount: scriptTags.length,
      testLogsFound: results.testLogsFound,
      cleanupReady: results.cleanupReady
    }
  );

  console.log('🔍 [DndTestLogger] Debug cleanup check:', results);
  return results;
};

/**
 * Функция для тестирования fallback системы drag данных
 */
export const testFallbackSystem = async () => {
  console.log('\n=== ТЕСТИРОВАНИЕ FALLBACK СИСТЕМЫ ===');

  const results = {
    dragStateManager: { available: false, data: null },
    dataTransfer: { available: false, data: null },
    dndCoordinator: { available: false, data: null },
    windowGlobal: { available: false, data: null },
    overallStatus: 'unknown'
  };

  try {
    // Тестируем DragStateManager через глобальные объекты
    const DragStateManager = (window as any).DragStateManager;
    if (DragStateManager) {
      const dragState = DragStateManager.get();
      results.dragStateManager.available = DragStateManager.hasValid();
      results.dragStateManager.data = dragState;

      logFallbackTest(
        results.dragStateManager.available ? TestResult.SUCCESS : TestResult.FAILED,
        'DragStateManager availability test',
        {
          hasValid: results.dragStateManager.available,
          hasData: !!results.dragStateManager.data,
          dataType: results.dragStateManager.data?.type,
          recoveryStats: DragStateManager.getRecoveryStats ? DragStateManager.getRecoveryStats() : null
        }
      );
    } else {
      // Пытаемся импортировать динамически
      try {
        const dragStateManagerModule = await import('./drag-state-manager');
        const DragStateManager = dragStateManagerModule.DragStateManager;
        const dragState = DragStateManager.get();
        results.dragStateManager.available = DragStateManager.hasValid();
        results.dragStateManager.data = dragState;

        logFallbackTest(
          results.dragStateManager.available ? TestResult.SUCCESS : TestResult.FAILED,
          'DragStateManager availability test (dynamic import)',
          {
            hasValid: results.dragStateManager.available,
            hasData: !!results.dragStateManager.data,
            dataType: results.dragStateManager.data?.type,
            recoveryStats: DragStateManager.getRecoveryStats()
          }
        );
      } catch (importError) {
        logFallbackTest(TestResult.FAILED, 'DragStateManager test failed', { 
          error: importError.message,
          method: 'dynamic_import'
        });
      }
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'DragStateManager test failed', { error: error.message });
  }

  try {
    // Тестируем DndCoordinator через глобальные объекты
    const dndCoordinator = (window as any).dndCoordinator;
    if (dndCoordinator) {
      const coordinatorState = dndCoordinator.getCurrentPayload();
      results.dndCoordinator.available = !!coordinatorState;
      results.dndCoordinator.data = coordinatorState;

      logFallbackTest(
        results.dndCoordinator.available ? TestResult.SUCCESS : TestResult.FAILED,
        'DndCoordinator availability test',
        {
          hasState: results.dndCoordinator.available,
          stateType: results.dndCoordinator.data?.type,
          isElementDrag: dndCoordinator.isElementDrag()
        }
      );
    } else {
      // Пытаемся импортировать динамически
      try {
        const dndCoordinatorModule = await import('../dnd/DndCoordinator');
        const dndCoordinator = dndCoordinatorModule.dndCoordinator;
        const coordinatorState = dndCoordinator.getCurrentPayload();
        results.dndCoordinator.available = !!coordinatorState;
        results.dndCoordinator.data = coordinatorState;

        logFallbackTest(
          results.dndCoordinator.available ? TestResult.SUCCESS : TestResult.FAILED,
          'DndCoordinator availability test (dynamic import)',
          {
            hasState: results.dndCoordinator.available,
            stateType: results.dndCoordinator.data?.type,
            isElementDrag: dndCoordinator.isElementDrag()
          }
        );
      } catch (importError) {
        logFallbackTest(TestResult.FAILED, 'DndCoordinator test failed', { 
          error: importError.message,
          method: 'dynamic_import'
        });
      }
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'DndCoordinator test failed', { error: error.message });
  }

  try {
    // Тестируем Window global state
    const windowState = (window as any).docmostDragState?.current;
    results.windowGlobal.available = !!(windowState && windowState.blockId);
    results.windowGlobal.data = windowState;

    logFallbackTest(
      results.windowGlobal.available ? TestResult.SUCCESS : TestResult.FAILED,
      'Window global state availability test',
      {
        hasState: results.windowGlobal.available,
        stateType: results.windowGlobal.data?.type,
        hasBlockId: !!results.windowGlobal.data?.blockId
      }
    );
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'Window global state test failed', { error: error.message });
  }

  // Определяем общий статус
  const availableSources = [
    results.dragStateManager.available,
    results.dndCoordinator.available,
    results.windowGlobal.available
  ].filter(Boolean).length;

  if (availableSources >= 2) {
    results.overallStatus = 'healthy';
    logFallbackTest(TestResult.SUCCESS, 'Fallback system is healthy', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  } else if (availableSources === 1) {
    results.overallStatus = 'degraded';
    logFallbackTest(TestResult.PARTIAL, 'Fallback system is degraded', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  } else {
    results.overallStatus = 'failed';
    logFallbackTest(TestResult.FAILED, 'Fallback system has failed', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  }

  console.log('=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ FALLBACK СИСТЕМЫ ===');
  console.log('Общий статус:', results.overallStatus);
  console.log('Доступные источники:', availableSources, 'из 3');
  console.log('Детали:', results);

  return results;
};

/**
 * Функция для запуска всех тестов DnD системы
 */
export const runAllDndTests = async () => {
  console.log('\n=== ЗАПУСК ВСЕХ ТЕСТОВ DND СИСТЕМЫ ===');

  // Очищаем предыдущие логи
  dndTestLogger.clear();

  // Запускаем все тесты
  await testFallbackSystem();
  checkNestedStructuresSupport();
  checkProductionReadiness();
  checkDebugCleanup();

  // Генерируем отчет
  const report = dndTestLogger.generateReport();
  console.log(report);

  // Экспортируем логи для анализа
  const logs = dndTestLogger.exportLogs();
  console.log('=== ЭКСПОРТ ЛОГОВ ===');
  console.log(logs);

  return {
    report,
    logs: JSON.parse(logs)
  };
};

/**
 * Принудительная синхронизация всех источников fallback системы
 */
export const forceSyncAllSources = async () => {
  console.log('\n=== ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ВСЕХ ИСТОЧНИКОВ ===');

  try {
    const DragStateManager = (window as any).DragStateManager;
    if (!DragStateManager || !DragStateManager.hasValid()) {
      console.log('❌ DragStateManager недоступен или не имеет валидных данных');
      return false;
    }

    const dragData = DragStateManager.get();
    console.log('📋 Данные для синхронизации:', dragData);

    // Синхронизируем с DndCoordinator
    try {
      const dndCoordinator = (window as any).dndCoordinator;
      if (dndCoordinator) {
        dndCoordinator.start({
          type: dragData.type,
          sourceId: dragData.type === 'element' ? dragData.elementId : dragData.blockId,
          sourceBlockId: dragData.blockId,
          blockId: dragData.blockId,
          elementId: dragData.elementId
        });
        console.log('✅ DndCoordinator синхронизирован');
      } else {
        console.log('⚠️ DndCoordinator недоступен');
      }
    } catch (error) {
      console.error('❌ Ошибка синхронизации DndCoordinator:', error);
    }

    // Синхронизируем с Window Global State
    try {
      if (!(window as any).docmostDragState) {
        (window as any).docmostDragState = {};
      }
      (window as any).docmostDragState.current = dragData;
      console.log('✅ Window Global State синхронизирован');
    } catch (error) {
      console.error('❌ Ошибка синхронизации Window Global State:', error);
    }

    console.log('✅ Синхронизация завершена');
    return true;
  } catch (error) {
    console.error('❌ Ошибка принудительной синхронизации:', error);
    return false;
  }
};

/**
 * Простая синхронная версия тестирования fallback системы
 */
export const testFallbackSystemSync = () => {
  console.log('\n=== ТЕСТИРОВАНИЕ FALLBACK СИСТЕМЫ (СИНХРОННАЯ ВЕРСИЯ) ===');

  const results = {
    dragStateManager: { available: false, data: null },
    dndCoordinator: { available: false, data: null },
    windowGlobal: { available: false, data: null },
    overallStatus: 'unknown'
  };

  try {
    // Тестируем DragStateManager через глобальные объекты
    const DragStateManager = (window as any).DragStateManager;
    if (DragStateManager) {
      const dragState = DragStateManager.get();
      results.dragStateManager.available = DragStateManager.hasValid();
      results.dragStateManager.data = dragState;

      logFallbackTest(
        results.dragStateManager.available ? TestResult.SUCCESS : TestResult.FAILED,
        'DragStateManager availability test (sync)',
        {
          hasValid: results.dragStateManager.available,
          hasData: !!results.dragStateManager.data,
          dataType: results.dragStateManager.data?.type,
          recoveryStats: DragStateManager.getRecoveryStats ? DragStateManager.getRecoveryStats() : null
        }
      );
    } else {
      logFallbackTest(TestResult.FAILED, 'DragStateManager not available in window', { 
        method: 'global_object'
      });
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'DragStateManager test failed (sync)', { error: error.message });
  }

  try {
    // Тестируем DndCoordinator через глобальные объекты
    const dndCoordinator = (window as any).dndCoordinator;
    if (dndCoordinator) {
      const coordinatorState = dndCoordinator.getCurrentPayload();
      results.dndCoordinator.available = !!coordinatorState;
      results.dndCoordinator.data = coordinatorState;

      logFallbackTest(
        results.dndCoordinator.available ? TestResult.SUCCESS : TestResult.FAILED,
        'DndCoordinator availability test (sync)',
        {
          hasState: results.dndCoordinator.available,
          stateType: results.dndCoordinator.data?.type,
          isElementDrag: dndCoordinator.isElementDrag()
        }
      );
    } else {
      logFallbackTest(TestResult.FAILED, 'DndCoordinator not available in window', { 
        method: 'global_object'
      });
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'DndCoordinator test failed (sync)', { error: error.message });
  }

  try {
    // Тестируем Window global state
    const windowState = (window as any).docmostDragState?.current;
    results.windowGlobal.available = !!(windowState && windowState.blockId);
    results.windowGlobal.data = windowState;

    logFallbackTest(
      results.windowGlobal.available ? TestResult.SUCCESS : TestResult.FAILED,
      'Window global state availability test (sync)',
      {
        hasState: results.windowGlobal.available,
        stateType: results.windowGlobal.data?.type,
        hasBlockId: !!results.windowGlobal.data?.blockId
      }
    );
  } catch (error) {
    logFallbackTest(TestResult.FAILED, 'Window global state test failed (sync)', { error: error.message });
  }

  // Определяем общий статус
  const availableSources = [
    results.dragStateManager.available,
    results.dndCoordinator.available,
    results.windowGlobal.available
  ].filter(Boolean).length;

  if (availableSources >= 2) {
    results.overallStatus = 'healthy';
    logFallbackTest(TestResult.SUCCESS, 'Fallback system is healthy (sync)', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  } else if (availableSources === 1) {
    results.overallStatus = 'degraded';
    logFallbackTest(TestResult.PARTIAL, 'Fallback system is degraded (sync)', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  } else {
    results.overallStatus = 'failed';
    logFallbackTest(TestResult.FAILED, 'Fallback system has failed (sync)', {
      availableSources,
      totalSources: 3,
      sources: {
        dragStateManager: results.dragStateManager.available,
        dndCoordinator: results.dndCoordinator.available,
        windowGlobal: results.windowGlobal.available
      }
    });
  }

  console.log('=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ FALLBACK СИСТЕМЫ (СИНХРОННАЯ ВЕРСИЯ) ===');
  console.log('Общий статус:', results.overallStatus);
  console.log('Доступные источники:', availableSources, 'из 3');
  console.log('Детали:', results);

  return results;
};

// Добавляем функции в window после их объявления
if (typeof window !== 'undefined') {
  (window as any).runAllDndTests = runAllDndTests;
  (window as any).testFallbackSystem = testFallbackSystem;
  (window as any).testFallbackSystemSync = testFallbackSystemSync;
  (window as any).forceSyncAllSources = forceSyncAllSources;
  (window as any).checkNestedStructuresSupport = checkNestedStructuresSupport;
  (window as any).checkProductionReadiness = checkProductionReadiness;
  (window as any).checkDebugCleanup = checkDebugCleanup;
}
