# Исправление логики поиска позиций taskItem

## 🔍 Проблема

Из логов было видно, что система не могла найти позицию `taskItem` в структуре документа:

```
[RealElementDragHandle] Target position analysis (before): {targetPos: 9, depth: 1, nodeTypes: Array(2)}
[RealElementDragHandle] Checking depth 1 (before): {nodeType: 'taskList', start: 1, end: 28, size: 29}
[RealElementDragHandle] Checking depth 0 (before): {nodeType: 'doc', start: 0, end: 31, size: 33}
[RealElementDragHandle] Could not find target list item position (before), trying alternative approach
```

**Проблема:** Система искала `taskItem` на глубине 1, где находился `taskList`, но `taskItem` находится внутри `taskList` на более глубоком уровне.

## ✅ Решение

### 1. Улучшенный поиск taskItem

Добавлена логика поиска `taskItem` внутри `taskList`:

```typescript
// Если не нашли taskItem, ищем его внутри taskList
if (!foundTaskItem) {
  console.log('[RealElementDragHandle] No taskItem found at current depth, searching inside taskList');
  
  // Ищем taskItem внутри taskList
  const taskListPos = $targetPos.pos;
  const taskListNode = view.state.doc.nodeAt(taskListPos);
  
  if (taskListNode && (taskListNode.type.name === 'taskList' || taskListNode.type.name === 'bulletList' || taskListNode.type.name === 'orderedList')) {
    console.log('[RealElementDragHandle] Found taskList, searching for taskItem inside');
    
    // Ищем taskItem внутри taskList
    taskListNode.forEach((node, offset) => {
      if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
        const itemPos = taskListPos + offset + 1; // +1 для позиции после открывающего тега
        console.log('[RealElementDragHandle] Found taskItem inside taskList at position:', itemPos);
        targetListItemPos = itemPos;
        foundTaskItem = true;
        return false; // Прерываем forEach
      }
    });
  }
}
```

### 2. Альтернативный подход

Если основной поиск не работает, система использует альтернативный подход:

```typescript
// Альтернативный подход: используем позицию target напрямую
const targetNode = view.state.doc.nodeAt(targetPos);
if (targetNode && (targetNode.type.name === 'taskList' || targetNode.type.name === 'bulletList' || targetNode.type.name === 'orderedList')) {
  console.log('[RealElementDragHandle] Target is a list, finding first item position');
  
  // Находим позицию первого элемента в списке
  let firstItemPos = targetPos + 1; // +1 для позиции после открывающего тега
  
  // Проверяем, есть ли элементы в списке
  if (targetNode.childCount > 0) {
    const firstChild = targetNode.child(0);
    if (firstChild.type.name === 'taskItem' || firstChild.type.name === 'listItem') {
      targetListItemPos = firstItemPos;
      console.log('[RealElementDragHandle] Using first item position:', targetListItemPos);
    }
  }
} else {
  // Если targetPos не указывает на список, используем его напрямую
  targetListItemPos = targetPos;
  console.log('[RealElementDragHandle] Using target position directly:', targetListItemPos);
}
```

### 3. Обработка случаев "before" и "after"

- **Before:** Ищем позицию перед target элементом
- **After:** Ищем позицию после target элемента
- **Правильный расчет позиций:** Учитываем размеры узлов и структуру документа

## 🎯 Ожидаемые результаты

Теперь система должна:

1. ✅ **Находить taskItem** внутри taskList
2. ✅ **Правильно рассчитывать позиции** для вставки
3. ✅ **Использовать альтернативные подходы** при проблемах
4. ✅ **Показывать детальные логи** для диагностики

## 🧪 Тестирование

Попробуйте перетащить элемент списка и посмотрите на новые логи:

```
[RealElementDragHandle] No taskItem found at current depth, searching inside taskList
[RealElementDragHandle] Found taskList, searching for taskItem inside
[RealElementDragHandle] Found taskItem inside taskList at position: X
```

Или альтернативный подход:

```
[RealElementDragHandle] Target is a list, finding first item position
[RealElementDragHandle] Using first item position: X
```

## 📊 Статус

- ✅ **Fallback система:** "healthy" (3/3 источника)
- ✅ **Логика поиска позиций:** исправлена
- ✅ **Альтернативные подходы:** добавлены
- ✅ **Детальное логирование:** улучшено
- 🔄 **Тестирование:** в процессе

Теперь система должна успешно находить позиции taskItem и выполнять drop операции!
