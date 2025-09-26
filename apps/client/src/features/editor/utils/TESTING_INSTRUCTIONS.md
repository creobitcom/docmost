# Инструкции по тестированию Fallback системы

## Проблема с `require is not defined`

Если при тестировании fallback системы вы получаете ошибку `require is not defined`, это означает, что вы находитесь в браузерной среде, где `require` недоступен.

## Решение

### 1. Используйте синхронную версию тестирования

```javascript
// В консоли браузера
testFallbackSystemSync();
```

Эта функция использует глобальные объекты, которые автоматически добавляются в `window` при инициализации системы.

### 2. Проверьте доступность глобальных объектов

```javascript
// Проверьте, что объекты доступны
console.log('DragStateManager:', window.DragStateManager);
console.log('dndCoordinator:', window.dndCoordinator);
```

### 3. Если глобальные объекты недоступны

Убедитесь, что модули правильно импортированы в вашем приложении:

```typescript
// В вашем основном файле приложения
import { DragStateManager } from './features/editor/utils/drag-state-manager';
import { dndCoordinator } from './features/editor/dnd/DndCoordinator';
```

## Доступные функции тестирования

### Синхронные (рекомендуется для браузера)
- `testFallbackSystemSync()` - Тест fallback системы
- `forceSyncAllSources()` - Принудительная синхронизация всех источников
- `checkNestedStructuresSupport()` - Проверка вложенных структур
- `checkProductionReadiness()` - Проверка готовности к продакшену
- `checkDebugCleanup()` - Проверка очистки debug логов

### Асинхронные (требуют поддержки динамических импортов)
- `testFallbackSystem()` - Тест fallback системы с импортами
- `runAllDndTests()` - Полный набор тестов

## Пример использования

```javascript
// 1. Проверьте доступность системы
testFallbackSystemSync();

// 2. Если система в состоянии "degraded", принудительно синхронизируйте источники
await forceSyncAllSources();

// 3. Проверьте глобальные объекты
console.log('Available objects:', {
  DragStateManager: !!window.DragStateManager,
  dndCoordinator: !!window.dndCoordinator,
  docmostDragState: !!window.docmostDragState
});

// 3. Проверьте состояние DragStateManager
if (window.DragStateManager) {
  console.log('DragStateManager state:', {
    hasValid: window.DragStateManager.hasValid(),
    isActive: window.DragStateManager.isActive(),
    recoveryStats: window.DragStateManager.getRecoveryStats()
  });
}

// 4. Проверьте состояние DndCoordinator
if (window.dndCoordinator) {
  console.log('DndCoordinator state:', {
    hasState: !!window.dndCoordinator.getCurrentPayload(),
    isElementDrag: window.dndCoordinator.isElementDrag()
  });
}
```

## Устранение неполадок

### Проблема: `testFallbackSystemSync is not defined`
**Решение:** Убедитесь, что модуль `dnd-test-logger.ts` правильно импортирован в вашем приложении.

### Проблема: `window.DragStateManager is undefined`
**Решение:** Убедитесь, что модуль `drag-state-manager.ts` импортирован и инициализирован.

### Проблема: `window.dndCoordinator is undefined`
**Решение:** Убедитесь, что модуль `DndCoordinator.ts` импортирован и инициализирован.

### Проблема: Все источники недоступны
**Решение:** Проверьте, что drag & drop система правильно инициализирована в вашем приложении.

## Рекомендации

1. **Используйте синхронную версию** `testFallbackSystemSync()` для тестирования в браузере
2. **Проверяйте глобальные объекты** перед тестированием
3. **Убедитесь в правильной инициализации** всех модулей DnD системы
4. **Используйте асинхронную версию** только если динамические импорты поддерживаются
