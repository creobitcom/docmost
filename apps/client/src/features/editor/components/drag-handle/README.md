# Drag Handle Components

Этот модуль содержит компоненты для реализации drag-and-drop функциональности в редакторе.

## Компоненты

### BlockHandle
Компонент для перетаскивания блоков.

```tsx
<BlockHandle
  blockId="block-123"
  onDragStart={(blockId) => console.log('Drag start:', blockId)}
  onDragEnd={() => console.log('Drag end')}
/>
```

### ElementHandle
Компонент для перетаскивания элементов списка.

```tsx
<ElementHandle
  elementId="element-456"
  blockId="block-123"
  onDragStart={(elementId, blockId) => console.log('Element drag start')}
  onDragEnd={() => console.log('Element drag end')}
/>
```

### DropIndicator
Индикатор места для вставки при перетаскивании.

```tsx
<DropIndicator
  position="top" // 'top' | 'bottom' | 'inside'
  visible={true}
  style={{ custom: 'styles' }}
/>
```

## Утилиты

### pm-adapter.ts
Адаптер для работы с ProseMirror:
- `resolveNodeFromDom()` - разрешение узла из DOM
- `toDragData()` - создание данных для перетаскивания
- `getNodeRect()` - получение прямоугольника узла
- `resolveListItemAtDom()` - разрешение элемента списка из DOM

### ops.ts
Операции для drag-and-drop:
- `executeDropOperation()` - выполнение операции drop
- `moveBlock()` - перемещение блока
- `moveListItem()` - перемещение элемента списка
- `embedIntoBlock()` - встраивание в блок
- `extractToNewBlock()` - извлечение в новый блок

### drop-resolver.ts
Разрешение целей для drop:
- `resolveDropTargetFromPoint()` - разрешение цели по координатам
- `resolveDropTargetFromElement()` - разрешение цели по элементу

### safe-drop-handler.ts
Безопасные операции drop:
- `safeInsertNode()` - безопасная вставка узла
- `insertListItemSafe()` - безопасная вставка элемента списка
- `atomicMoveNode()` - атомарное перемещение узла
- `safeRemoveNode()` - безопасное удаление узла

## Стили

### dnd-tokens.ts
Токены и константы для DnD:
- MIME типы
- CSS классы
- Атрибуты данных

### CSS файлы
- `element-drag-handle.css` - базовые стили
- `real-element-drag-handle.css` - улучшенные стили
- `debug-drag-drop.css` - стили для отладки

## Хуки

### useDndDebug
Хук для отладки drag-and-drop операций.

```tsx
const debugInfo = useDndDebug();
console.log('Drag state:', debugInfo);
```

### useEnhancedDnd
Расширенный хук для управления состоянием DnD.

```tsx
const { isDragging, startDrag, endDrag } = useEnhancedDnd();
```

## Расширения

### BlockDragHandle
Расширение Tiptap для drag handles блоков.

### ElementDragHandle
Расширение Tiptap для drag handles элементов.

### DebugDragDrop
Расширение для отладки drag-and-drop операций.

## Использование

1. Импортируйте необходимые компоненты
2. Добавьте drag handles к элементам
3. Обработайте события drag-and-drop
4. Используйте утилиты для безопасных операций

```tsx
import { BlockHandle, ElementHandle, DropIndicator } from './drag-handle';
import { useDndDebug } from './hooks/use-enhanced-dnd';

function MyEditor() {
  const debugInfo = useDndDebug();
  
  return (
    <div>
      <BlockHandle blockId="block-1" />
      <ElementHandle elementId="element-1" blockId="block-1" />
      <DropIndicator position="top" visible={true} />
    </div>
  );
}
```
