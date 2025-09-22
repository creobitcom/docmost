# Drag and Drop Utilities

Утилиты для работы с drag and drop операциями в редакторе.

## Основные функции

### `moveElementBetweenBlocks()`
Основная функция для перемещения элементов между блоками.

```typescript
const success = moveElementBetweenBlocks(
  editor,
  sourceElementId,
  targetBlockId,
  position
);
```

### `validateDropZone()`
Валидация drop зон для обеспечения совместимости типов.

```typescript
const validation = validateDropZone(
  sourceType,
  sourceData,
  targetZone
);
```

### `findNearestDropZone()`
Поиск ближайшей подходящей drop зоны.

```typescript
const dropZone = findNearestDropZone(event);
```

## Совместимость типов

Система проверяет совместимость типов элементов:

- `listItem` → `bulletList`, `orderedList`
- `taskItem` → `taskList`
- `tableRow` → `table`
- `tableCell` → `tableRow`
- `paragraph` → `doc`, `blockquote`, `codeBlock`

## Визуальная обратная связь

- **Valid** - зеленая подсветка для совместимых типов
- **Invalid** - красная подсветка для несовместимых типов
- **Warning** - желтая подсветка для предупреждений

## Логирование

Все операции логируются с префиксом `[DnD]` для отладки.
