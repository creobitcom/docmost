# Руководство по отладке Drag & Drop системы

## Текущее состояние

✅ **Fallback система работает идеально:**
- Статус: "healthy" (3 из 3 источников доступны)
- DragStateManager: ✅ работает
- DndCoordinator: ✅ синхронизирован  
- Window Global State: ✅ синхронизирован

❌ **Проблема с drop операцией:**
- Drag start: ✅ работает
- Drag over: ✅ работает
- Drop: ❌ не работает - "Could not find target list item position"

## Внесенные улучшения для отладки

### 1. Детальное логирование позиций

Добавлено подробное логирование для анализа структуры документа:

```typescript
console.log('[RealElementDragHandle] Target position analysis:', {
  targetPos,
  depth: $targetPos.depth,
  nodeTypes: Array.from({ length: $targetPos.depth + 1 }, (_, i) => ({
    depth: i,
    nodeType: $targetPos.node(i).type.name,
    start: $targetPos.start(i),
    end: $targetPos.end(i),
    size: $targetPos.node(i).nodeSize
  }))
});
```

### 2. Альтернативные подходы поиска позиций

Добавлены fallback методы для поиска позиций list items:

- **Основной подход:** Поиск по глубине документа
- **Альтернативный подход:** Поиск в том же списке
- **Детальное логирование:** Каждый шаг поиска

### 3. Анализ структуры документа

Добавлено логирование структуры документа:

```typescript
console.log('[RealElementDragHandle] Document structure analysis:', {
  docSize: view.state.doc.content.size,
  sourceNode: sourcePos ? view.state.doc.nodeAt(sourcePos) : null,
  targetNode: view.state.doc.nodeAt(finalTargetPos)
});
```

## Как использовать для отладки

### 1. Запустите drag операцию

Попробуйте перетащить элемент списка и посмотрите на логи в консоли.

### 2. Анализируйте логи

Ищите следующие ключевые сообщения:

```
[RealElementDragHandle] Drop details: {...}
[RealElementDragHandle] Document structure analysis: {...}
[RealElementDragHandle] Target position analysis: {...}
[RealElementDragHandle] Checking depth X: {...}
```

### 3. Проверьте структуру узлов

В логах `nodeTypes` проверьте:
- Есть ли `taskItem` или `listItem` в структуре
- Правильные ли позиции `start`, `end`, `size`
- Корректная ли глубина документа

### 4. Проверьте альтернативные подходы

Если основной поиск не работает, система попробует альтернативный подход:

```
[RealElementDragHandle] Could not find target list item position, trying alternative approach
[RealElementDragHandle] Using alternative position: X
```

## Возможные проблемы и решения

### Проблема 1: Неправильная структура документа

**Симптомы:**
- В `nodeTypes` нет `taskItem` или `listItem`
- Неправильные позиции узлов

**Решение:**
- Проверить правильность создания элементов списка
- Убедиться, что `data-element-id` корректно установлен

### Проблема 2: Неправильные позиции

**Симптомы:**
- `targetPos` или `sourcePos` некорректны
- `start`, `end`, `size` не соответствуют ожиданиям

**Решение:**
- Проверить правильность расчета позиций в drag start
- Убедиться, что позиции не изменились между drag start и drop

### Проблема 3: Проблемы с глубиной документа

**Симптомы:**
- `depth` неожиданно высокий или низкий
- Не удается найти нужный узел на любой глубине

**Решение:**
- Проверить структуру ProseMirror документа
- Убедиться, что элементы правильно вложены

## Следующие шаги

1. **Запустите тест** с улучшенным логированием
2. **Проанализируйте логи** для понимания структуры документа
3. **Определите проблему** на основе детальной информации
4. **Внесите исправления** в соответствии с найденными проблемами

## Ожидаемые результаты

После исправлений система должна:
- ✅ Находить правильные позиции list items
- ✅ Успешно выполнять drop операции
- ✅ Корректно перемещать элементы в списках
- ✅ Показывать детальные логи для диагностики

## Мониторинг

Используйте следующие команды для мониторинга:

```javascript
// Проверка fallback системы
testFallbackSystemSync();

// Принудительная синхронизация
await forceSyncAllSources();

// Проверка состояния DragStateManager
console.log('DragStateManager state:', window.DragStateManager.get());
```
