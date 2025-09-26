# Руководство по тестированию DnD системы

## Обзор

Система логирования DnD позволяет точно определить состояние всех задач из исследования. Каждая задача имеет уникальные логи с префиксом `[DND_TEST_<TASK_NAME>]`.

## Доступные функции в консоли

### Основные функции тестирования

```javascript
// Запустить все тесты DnD системы
runAllDndTests()

// Проверить конкретные задачи
checkNestedStructuresSupport()
checkProductionReadiness()
checkDebugCleanup()

// Получить отчет по всем задачам
dndTestLogger.generateReport()

// Экспортировать все логи
dndTestLogger.exportLogs()
```

### Функции очистки debug логов

```javascript
// Запустить очистку debug логов
runDebugCleanup()

// Проверить готовность к production
checkProductionReadiness()
```

## Тестовые сценарии

### 1. Тестирование Fallback системы (08.09.2025)

**Цель**: Проверить работу fallback системы для случаев когда dataTransfer пустой

**Тестовые действия**:
1. Откройте страницу с редактором
2. Попробуйте перетащить элемент списка
3. В консоли найдите логи с префиксом `[DND_TEST_FALLBACK_SYSTEM]`

**Ожидаемые результаты**:
- ✅ `DataTransfer fallback successful` - fallback через DataTransfer работает
- ✅ `DndCoordinator fallback successful` - fallback через DndCoordinator работает
- ✅ `Fallback system working: <method>` - общий результат fallback системы

### 2. Тестирование Cross-block логики вставки (12.09.2025)

**Цель**: Проверить логику вставки Item в существующий List при cross-block перемещении

**Тестовые действия**:
1. Создайте два блока со списками
2. Перетащите элемент из одного списка в другой
3. В консоли найдите логи с префиксом `[DND_TEST_CROSS_BLOCK_INSERTION]`

**Ожидаемые результаты**:
- ✅ `Element inserted into existing list` - элемент вставлен в существующий список
- ✅ `New list created for element insertion` - создан новый список для элемента
- ✅ `Cross-block element move completed` - cross-block перемещение завершено

### 3. Тестирование поддержки разных типов блоков (15.09.2025)

**Цель**: Проверить поддержку drag-and-drop между разными типами блоков

**Тестовые действия**:
1. Создайте блоки разных типов (bulletList, orderedList, taskList)
2. Попробуйте перетащить элементы между ними
3. В консоли найдите логи с префиксом `[DND_TEST_DIFFERENT_BLOCK_TYPES]`

**Ожидаемые результаты**:
- ✅ `Type compatibility check: listItem -> bulletList` - совместимость типов проверена
- ✅ `Element moved successfully between compatible types` - элемент перемещен между совместимыми типами
- ❌ `Incompatible element types detected` - обнаружены несовместимые типы

### 4. Тестирование вложенных структур (16.09.2025)

**Цель**: Проверить поддержку drag-and-drop для вложенных структур

**Тестовые действия**:
1. Создайте вложенные структуры (blockquote, codeBlock, blockGroup)
2. Попробуйте перетащить элементы внутри них
3. В консоли найдите логи с префиксом `[DND_TEST_NESTED_STRUCTURES]`

**Ожидаемые результаты**:
- ✅ `List item detected in nested structure` - элемент списка обнаружен во вложенной структуре
- ✅ `Parent <type>List found in nested structure` - родительский список найден
- ✅ `Nested structures support check` - поддержка вложенных структур проверена

### 5. Тестирование Production готовности (16.09.2025)

**Цель**: Проверить готовность кода к production

**Тестовые действия**:
1. Запустите `checkProductionReadiness()`
2. В консоли найдите логи с префиксом `[DND_TEST_PRODUCTION_READY]`

**Ожидаемые результаты**:
- ✅ `Production readiness check` - проверка production готовности
- ❌ `Debug logs cleanup check` - проверка очистки debug логов

### 6. Тестирование очистки debug логов (16.09.2025)

**Цель**: Проверить удаление debug логов

**Тестовые действия**:
1. Запустите `checkDebugCleanup()`
2. В консоли найдите логи с префиксом `[DND_TEST_DEBUG_CLEANUP]`

**Ожидаемые результаты**:
- ✅ `Debug logs cleanup check` - проверка очистки debug логов
- ❌ `Debug logs cleanup needed` - требуется очистка debug логов

## Интерпретация результатов

### Статусы тестов

- ✅ **SUCCESS** - задача выполнена успешно
- ❌ **FAILED** - задача не выполнена
- ⚠️ **PARTIAL** - задача выполнена частично
- ⏳ **NOT_TESTED** - задача не протестирована

### Генерация отчета

```javascript
// Получить полный отчет
const report = dndTestLogger.generateReport();
console.log(report);

// Получить логи конкретной задачи
const fallbackLogs = dndTestLogger.getTaskLogs(DndTestTask.FALLBACK_SYSTEM);
console.log('Fallback logs:', fallbackLogs);

// Получить последний результат задачи
const lastResult = dndTestLogger.getLastTaskResult(DndTestTask.FALLBACK_SYSTEM);
console.log('Last fallback result:', lastResult);
```

## Примеры логов

### Успешный fallback
```
[DND_TEST_FALLBACK_SYSTEM] ✅ SUCCESS: DataTransfer fallback successful
{
  hasJsonData: true,
  parsedType: "element",
  version: "2.0"
}
```

### Успешное cross-block перемещение
```
[DND_TEST_CROSS_BLOCK_INSERTION] ✅ SUCCESS: Element inserted into existing list
{
  listType: "bulletList",
  elementType: "listItem",
  listItemsCount: 3,
  targetPosition: "inside"
}
```

### Проверка совместимости типов
```
[DND_TEST_DIFFERENT_BLOCK_TYPES] ✅ SUCCESS: Type compatibility check: listItem -> bulletList
{
  sourceType: "listItem",
  targetType: "bulletList",
  isCompatible: true,
  compatibleTypesForSource: ["bulletList", "orderedList"]
}
```

## Устранение неполадок

### Если тесты не запускаются
1. Убедитесь, что страница загружена полностью
2. Проверьте, что функции доступны в `window`
3. Откройте консоль разработчика

### Если логи не появляются
1. Проверьте, что DnD система инициализирована
2. Убедитесь, что выполняются drag-and-drop операции
3. Проверьте фильтры консоли

### Если тесты показывают FAILED
1. Проверьте детали в контексте лога
2. Убедитесь, что все зависимости загружены
3. Проверьте совместимость браузера
