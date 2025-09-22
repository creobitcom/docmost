// Тестовый скрипт для проверки API блоков
// Запускать в консоли браузера на странице с редактором

console.log('🧪 [TestBlocksAPI] Starting blocks API test...');

// Функция для тестирования создания блока
async function testCreateBlock(pageId) {
  console.log('🧪 [TestBlocksAPI] Testing block creation...');
  
  const testBlock = {
    blockId: `test-block-${Date.now()}`,
    blockType: 'paragraph',
    pageId: pageId,
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Test block created at ${new Date().toISOString()}`
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(`/api/pages/blocks/${pageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ blocks: [testBlock] })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [TestBlocksAPI] Block created successfully:', result);
      return testBlock.blockId;
    } else {
      const errorText = await response.text();
      console.error('❌ [TestBlocksAPI] Failed to create block:', response.status, errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ [TestBlocksAPI] Error creating block:', error);
    return null;
  }
}

// Функция для тестирования получения блоков
async function testGetBlocks(pageId) {
  console.log('🧪 [TestBlocksAPI] Testing blocks retrieval...');
  
  try {
    const response = await fetch(`/api/pages/${pageId}/blocks`, {
      credentials: 'include'
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [TestBlocksAPI] Blocks retrieved successfully:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('❌ [TestBlocksAPI] Failed to get blocks:', response.status, errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ [TestBlocksAPI] Error getting blocks:', error);
    return null;
  }
}

// Функция для тестирования обновления блока
async function testUpdateBlock(pageId, blockId) {
  console.log('🧪 [TestBlocksAPI] Testing block update...');
  
  const updatedBlock = {
    blockId: blockId,
    blockType: 'paragraph',
    pageId: pageId,
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Updated block at ${new Date().toISOString()}`
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(`/api/pages/blocks/${pageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ blocks: [updatedBlock] })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [TestBlocksAPI] Block updated successfully:', result);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ [TestBlocksAPI] Failed to update block:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ [TestBlocksAPI] Error updating block:', error);
    return false;
  }
}

// Основная функция тестирования
async function runBlocksAPITest() {
  console.log('🚀 [TestBlocksAPI] Starting comprehensive blocks API test...');
  
  // Получаем pageId из URL или используем тестовый
  const pageId = window.location.pathname.match(/\/p\/([^\/]+)/)?.[1] || 'test-page-id';
  console.log('📄 [TestBlocksAPI] Using pageId:', pageId);
  
  // 1. Получаем текущие блоки
  console.log('\n1️⃣ [TestBlocksAPI] Step 1: Get current blocks');
  const initialBlocks = await testGetBlocks(pageId);
  
  // 2. Создаем новый блок
  console.log('\n2️⃣ [TestBlocksAPI] Step 2: Create new block');
  const newBlockId = await testCreateBlock(pageId);
  
  if (newBlockId) {
    // 3. Обновляем созданный блок
    console.log('\n3️⃣ [TestBlocksAPI] Step 3: Update created block');
    await testUpdateBlock(pageId, newBlockId);
    
    // 4. Получаем блоки снова для проверки
    console.log('\n4️⃣ [TestBlocksAPI] Step 4: Get blocks after changes');
    await testGetBlocks(pageId);
  }
  
  console.log('\n✅ [TestBlocksAPI] Blocks API test completed!');
}

// Экспортируем функции для использования в консоли
window.testBlocksAPI = {
  createBlock: testCreateBlock,
  getBlocks: testGetBlocks,
  updateBlock: testUpdateBlock,
  runTest: runBlocksAPITest
};

console.log('🔧 [TestBlocksAPI] Functions available in window.testBlocksAPI');
console.log('📖 [TestBlocksAPI] Usage:');
console.log('  - window.testBlocksAPI.runTest() - запустить полный тест');
console.log('  - window.testBlocksAPI.getBlocks(pageId) - получить блоки');
console.log('  - window.testBlocksAPI.createBlock(pageId) - создать блок');
console.log('  - window.testBlocksAPI.updateBlock(pageId, blockId) - обновить блок');