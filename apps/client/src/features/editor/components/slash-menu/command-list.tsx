import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
} from "@/features/editor/components/slash-menu/types";
import {
  ActionIcon,
  Group,
  Paper,
  ScrollArea,
  Text,
  UnstyledButton,
} from "@mantine/core";
import classes from "./slash-menu.module.css";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const CommandList = ({
  items,
  command,
  editor,
  range,
}: {
  items: SlashMenuGroupedItemsType;
  command: any;
  editor: any;
  range: any;
}) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flatItems, setFlatItems] = useState<any[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Обновляем flatItems при изменении items
  useEffect(() => {
    if (!items || Object.keys(items).length === 0) {
      console.log('🎯 [CommandList] items is empty, setting flatItems to empty array');
      setFlatItems([]);
      return;
    }
    
    const flattened = Object.values(items).flat();
    console.log('🎯 [CommandList] flatItems updated:', flattened.map(item => item.title));
    setFlatItems(flattened);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      console.log('🎯 [CommandList] selectItem called with index:', index, 'flatItems.length:', flatItems.length);
      console.log('🎯 [CommandList] flatItems content:', flatItems.map(item => item.title));
      
      // Проверяем, что flatItems не пустой
      if (!flatItems || flatItems.length === 0) {
        console.warn('🎯 [CommandList] flatItems is empty, cannot select item');
        return;
      }
      
      // Проверяем, что индекс валидный
      if (isNaN(index) || index < 0 || index >= flatItems.length) {
        console.warn('🎯 [CommandList] Invalid index:', index, 'flatItems.length:', flatItems.length);
        return;
      }
      
      const item = flatItems[index];
      if (item) {
        console.log('🎯 [CommandList] Selecting item:', item.title, 'at index:', index);
        console.log('🎯 [CommandList] Item details:', item);
        command(item);
        console.log('✅ [CommandList] Command executed for:', item.title);
      } else {
        console.warn('🎯 [CommandList] No item found at index:', index);
      }
    },
    [command, flatItems], // Добавляем flatItems в зависимости
  );

  useEffect(() => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];
    const onKeyDown = (e: KeyboardEvent) => {
      // Проверяем, что slash menu действительно активен
      const slashMenuElement = document.querySelector('.slash-menu, #slash-command');
      const isSlashMenuVisible = slashMenuElement && 
        slashMenuElement instanceof HTMLElement && 
        slashMenuElement.style.display !== 'none' &&
        slashMenuElement.offsetParent !== null;

      if (!isSlashMenuVisible) {
        return false; // Slash menu не активен, не обрабатываем клавиши
      }

      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "ArrowUp") {
          // Дополнительная проверка, что slash menu действительно активен
          const slashMenuElement = document.querySelector('.slash-menu, #slash-command');
          const isSlashMenuVisible = slashMenuElement && 
            slashMenuElement instanceof HTMLElement && 
            slashMenuElement.style.display !== 'none' &&
            slashMenuElement.offsetParent !== null;
          
          if (!isSlashMenuVisible) {
            console.log('🎯 [CommandList] ArrowUp ignored - slash menu not visible');
            return false;
          }
          
          setSelectedIndex(prevIndex => {
            // Проверяем, что flatItems не пустой
            if (!flatItems || flatItems.length === 0) {
              console.warn('🎯 [CommandList] flatItems is empty in ArrowUp, cannot navigate');
              return prevIndex;
            }
            
            // Проверяем, что prevIndex валидный
            if (isNaN(prevIndex) || prevIndex < 0) {
              console.warn('🎯 [CommandList] Invalid prevIndex in ArrowUp, using 0');
              prevIndex = 0;
            }
            
            const newIndex = (prevIndex + flatItems.length - 1) % flatItems.length;
            console.log('🎯 [CommandList] ArrowUp: prevIndex:', prevIndex, 'newIndex:', newIndex, 'flatItems.length:', flatItems.length);
            return newIndex;
          });
          return true;
        }

        if (e.key === "ArrowDown") {
          // Дополнительная проверка, что slash menu действительно активен
          const slashMenuElement = document.querySelector('.slash-menu, #slash-command');
          const isSlashMenuVisible = slashMenuElement && 
            slashMenuElement instanceof HTMLElement && 
            slashMenuElement.style.display !== 'none' &&
            slashMenuElement.offsetParent !== null;
          
          if (!isSlashMenuVisible) {
            console.log('🎯 [CommandList] ArrowDown ignored - slash menu not visible');
            return false;
          }
          
          setSelectedIndex(prevIndex => {
            // Проверяем, что flatItems не пустой
            if (!flatItems || flatItems.length === 0) {
              console.warn('🎯 [CommandList] flatItems is empty in ArrowDown, cannot navigate');
              return prevIndex;
            }
            
            // Проверяем, что prevIndex валидный
            if (isNaN(prevIndex) || prevIndex < 0) {
              console.warn('🎯 [CommandList] Invalid prevIndex in ArrowDown, using 0');
              prevIndex = 0;
            }
            
            const newIndex = (prevIndex + 1) % flatItems.length;
            console.log('🎯 [CommandList] ArrowDown: prevIndex:', prevIndex, 'newIndex:', newIndex, 'flatItems.length:', flatItems.length);
            return newIndex;
          });
          return true;
        }

        if (e.key === "Enter") {
          console.log('🎯 [CommandList] Enter key pressed');
          
          // Игнорируем Enter, если он нажат сразу после клика мыши (в течение 100ms)
          const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
          if (timeSinceLastClick < 100) {
            console.log('🎯 [CommandList] Enter ignored - too soon after mouse click');
            return true;
          }
          
          // Дополнительная проверка, что slash menu действительно активен
          const slashMenuElement = document.querySelector('.slash-menu, #slash-command');
          const isSlashMenuVisible = slashMenuElement && 
            slashMenuElement instanceof HTMLElement && 
            slashMenuElement.style.display !== 'none' &&
            slashMenuElement.offsetParent !== null;
          
          console.log('🎯 [CommandList] Slash menu visibility check:', {
            slashMenuElement: !!slashMenuElement,
            isSlashMenuVisible,
            flatItemsLength: flatItems.length,
            selectedIndex
          });
          
          if (!isSlashMenuVisible) {
            console.log('🎯 [CommandList] Enter ignored - slash menu not visible');
            return false;
          }
          
          // Проверяем, что flatItems не пустой
          if (!flatItems || flatItems.length === 0) {
            console.warn('🎯 [CommandList] flatItems is empty in Enter, cannot select item');
            return true;
          }
          
          // Используем функциональное обновление для получения актуального selectedIndex
          setSelectedIndex(currentIndex => {
            console.log('🎯 [CommandList] Enter pressed, selecting item at index:', currentIndex);
            
            // Проверяем, что currentIndex валидный
            if (isNaN(currentIndex) || currentIndex < 0) {
              console.warn('🎯 [CommandList] Invalid currentIndex, using 0 instead');
              currentIndex = 0;
            }
            
            selectItem(currentIndex);
            return currentIndex; // Не изменяем selectedIndex
          });
          return true;
        }
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectItem, flatItems]); // Добавляем flatItems в зависимости

  useEffect(() => {
    // Сбрасываем selectedIndex только если flatItems изменился и не пустой
    if (flatItems.length > 0) {
      setSelectedIndex(0);
      console.log('🎯 [CommandList] selectedIndex reset to 0, flatItems.length:', flatItems.length);
    }
  }, [flatItems]);

  // Дополнительная проверка для исправления NaN selectedIndex
  useEffect(() => {
    if (isNaN(selectedIndex) && flatItems.length > 0) {
      console.log('🎯 [CommandList] Fixing NaN selectedIndex, setting to 0');
      setSelectedIndex(0);
    }
  }, [selectedIndex, flatItems.length]);

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return flatItems.length > 0 ? (
    <Paper id="slash-command" className="slash-menu" shadow="md" p="xs" withBorder>
      <ScrollArea viewportRef={viewportRef} h={350} w={270} scrollbarSize={8}>
        {Object.entries(items).map(([category, categoryItems]) => (
          <div key={category}>
            <Text c="dimmed" mb={4} fw={500} tt="capitalize">
              {category}
            </Text>
            {categoryItems.map((item: SlashMenuItemType, categoryIndex: number) => {
              // Находим глобальный индекс элемента в flatItems
              const globalIndex = flatItems.findIndex(flatItem => flatItem === item);
              
              // Проверяем, что индекс найден корректно
              if (globalIndex === -1) {
                console.warn('🎯 [CommandList] Item not found in flatItems:', item.title);
                return null;
              }
              
              return (
                <UnstyledButton
                  data-item-index={globalIndex}
                  key={categoryIndex}
                  onClick={() => {
                    lastClickTimeRef.current = Date.now();
                    console.log('🎯 [CommandList] Mouse click on item:', item.title, 'at global index:', globalIndex);
                    selectItem(globalIndex); // Используем flatItemsRef внутри selectItem
                  }}
                  className={clsx(classes.menuBtn, {
                    [classes.selectedItem]: globalIndex === selectedIndex,
                  })}
                >
                <Group>
                  <ActionIcon
                    variant="default"
                    component="div"
                  >
                    <item.icon size={18} />
                  </ActionIcon>

                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {t(item.title)}
                    </Text>

                    <Text c="dimmed" size="xs">
                      {t(item.description)}
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
              );
            })}
          </div>
        ))}
      </ScrollArea>
    </Paper>
  ) : null;
};

export default CommandList;
