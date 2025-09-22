# Drag and Drop System

Система drag and drop для редактора блоков с поддержкой Lark-style ghost элементов.

## Обзор

Система позволяет:
- Перетаскивать блоки между позициями
- Перетаскивать элементы внутри блоков
- Создавать новые блоки из элементов
- Валидировать совместимость типов элементов

## Основные компоненты

### 1. Ghost Elements (`ghost.ts`)
- Создание Lark-style призрачных элементов
- Плавное следование за курсором
- Точные размеры исходного элемента
- Стилизация в стиле Lark

### 2. Block Wrapper (`block-wrapper.tsx`)
- Обертка для блоков с drag handle
- Обработка drop зон
- Индикаторы позиции вставки

### 3. Element Drag Handle (`element-drag-handle-view.tsx`)
- Drag handle для отдельных элементов
- Поддержка различных типов элементов

### 4. Drag and Drop Utils (`drag-and-drop-utils.ts`)
- Утилиты для работы с ProseMirror
- Валидация совместимости типов
- Функции перемещения элементов

## Использование

### Базовое использование

```tsx
import { BlockWrapper } from './components/drag-handle/block-wrapper';
import { ElementDragHandleView } from './components/drag-handle/element-drag-handle-view';

// Обертка для блока
<BlockWrapper
  blockId="block-1"
  onDrop={handleBlockDrop}
>
  <div>Содержимое блока</div>
</BlockWrapper>

// Drag handle для элемента
<ElementDragHandleView
  elementId="element-1"
  elementType="list-item"
>
  <div>Содержимое элемента</div>
</ElementDragHandleView>
```

### Обработка событий

```tsx
const handleBlockDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
  console.log('Block dropped:', { sourceId, targetId, position });
  // Логика перемещения блока
};

const handleElementDrop = (elementId: string, targetBlockId: string, position: 'before' | 'after' | 'inside') => {
  console.log('Element dropped:', { elementId, targetBlockId, position });
  // Логика перемещения элемента
};
```

## API

### Ghost Functions

```typescript
// Создание ghost элемента
createLarkGhost(
  source: HTMLElement,
  type: 'block' | 'list-item',
  initialMouseX?: number,
  initialMouseY?: number
): HTMLElement
```

### Drag and Drop Utils

```typescript
// Перемещение элемента между блоками
moveElementBetweenBlocks(
  editor: Editor,
  sourceElementId: string,
  targetBlockId: string,
  position: 'before' | 'after' | 'inside'
): boolean

// Валидация drop зоны
validateDropZone(
  sourceType: 'block' | 'element',
  sourceData: any,
  targetZone: HTMLElement
): { isValid: boolean; reason?: string; visualFeedback?: 'valid' | 'invalid' | 'warning' }

// Поиск ближайшей drop зоны
findNearestDropZone(event: DragEvent): HTMLElement | null
```

## Стили

Все стили находятся в `drag-and-drop.css`:

- `.lark-ghost` - базовые стили для ghost элементов
- `.drag-handle-icon` - стили для drag handle
- `.drop-zone` - стили для drop зон
- `.drop-indicator` - индикаторы позиции вставки

## События

### Custom Events

```typescript
// Событие drop элемента
document.addEventListener('element-drop', (event: CustomEvent) => {
  const { elementId, targetBlockId, position } = event.detail;
  // Обработка drop элемента
});
```

## Логирование

Система включает подробное логирование:

- `[DBG]` - отладочная информация
- `[DnD]` - операции drag and drop
- `[BlockWrapper]` - операции с блоками
- `[ElementDragHandle]` - операции с элементами

## Ограничения

- Поддерживаются только совместимые типы элементов
- Ghost элементы ограничены размерами страницы
- Требуется поддержка современных браузеров

## Планы развития

- Поддержка дополнительных типов элементов
- Улучшенные анимации
- Поддержка Undo/Redo
- Групповые операции
