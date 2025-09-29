import { useEffect, useState } from 'react';
import { useEditorDiagnostics as useEditorDiagnosticsUtil } from '../utils/editor-diagnostics';

interface UseEditorDiagnosticsOptions {
  blocks: any[];
  blockRefs: Map<string, any>;
  isReady: boolean;
  enableLogging?: boolean;
  logOnlyOnDragEvents?: boolean;
}

export const useEditorDiagnostics = ({ 
  blocks, 
  blockRefs, 
  isReady, 
  enableLogging = true,
  logOnlyOnDragEvents = false
}: UseEditorDiagnosticsOptions) => {
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Автоматическая диагностика редакторов - логируем только если не включен режим "только при драге"
  const shouldLogNow = enableLogging && !logOnlyOnDragEvents;
  const editorDiagnostics = useEditorDiagnosticsUtil(blocks, blockRefs, isReady, shouldLogNow);

  useEffect(() => {
    if (editorDiagnostics && typeof editorDiagnostics === 'object') {
      setDiagnostics(editorDiagnostics.diagnostics?.readinessStatus || []);
      setRecommendations(editorDiagnostics.recommendations || []);
    }
  }, [editorDiagnostics]);

  // Детальная диагностика состояния редакторов
  const logBlockEditorsState = (blockRefs: Map<string, any>) => {
    console.log('[Diagnostics] 🔍 Checking blockRefs state...');
    if (!blockRefs || blockRefs.size === 0) {
      console.log('[Diagnostics] ❌ blockRefs is empty');
      return false;
    }

    let allReady = true;
    const diagnostics = [];

    blockRefs.forEach((ref, blockId) => {
      const editor = ref?.editor;
      const provider = ref?.provider;

      const isEditorReady = !!editor && editor.isEditable && !editor.isDestroyed;
      const isProviderReady = !!provider && (provider.status === 'connected' || provider.status === 'disconnected' || !provider.status);
      const isBlockReady = isEditorReady && isProviderReady;

      if (!isBlockReady) allReady = false;

      const blockDiagnostics = {
        blockId,
        hasRef: !!ref,
        hasCurrent: !!ref?.current,
        hasEditor: !!editor,
        hasProvider: !!provider,
        editorReady: isEditorReady,
        editorIsEditable: editor?.isEditable,
        editorIsDestroyed: editor?.isDestroyed,
        editorHasView: !!editor?.view,
        editorHasDOM: !!editor?.view?.dom,
        providerReady: isProviderReady,
        providerStatus: provider?.status,
        providerConnected: provider?.isConnected,
        providerExists: !!provider,
        blockReady: isBlockReady
      };

      diagnostics.push(blockDiagnostics);
      
      console.log(`[Diagnostics] 📊 Block ${blockId}:`, blockDiagnostics);
    });

    console.log('[Diagnostics] 🎯 Overall state:', {
      totalBlocks: blockRefs.size,
      allReady,
      readyBlocks: diagnostics.filter(d => d.blockReady).length,
      notReadyBlocks: diagnostics.filter(d => !d.blockReady).length,
      notReadyReasons: diagnostics
        .filter(d => !d.blockReady)
        .map(d => ({
          blockId: d.blockId,
          reasons: [
            !d.hasEditor && 'no editor',
            d.hasEditor && !d.editorIsEditable && 'editor not editable',
            d.hasEditor && d.editorIsDestroyed && 'editor destroyed',
            !d.hasProvider && 'no provider',
            d.hasProvider && d.providerStatus !== 'connected' && d.providerStatus !== 'disconnected' && `provider status: ${d.providerStatus}`
          ].filter(Boolean)
        }))
    });

    return allReady;
  };

  // Вспомогательные функции для отладки
  const countElementsInBlock = (block: any): number => {
    let count = 0;
    function traverse(nodes: any[]) {
      nodes?.forEach(node => {
        if (['listItem', 'taskItem'].includes(node.type)) count++;
        if (node.content) traverse(node.content);
      });
    }
    traverse(block.content?.content || []);
    return count;
  };

  const getElementIds = (block: any): string[] => {
    const ids: string[] = [];
    function traverse(nodes: any[]) {
      nodes?.forEach(node => {
        if (node?.attrs?.blockId) ids.push(node.attrs.blockId);
        if (node.content) traverse(node.content);
      });
    }
    traverse(block.content?.content || []);
    return ids;
  };

  const getContentStructure = (block: any): string[] => {
    const structure: string[] = [];
    function traverse(nodes: any[], depth = 0) {
      nodes?.forEach(node => {
        structure.push('  '.repeat(depth) + node.type + (node?.attrs?.blockId ? ` [${node.attrs.blockId}]` : ''));
        if (node.content) traverse(node.content, depth + 1);
      });
    }
    traverse(block.content?.content || []);
    return structure;
  };

  // Глобальные функции для отладки
  const setupGlobalDebugFunctions = (blocksRef: React.MutableRefObject<any[]>, blockRefs: Map<string, any>) => {
    try {
      (window as any).__blocksRef = blocksRef;
      (window as any).__dumpBlocks = () => {
        try {
          const blocks = blocksRef.current || [];
          console.log('=== 🔍 BLOCKS DUMP ===');
          console.log('Total blocks:', blocks.length);
          console.log('Window drag states:', {
            __currentBlockId: (window as any).__currentBlockId,
            __dragState: (window as any).__dragState,
            docmostDragState: (window as any).docmostDragState
          });
          
          blocks.forEach((block: any, i: number) => {
            const elementCount = countElementsInBlock(block);
            console.log(`Block ${i}:`, {
              id: block.id,
              position: block.position,
              type: block.blockType,
              hasContent: !!block.content,
              hasElements: elementCount > 0,
              elementCount: elementCount,
              elementIds: getElementIds(block),
              contentStructure: getContentStructure(block)
            });
          });
          
          console.log('=== END DUMP ===');
        } catch (e) {
          console.warn('__dumpBlocks failed', e);
        }
      };

      // Глобальная функция для диагностики состояния редакторов
      (window as any).__diagnoseEditors = () => {
        try {
          console.log('=== 🔍 EDITOR DIAGNOSTICS ===');
          console.log('Current isReady state:', isReady);
          console.log('BlockRefs size:', blockRefs.size);
          console.log('BlockRefs keys:', Array.from(blockRefs.keys()));
          
          // Используем нашу функцию диагностики
          const allReady = logBlockEditorsState(blockRefs);
          
          console.log('=== END DIAGNOSTICS ===');
          return allReady;
        } catch (e) {
          console.warn('__diagnoseEditors failed', e);
          return false;
        }
      };
    } catch (e) {
      // ignore
    }
  };

  // Функция для логирования диагностики при драг-событиях
  const logDiagnosticsOnDragEvent = (eventType: 'dragStart' | 'dragEnd') => {
    if (!enableLogging) return;
    
    console.group(`🔍 EDITOR DIAGNOSTICS - ${eventType.toUpperCase()}`);
    console.log(`📅 Время: ${new Date().toLocaleTimeString()}`);
    console.log(`🎯 Событие: ${eventType}`);
    
    // Собираем свежую диагностику
    const freshDiagnostics = useEditorDiagnosticsUtil(blocks, blockRefs, isReady, false);
    
    if (freshDiagnostics && typeof freshDiagnostics === 'object') {
      console.log('📊 Общая статистика:', {
        blocksCount: freshDiagnostics.diagnostics?.blocksCount || 0,
        blockRefsCount: freshDiagnostics.diagnostics?.blockRefsCount || 0,
        isReady: freshDiagnostics.diagnostics?.isReady || false,
        missingRefsCount: freshDiagnostics.diagnostics?.missingRefs?.length || 0,
        notReadyBlocksCount: freshDiagnostics.diagnostics?.notReadyBlocks?.length || 0
      });
      
      if (freshDiagnostics.diagnostics?.missingRefs?.length > 0) {
        console.warn('❌ Отсутствующие рефы:', freshDiagnostics.diagnostics.missingRefs);
      }
      
      if (freshDiagnostics.diagnostics?.notReadyBlocks?.length > 0) {
        console.warn('⏳ Неготовые блоки:', freshDiagnostics.diagnostics.notReadyBlocks);
      }
      
      console.log('📋 Детальная информация по блокам:');
      freshDiagnostics.diagnostics?.readinessStatus?.forEach((status: any) => {
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
    }
    
    console.groupEnd();
  };

  return {
    diagnostics,
    recommendations,
    logBlockEditorsState,
    setupGlobalDebugFunctions,
    countElementsInBlock,
    getElementIds,
    getContentStructure,
    logDiagnosticsOnDragEvent
  };
};

