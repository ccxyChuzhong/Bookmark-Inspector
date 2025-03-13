// 全局变量，用于存储检测状态
let checkingStatus = {
  isChecking: false,
  total: 0,
  checked: 0,
  results: [],
  invalidCount: 0
};

// 导入书签
function importBookmarks(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const bookmarks = JSON.parse(e.target.result);
      processImport(bookmarks);
    } catch (error) {
      showMessage("导入失败: 文件格式不正确");
    }
  };
  reader.readAsText(file);
}

// 处理导入的书签数据
async function processImport(bookmarks) {
  try {
    // 递归创建书签
    await createBookmarksRecursively(bookmarks[0].children);
    showMessage("书签导入成功！");
  } catch (error) {
    showMessage("导入过程中出错: " + error.message);
  }
}

// 递归创建书签和文件夹
async function createBookmarksRecursively(nodes, parentId = "1") {
  for (const node of nodes) {
    if (node.url) {
      // 创建书签
      await createBookmark(parentId, node.title, node.url);
    } else if (node.children) {
      // 创建文件夹
      const newFolder = await createBookmarkFolder(parentId, node.title);
      // 递归处理子节点
      await createBookmarksRecursively(node.children, newFolder.id);
    }
  }
}

// 创建书签
function createBookmark(parentId, title, url) {
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.bookmarks) {
      reject(new Error("浏览器书签API不可用"));
      return;
    }

    try {
      chrome.bookmarks.create(
        {
          parentId: parentId,
          title: title,
          url: url,
        },
        resolve
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function deleteBookmark(bookmarkId) {
  try {
    // 显示确认对话框
    if (!confirm("确定要删除这个书签吗？")) {
      return;
    }
    
    // 删除书签
    await chrome.bookmarks.remove(bookmarkId);
    
    // 从当前显示的书签列表中移除该书签
    // 注意：不要清空整个列表，只移除被删除的项
    const index = currentBookmarks.findIndex(b => b.id === bookmarkId);
    if (index !== -1) {
      currentBookmarks.splice(index, 1);
    }
    
    // 更新界面显示
    renderBookmarks(currentBookmarks);
    
    // 更新计数器
    updateCounters();
    
    // 显示成功消息
    showMessage("书签已成功删除");
  } catch (error) {
    console.error("删除书签失败:", error);
    showMessage("删除书签失败，请重试", true);
  }
}
// 渲染书签列表
function renderBookmarks(bookmarks) {
  const bookmarksList = document.getElementById("bookmarksList");
  if (!bookmarksList) return;
  
  // 清空现有列表
  bookmarksList.innerHTML = "";
  
  // 如果没有书签，显示提示信息
  if (bookmarks.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "text-center p-3";
    emptyMessage.textContent = "没有找到书签";
    bookmarksList.appendChild(emptyMessage);
    return;
  }
  
  // 渲染每个书签
  bookmarks.forEach((bookmark) => {
    const bookmarkItem = document.createElement("div");
    bookmarkItem.className = "bookmark-item";
    if (bookmark.invalid) {
      bookmarkItem.classList.add("invalid");
    }
    
    // 创建书签图标
    const favicon = document.createElement("img");
    favicon.className = "favicon";
    favicon.src = bookmark.favicon || "images/default-favicon.png";
    favicon.onerror = function() {
      this.src = "images/default-favicon.png";
    };
    
    // 创建书签内容区域
    const bookmarkContent = document.createElement("div");
    bookmarkContent.className = "bookmark-content";
    
    // 创建书签标题
    const title = document.createElement("div");
    title.className = "bookmark-title";
    title.textContent = bookmark.title || "无标题";
    
    // 创建书签URL
    const url = document.createElement("div");
    url.className = "bookmark-url";
    url.textContent = bookmark.url;
    
    // 创建书签状态标签
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    if (bookmark.invalid) {
      statusBadge.classList.add("badge-danger");
      statusBadge.textContent = "失效";
    } else {
      statusBadge.classList.add("badge-success");
      statusBadge.textContent = "有效";
    }
    
    // 创建书签操作区域
    const actions = document.createElement("div");
    actions.className = "bookmark-actions";
    
    // 创建打开按钮
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-sm btn-outline-primary open-btn";
    openBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
    openBtn.title = "打开书签";
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({ url: bookmark.url });
    });
    
    // 创建编辑按钮
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-outline-secondary edit-btn";
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = "编辑书签";
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showEditBookmarkModal(bookmark);
    });
    
    // 创建删除按钮
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-outline-danger delete-btn";
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = "删除书签";
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteBookmark(bookmark.id);
    });
    
    // 创建重新检查按钮（仅对失效书签显示）
    if (bookmark.invalid) {
      const recheckBtn = document.createElement("button");
      recheckBtn.className = "btn btn-sm btn-outline-info recheck-btn";
      recheckBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
      recheckBtn.title = "重新检查";
      recheckBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        recheckBookmark(bookmark.id);
      });
      actions.appendChild(recheckBtn);
    }
    
    // 将按钮添加到操作区域
    actions.appendChild(openBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    // 将内容添加到书签内容区域
    bookmarkContent.appendChild(title);
    bookmarkContent.appendChild(url);
    bookmarkContent.appendChild(statusBadge);
    
    // 将所有元素添加到书签项
    bookmarkItem.appendChild(favicon);
    bookmarkItem.appendChild(bookmarkContent);
    bookmarkItem.appendChild(actions);
    
    // 为整个书签项添加点击事件（打开书签）
    bookmarkItem.addEventListener("click", () => {
      chrome.tabs.create({ url: bookmark.url });
    });
    
    // 将书签项添加到列表
    bookmarksList.appendChild(bookmarkItem);
  });
  
  // 更新计数器
  updateCounters();
}
// ... existing code ...
// 重新检查单个书签
async function recheckBookmark(bookmarkId) {
  try {
    // 查找书签
    const bookmarks = await chrome.bookmarks.get(bookmarkId);
    if (!bookmarks || bookmarks.length === 0) {
      showMessage("找不到该书签", true);
      return;
    }
    
    const bookmark = bookmarks[0];
    
    // 显示检测中的消息
    showMessage("正在重新检查书签...");
    
    // 检查URL可用性
    const isAvailable = await checkUrlAvailability(bookmark.url);
    
    // 更新结果数组中的状态
    const index = checkingStatus.results.findIndex(r => r.url === bookmark.url);
    if (index !== -1) {
      checkingStatus.results[index].status = isAvailable;
      
      // 保存更新后的结果
      saveCheckResults();
    }
    
    // 如果书签恢复可用，从失效列表中移除
    if (isAvailable) {
      const itemToRemove = document.querySelector(
        `#invalidList [data-bookmark-id="${bookmarkId}"]`
      );
      if (itemToRemove) {
        itemToRemove.remove();
      }
      
      // 检查是否还有其他失效书签
      const remainingInvalidItems = document.querySelectorAll("#invalidList .invalid-bookmark-item");
      if (remainingInvalidItems.length === 0) {
        document.getElementById("invalidBookmarks").style.display = "none";
      }
      
      // 更新主结果列表中对应的项
      updateResultsUI();
      
      showMessage("书签已恢复可用");
    } else {
      showMessage("书签仍然不可用", true);
    }
  } catch (error) {
    console.error("重新检查书签时出错:", error);
    showMessage("重新检查失败: " + error.message, true);
  }
}
// ... existing code ...
// 更新计数器函数
function updateCounters() {
  const totalCount = currentBookmarks.length;
  const invalidCount = currentBookmarks.filter(b => b.invalid).length;
  
  // 更新显示
  const totalCountElement = document.getElementById("totalCount");
  const invalidCountElement = document.getElementById("invalidCount");
  
  if (totalCountElement) totalCountElement.textContent = totalCount;
  if (invalidCountElement) invalidCountElement.textContent = invalidCount;
}

// 更新失效书签UI
function updateInvalidBookmarksUI() {
  const hasInvalidBookmarks = checkingStatus.results.some(result => !result.status);
  const invalidBookmarks = document.getElementById('invalidBookmarks');
  
  if (invalidBookmarks) {
    invalidBookmarks.style.display = hasInvalidBookmarks ? 'block' : 'none';
    if (hasInvalidBookmarks) {
      try {
        populateInvalidList();
      } catch (error) {
        console.error('填充失效书签列表时出错:', error);
      }
    } else {
      const invalidList = document.getElementById('invalidList');
      if (invalidList) invalidList.innerHTML = '';
    }
  }
}

// 创建书签文件夹
function createBookmarkFolder(parentId, title) {
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.bookmarks) {
      reject(new Error("浏览器书签API不可用"));
      return;
    }

    try {
      chrome.bookmarks.create(
        {
          parentId: parentId,
          title: title,
        },
        resolve
      );
    } catch (error) {
      reject(error);
    }
  });
}

// 获取所有书签
function getAllBookmarks() {
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.bookmarks) {
      reject(new Error("浏览器书签API不可用"));
      return;
    }

    try {
      chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
        resolve(bookmarkTreeNodes);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 导出书签为HTML格式
async function exportBookmarksAsHTML(selectedFolder = 'all') {
  try {
    const bookmarks = await getAllBookmarks();
    let htmlContent = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    htmlContent += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    htmlContent += '<TITLE>Bookmarks</TITLE>\n';
    htmlContent += '<H1>Bookmarks</H1>\n';
    htmlContent += '<DL><p>\n';

    function processNode(node, level = 0) {
      const indent = '    '.repeat(level);
      
      // 如果选择了特定文件夹，找到该文件夹并只处理其内容
      if (selectedFolder !== 'all') {
        if (node.id === selectedFolder) {
          // 找到选中的文件夹，处理其内容
          if (node.children) {
            htmlContent += `${indent}<DT><H3>${node.title}</H3>\n`;
            htmlContent += `${indent}<DL><p>\n`;
            // 处理文件夹内的所有内容（包括书签和子文件夹）
            node.children.forEach(child => {
              if (child.url) {
                // 处理书签
                htmlContent += `${indent}    <DT><A HREF="${child.url}">${child.title}</A>\n`;
              } else if (child.children) {
                // 递归处理子文件夹
                processNode(child, level + 1);
              }
            });
            htmlContent += `${indent}</DL><p>\n`;
          }
          return true;
        } else if (node.children) {
          // 在子节点中继续查找选中的文件夹
          for (const child of node.children) {
            if (processNode(child, level)) {
              return true;
            }
          }
        }
        return false;
      } else {
        // 处理所有书签
        if (node.children) {
          htmlContent += `${indent}<DT><H3>${node.title}</H3>\n`;
          htmlContent += `${indent}<DL><p>\n`;
          node.children.forEach(child => processNode(child, level + 1));
          htmlContent += `${indent}</DL><p>\n`;
        } else if (node.url) {
          htmlContent += `${indent}<DT><A HREF="${node.url}">${child.title}</A>\n`;
        }
      }
    }

    // 开始处理书签
    bookmarks[0].children.forEach(node => processNode(node));
    htmlContent += '</DL><p>';

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `edge_bookmarks_${date}.html`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
    showMessage('书签导出成功！');
  } catch (error) {
    showMessage('导出失败: ' + error.message);
  }
}

//CSV 导出函数
async function exportBookmarksAsCSV(selectedFolder = 'all') {
  try {
    const bookmarks = await getAllBookmarks();
    let csvContent = '标题,网址,文件夹\n';

    function processNode(node, folderPath = '') {
      // 如果选择了特定文件夹，找到该文件夹并只处理其内容
      if (selectedFolder !== 'all') {
        if (node.id === selectedFolder) {
          // 找到选中的文件夹，处理其内容
          if (node.children) {
            const newPath = node.title;
            node.children.forEach(child => {
              if (child.url) {
                // 处理书签
                const title = child.title.replace(/"/g, '""');
                csvContent += `"${title}","${child.url}","${newPath}"\n`;
              } else if (child.children) {
                // 递归处理子文件夹
                processNode(child, `${newPath}/${child.title}`);
              }
            });
          }
          return true;
        } else if (node.children) {
          // 在子节点中继续查找选中的文件夹
          for (const child of node.children) {
            if (processNode(child, folderPath)) {
              return true;
            }
          }
        }
        return false;
      } else {
        // 处理所有书签
        if (node.url) {
          const title = node.title.replace(/"/g, '""');
          csvContent += `"${title}","${node.url}","${folderPath}"\n`;
        } else if (node.children) {
          const newPath = folderPath ? `${folderPath}/${node.title}` : node.title;
          node.children.forEach(child => processNode(child, newPath));
        }
      }
    }

    bookmarks[0].children.forEach(node => processNode(node));

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `edge_bookmarks_${date}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
    showMessage('书签导出成功！');
  } catch (error) {
    showMessage('导出失败: ' + error.message);
  }
}

// 修改 Markdown 导出函数
async function exportBookmarksAsMarkdown(selectedFolder = 'all') {
  try {
    const bookmarks = await getAllBookmarks();
    let mdContent = '# 书签列表\n\n';

    function processNode(node, level = 1) {
      // 如果选择了特定文件夹，找到该文件夹并只处理其内容
      if (selectedFolder !== 'all') {
        if (node.id === selectedFolder) {
          // 找到选中的文件夹，处理其内容
          if (node.children) {
            mdContent += `## ${node.title}\n\n`;
            node.children.forEach(child => {
              if (child.url) {
                // 处理书签
                mdContent += `${'  '.repeat(level - 1)}- [${child.title}](${child.url})\n`;
              } else if (child.children) {
                // 递归处理子文件夹
                mdContent += `\n### ${child.title}\n\n`;
                processNode(child, level + 1);
              }
            });
          }
          return true;
        } else if (node.children) {
          // 在子节点中继续查找选中的文件夹
          for (const child of node.children) {
            if (processNode(child, level)) {
              return true;
            }
          }
        }
        return false;
      } else {
        // 处理所有书签
        if (node.url) {
          mdContent += `${'  '.repeat(level - 1)}- [${node.title}](${node.url})\n`;
        } else if (node.children) {
          if (node.title) {
            mdContent += `\n${'#'.repeat(level)} ${node.title}\n\n`;
          }
          node.children.forEach(child => processNode(child, level + 1));
        }
      }
    }

    bookmarks[0].children.forEach(node => processNode(node));

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `edge_bookmarks_${date}.md`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
    showMessage('书签导出成功！');
  } catch (error) {
    showMessage('导出失败: ' + error.message);
  }
}

// 修改原有的exportBookmarks函数名为exportBookmarksAsJSON
async function exportBookmarksAsJSON(selectedFolder = 'all') {
  try {
    const bookmarks = await getAllBookmarks();
    
    // 如果选择了特定文件夹，筛选书签
    let bookmarksToExport = bookmarks;
    if (selectedFolder !== 'all') {
      // 为节点添加路径信息
      addPathToNodes(bookmarks);
      
      // 筛选出选定文件夹下的书签
      bookmarksToExport = filterBookmarksByFolder(bookmarks, selectedFolder);
    }
    
    const bookmarksJson = JSON.stringify(bookmarksToExport, null, 2);

    const blob = new Blob([bookmarksJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `edge_bookmarks_${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
    showMessage('书签导出成功！');
  } catch (error) {
    showMessage('导出失败: ' + error.message);
  }
}

// 筛选特定文件夹下的书签
function filterBookmarksByFolder(bookmarks, folderId) {
  // 查找指定文件夹
  function findFolder(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const found = findFolder(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }
  
  // 查找指定文件夹
  const folder = findFolder(bookmarks, folderId);
  if (!folder) return bookmarks; // 如果找不到文件夹，返回所有书签
  
  // 创建一个新的书签树，只包含选定的文件夹
  return [folder];
}

// 显示消息函数
function showMessage(text, isError = false) {
  const messageElement = document.getElementById("message");
  if (!messageElement) return; 
  
  const notificationArea = document.querySelector(".notification-area");
  if (notificationArea) {
    notificationArea.style.display = "block";
  }
  messageElement.textContent = text;
  messageElement.className = "message" + (isError ? " error" : " success");
  setTimeout(() => {
    if (document.body.contains(messageElement)) {
      messageElement.textContent = "";
      messageElement.className = "message";
      if (notificationArea) {
        notificationArea.style.display = "none";
      }
    }
  }, 3000);
}
// 检测URL是否可访问
async function checkUrlAvailability(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store" 
    });

    clearTimeout(timeoutId); 
    return true;
  } catch (error) {
    return false;
  }
}

// 递归获取所有书签URL
function getAllBookmarkUrls(nodes, urls = [], selectedFolder = "all") {
  for (const node of nodes) {
    if (node.url) {
      // 如果选择了特定文件夹，且当前节点不在该文件夹下，则跳过
      if (selectedFolder !== "all" && !isNodeInFolder(node, selectedFolder)) {
        continue;
      }
      urls.push({
        title: node.title,
        url: node.url,
        parentId: node.parentId,
      });
    }

    if (node.children) {
      getAllBookmarkUrls(node.children, urls, selectedFolder);
    }
  }

  return urls;
}

// 判断节点是否在指定文件夹或其子文件夹中
function isNodeInFolder(node, folderId) {
  // 检查当前节点的父ID是否匹配
  if (node.parentId === folderId) {
    return true;
  }

  // 检查节点的路径
  if (node.path && Array.isArray(node.path)) {
    return node.path.includes(folderId);
  }

  return false;
}

// 递归获取所有书签文件夹
function getAllBookmarkFolders(nodes, folders = []) {
  for (const node of nodes) {
    // 如果节点有子节点但没有URL，则认为是文件夹
    if (node.children && !node.url) {
      folders.push({
        id: node.id,
        title: node.title,
      });

      // 递归处理子节点
      getAllBookmarkFolders(node.children, folders);
    }
  }

  return folders;
}

// 初始化文件夹选择下拉菜单
async function initFolderSelect() {
  try {
    const folderSelect = document.getElementById("folderSelect");
    if (!folderSelect) return;

    // 完全清空下拉菜单
    folderSelect.innerHTML = '';
    
    // 重新添加"全部文件夹"选项
    const allFoldersOption = document.createElement("option");
    allFoldersOption.value = "all";
    allFoldersOption.textContent = "全部文件夹";
    folderSelect.appendChild(allFoldersOption);

    // 获取所有书签
    const bookmarks = await getAllBookmarks();

    // 获取所有文件夹
    const folders = getAllBookmarkFolders(bookmarks);

    // 按文件夹名称排序
    folders.sort((a, b) => a.title.localeCompare(b.title));

    // 添加文件夹选项，确保每个文件夹都有标题
    folders.forEach((folder) => {
      // 跳过没有标题的文件夹
      if (!folder.title) return;
      
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.title;
      folderSelect.appendChild(option);
    });
  } catch (error) {
    console.error("初始化文件夹选择失败:", error);
    showMessage("加载文件夹失败", true);
  }
}

// 页面加载完成后添加事件监听器
document.addEventListener("DOMContentLoaded", async () => {

  const notificationArea = document.querySelector(".notification-area");
  if (notificationArea) {
    notificationArea.style.display = "none";
  }
  // 导出按钮点击事件处理
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', showExportModal);
  }
  const exportFormat = document.getElementById('exportFormat');
  const folderSelect = document.getElementById('folderSelect');

  if (exportBtn && exportFormat) {
    exportBtn.addEventListener('click', async () => {
      const format = exportFormat.value;
      const selectedFolder = folderSelect ? folderSelect.value : 'all';
      switch (format) {
        case 'json':
          await exportBookmarksAsJSON(selectedFolder);
          break;
        case 'html':
          await exportBookmarksAsHTML(selectedFolder);
          break;
        case 'csv':
          await exportBookmarksAsCSV(selectedFolder);
          break;
        case 'markdown':
          await exportBookmarksAsMarkdown(selectedFolder);
          break;
        default:
          showMessage('不支持的导出格式');
      }
    });
  }

  // 从存储中获取之前的检测结果
  try {
    const data = await chrome.storage.local.get("bookmarkCheckResults");
    if (data.bookmarkCheckResults) {
      checkingStatus = data.bookmarkCheckResults;

      // 如果有之前的检测结果，显示它们
      if (checkingStatus.results && checkingStatus.results.length > 0) {
        displayResults();

        // 如果之前正在检测中，但现在页面重新加载了，重置检测状态
        if (checkingStatus.isChecking) {
          checkingStatus.isChecking = false;
          hideProgressBar();
          enableButtons();
        }
      }
    }
  } catch (error) {
    console.error("恢复检测结果时出错:", error);
  }


  // 导入文件选择事件监听
  const importFile = document.getElementById("importFile");
  if (importFile) {
    importFile.addEventListener("change", importBookmarks);
  }

  // 检测网址可用性按钮事件监听
  const checkUrlsBtn = document.getElementById("checkUrlsBtn");
  if (checkUrlsBtn) {
    checkUrlsBtn.addEventListener("click", checkAllBookmarkUrls);
  }

  // 初始化文件夹选择下拉菜单
  initFolderSelect();

  // 文件夹选择变化事件监听
  if (folderSelect) {
    folderSelect.addEventListener("change", function () {
      // 清空结果显示
      const resultsContainer = document.getElementById("resultsContainer");
      if (resultsContainer) resultsContainer.innerHTML = "";
    });
  }

  // 从localStorage加载检测状态
  loadCheckingStatus();

  // 添加visibilitychange事件监听，处理页面切换
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      // 页面变为可见时，恢复检测状态
      restoreCheckingState();
      // 如果检测正在进行中，继续检测
      if (checkingStatus.isChecking && !checkingStatus.shouldCancel) {
        setTimeout(backgroundCheckUrls, 0);
      }
    } else {
      // 页面变为不可见时，保存检测状态
      if (checkingStatus.isChecking) {
        saveCheckingStatus();
      }
    }
  });

  // 在页面加载时检查是否应该打开独立窗口
  const isPopup = location.pathname.endsWith("popup.html");

  // 检查是否已经有独立窗口打开
  const data = await chrome.storage.local.get("detachedWindowId");
  const detachedWindowId = data.detachedWindowId;

  // 如果是在popup中运行，并且没有独立窗口，则添加"保持打开"按钮
  if (isPopup) {
    // 添加"保持打开"按钮
    const header = document.querySelector(".header");
    if (header) {
      const keepOpenBtn = document.createElement("button");
      keepOpenBtn.id = "keepOpenBtn";
      keepOpenBtn.className = "btn small-btn";
      keepOpenBtn.innerHTML = '<i class="bi bi-pin-angle"></i> 保持打开';
      keepOpenBtn.title = "在独立窗口中打开";
      keepOpenBtn.style.marginLeft = "auto";
      keepOpenBtn.style.width = "100px";
      // 将按钮添加到header
      header.appendChild(keepOpenBtn);

      // 添加点击事件
      keepOpenBtn.addEventListener("click", function () {
        // 打开独立窗口
        openDetachedWindow();
        // 关闭当前popup
        window.close();
      });
    }
  }

  // 如果是在独立窗口中运行，添加关闭按钮
  if (!isPopup) {
    const header = document.querySelector(".header");
    if (header) {
      const closeBtn = document.createElement("button");
      closeBtn.id = "closeBtn";
      closeBtn.className = "btn small-btn";
      closeBtn.innerHTML = '<i class="bi bi-x-lg"></i> 关闭';
      closeBtn.title = "关闭窗口";

      // 将按钮添加到header
      header.appendChild(closeBtn);

      // 添加点击事件
      closeBtn.addEventListener("click", function () {
        window.close();
      });
    }
  }

  // 获取失效书签管理区域的按钮元素
  const recheckAllBtn = document.getElementById("recheckAllBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");

  // 为"全部重新检测"按钮添加点击事件监听器
  if (recheckAllBtn) {
    recheckAllBtn.addEventListener("click", async () => {
      // 获取当前显示的失效书签列表
      const invalidBookmarks = document.querySelectorAll(
        "#invalidList .invalid-bookmark-item"
      );

      if (invalidBookmarks.length === 0) {
        showMessage("没有需要重新检测的书签", "info");
        return;
      }

      // 显示进度条
      showProgressBar();
      updateProgress(0, invalidBookmarks.length);

      // 收集所有失效书签的URL和ID
      const bookmarksToCheck = [];
      invalidBookmarks.forEach((item) => {
        bookmarksToCheck.push({
          id: item.dataset.bookmarkId,
          url: item.dataset.url,
        });
      });

      // 重新检测所有失效书签
      let validCount = 0;
      for (let i = 0; i < bookmarksToCheck.length; i++) {
        const bookmark = bookmarksToCheck[i];
        const isValid = await checkUrl(bookmark.url);

        // 更新进度
        updateProgress(i + 1, bookmarksToCheck.length);

        // 如果书签变为有效，从失效列表中移除
        if (isValid) {
          const itemToRemove = document.querySelector(
            `#invalidList [data-bookmark-id="${bookmark.id}"]`
          );
          if (itemToRemove) {
            itemToRemove.remove();
            validCount++;
          }
        }
      }

      // 隐藏进度条
      hideProgressBar();

      // 更新消息
      if (validCount > 0) {
        showMessage(`重新检测完成，${validCount}个书签恢复有效`, "success");
      } else {
        showMessage("重新检测完成，没有书签恢复有效", "info");
      }

      // 如果没有失效书签了，隐藏失效书签管理区域
      if (
        document.querySelectorAll("#invalidList .invalid-bookmark-item")
          .length === 0
      ) {
        document.getElementById("invalidBookmarks").style.display = "none";
      }
    });
  }

  // 为"全部删除"按钮添加点击事件监听器
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", async () => {
      // 获取当前显示的失效书签列表
      const invalidBookmarks = document.querySelectorAll(
        "#invalidList .invalid-bookmark-item"
      );

      if (invalidBookmarks.length === 0) {
        showMessage("没有需要删除的书签", "info");
        return;
      }

      // 确认是否删除
      if (
        !confirm(
          `确定要删除所有${invalidBookmarks.length}个失效书签吗？此操作不可撤销。`
        )
      ) {
        return;
      }

      // 收集所有失效书签的ID
      const bookmarkIdsToDelete = [];
      invalidBookmarks.forEach((item) => {
        bookmarkIdsToDelete.push(item.dataset.bookmarkId);
      });

      // 删除所有失效书签
      let deletedCount = 0;
      for (const id of bookmarkIdsToDelete) {
        try {
          await chrome.bookmarks.remove(id);
          deletedCount++;
        } catch (error) {
          console.error(`删除书签 ${id} 时出错:`, error);
        }
      }

      // 从结果中移除已删除的书签
      const urlsToDelete = Array.from(invalidBookmarks).map(
        (item) => item.dataset.url
      );
      checkingStatus.results = checkingStatus.results.filter(
        (result) => !urlsToDelete.includes(result.url)
      );

      // 清空失效书签列表 - 使用安全的方式
      const invalidList = document.getElementById("invalidList");
      if (invalidList) {
        invalidList.innerHTML = "";
      }

      // 隐藏失效书签管理区域
      const invalidBookmarksSection = document.getElementById("invalidBookmarks");
      if (invalidBookmarksSection) {
        invalidBookmarksSection.style.display = "none";
      }

      // 更新UI
      updateResultsUI();

      // 保存状态
      saveCheckResults();

      // 更新消息
      showMessage(`成功删除${deletedCount}个失效书签`);
    });
  }

  // 添加自定义样式以确保检测列表正确显示
  addCustomStyles();
});

// 添加一个安全的元素移除函数
function safeRemoveElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
    return true;
  }
  return false;
}
// 修改检测所有书签URL的可用性函数
async function checkAllBookmarkUrls() {
  // 如果已经在检测中，则显示取消按钮
  if (checkingStatus.isChecking) {
    // 防止重复点击
    if (checkingStatus.shouldCancel) return;

    // 立即禁用按钮，防止重复点击
    const checkUrlsBtn = document.getElementById("checkUrlsBtn");
    if (checkUrlsBtn) {
      checkUrlsBtn.disabled = true;
      checkUrlsBtn.classList.add("disabled-btn");
    }

    checkingStatus.shouldCancel = true;
    // 取消任何待处理的UI更新
    window.updateResultsPending = false;
    showMessage("正在取消检测...");
    return;
  }

  try {
    // 显示进度容器
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const resultsContainer = document.getElementById("resultsContainer");
    const checkUrlsBtn = document.getElementById("checkUrlsBtn");

    if (progressContainer) progressContainer.style.display = "block";
    if (resultsContainer) resultsContainer.innerHTML = "";

    // 更改按钮文本为"取消检测"
    if (checkUrlsBtn) {
      checkUrlsBtn.innerHTML = '<i class="bi bi-x-circle"></i> 取消检测';
    }

    // 设置检测状态
    checkingStatus.isChecking = true;
    checkingStatus.shouldCancel = false;

    // 获取选定的文件夹
    const folderSelect = document.getElementById("folderSelect");
    const selectedFolder = folderSelect ? folderSelect.value : "all";

    // 获取所有书签
    const bookmarks = await getAllBookmarks();

    // 为每个节点添加路径信息
    addPathToNodes(bookmarks);

    // 获取符合条件的书签URL
    const bookmarkUrls = getAllBookmarkUrls(bookmarks, [], selectedFolder);

    if (bookmarkUrls.length === 0) {
      showMessage("没有找到书签", true);
      if (progressContainer) progressContainer.style.display = "none";
      resetCheckingStatus();
      return;
    }

    // 初始化检测状态
    checkingStatus.checkedCount = 0;
    checkingStatus.totalCount = bookmarkUrls.length;
    checkingStatus.progress = 0;
    checkingStatus.results = [];

    // 初始化结果数组
    bookmarkUrls.forEach((bookmark) => {
      checkingStatus.results.push({
        title: bookmark.title,
        url: bookmark.url,
        status: null, // null表示正在检测
      });
    });

    // 保存初始状态到localStorage
    saveCheckingStatus();

    // 显示初始结果
    updateCheckingResults();

    // 启动后台检测
    setTimeout(backgroundCheckUrls, 0);
  } catch (error) {
    showMessage("检测过程中出错: " + error.message, true);
    const progressContainer = document.getElementById("progressContainer");
    if (progressContainer) progressContainer.style.display = "none";

    // 重置按钮文本
    const checkUrlsBtn = document.getElementById("checkUrlsBtn");
    if (checkUrlsBtn) {
      checkUrlsBtn.innerHTML =
        '<i class="bi bi-check-circle"></i> 检测网址可用性';
    }

    // 重置检测状态
    resetCheckingStatus();
    // 清除localStorage中的状态
    localStorage.removeItem("bookmarkCheckingStatus");
  }
}

// 为书签树中的每个节点添加路径信息
function addPathToNodes(nodes, parentPath = []) {
  for (const node of nodes) {
    // 为当前节点添加路径
    node.path = [...parentPath];

    // 如果是文件夹，将其ID添加到子节点的路径中
    if (node.children) {
      addPathToNodes(node.children, [...node.path, node.id]);
    }
  }
}

// 重置检测状态
function resetCheckingStatus() {
  checkingStatus.isChecking = false;
  checkingStatus.shouldCancel = false;
  checkingStatus.progress = 0;
  checkingStatus.checkedCount = 0;
  checkingStatus.totalCount = 0;
  // checkingStatus.results = [];

  // 重置按钮文本
  const checkUrlsBtn = document.getElementById("checkUrlsBtn");
  if (checkUrlsBtn) {
    checkUrlsBtn.innerHTML =
      '<i class="bi bi-check-circle"></i> 检测网址可用性';
  }
}

// 恢复检测状态到UI
function restoreCheckingState() {
  // 如果没有正在进行的检测，则不需要恢复
  if (!checkingStatus.isChecking) {
    // 确保清除localStorage中的状态
    localStorage.removeItem("bookmarkCheckingStatus");
    return;
  }

  // 如果检测已被取消，则完成检测
  if (checkingStatus.shouldCancel) {
    finishChecking(true);
    return;
  }

  // 恢复UI状态
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const checkUrlsBtn = document.getElementById("checkUrlsBtn");
  const resultsContainer = document.getElementById("resultsContainer");

  if (progressContainer) {
    progressContainer.style.display = "block";
    if (progressBar) progressBar.style.width = `${checkingStatus.progress}%`;
    if (progressText)
      progressText.textContent = `${checkingStatus.progress}% (${checkingStatus.checkedCount}/${checkingStatus.totalCount})`;
  }

  // 更改按钮文本为"取消检测"
  if (checkUrlsBtn) {
    checkUrlsBtn.innerHTML = '<i class="bi bi-x-circle"></i> 取消检测';
    checkUrlsBtn.disabled = false;
    checkUrlsBtn.classList.remove("disabled-btn");
  }

  // 清空并更新结果显示
  if (resultsContainer) {
    resultsContainer.innerHTML = "";
    updateCheckingResults();
  }
}

// 保存检测状态到localStorage
function saveCheckingStatus() {
  localStorage.setItem(
    "bookmarkCheckingStatus",
    JSON.stringify(checkingStatus)
  );
}

// 从localStorage加载检测状态
function loadCheckingStatus() {
  const savedStatus = localStorage.getItem("bookmarkCheckingStatus");
  if (savedStatus) {
    try {
      const parsedStatus = JSON.parse(savedStatus);

      // 检查是否处于取消状态或已完成状态
      if (parsedStatus.shouldCancel || !parsedStatus.isChecking) {
        // 清除状态并返回
        localStorage.removeItem("bookmarkCheckingStatus");
        return;
      }

      // 合并保存的状态到当前状态
      checkingStatus = { ...parsedStatus };

      // 确保UI元素已经加载
      setTimeout(() => {
        // 恢复UI状态
        restoreCheckingState();
      }, 100);
    } catch (error) {
      console.error("加载检测状态失败:", error);
      // 如果加载失败，清除localStorage中的数据
      localStorage.removeItem("bookmarkCheckingStatus");
    }
  }
}

// 后台检测URL的可用性 - 优化版本，减少UI更新频率
async function backgroundCheckUrls() {
  // 如果没有正在进行的检测，则返回
  if (!checkingStatus.isChecking) return;

  // 如果检测已被取消，立即完成检测
  if (checkingStatus.shouldCancel) {
    finishChecking(true);
    return;
  }

  // 获取未检测完成的URL
  const pendingUrls = [];
  checkingStatus.results.forEach((result, index) => {
    if (result.status === null) {
      pendingUrls.push({ index, url: result.url });
    }
  });

  // 如果没有待检测的URL，则完成检测
  if (pendingUrls.length === 0) {
    finishChecking();
    return;
  }

  // 增加批量大小，减少批次数量和UI更新频率
  const batchSize = 10; // 增加批量大小
  const batch = pendingUrls.slice(0, batchSize);

  // 收集所有状态更新，一次性应用
  const statusUpdates = [];

  // 检测批次中的URL
  const checkPromises = batch.map(async (item) => {
    // 如果用户取消了检测，则不再继续检测
    if (checkingStatus.shouldCancel) return;

    const isAvailable = await checkUrlAvailability(item.url);

    // 如果用户取消了检测，则不更新结果
    if (checkingStatus.shouldCancel) return;

    // 收集状态更新，而不是立即应用
    statusUpdates.push({
      index: item.index,
      status: isAvailable,
    });
  });

  try {
    await Promise.all(checkPromises);

    // 再次检查是否已取消，避免不必要的状态更新
    if (checkingStatus.shouldCancel) {
      finishChecking(true);
      return;
    }

    // 一次性应用所有状态更新
    // 确保只有首次更新状态时才增加计数，防止重复计算
    statusUpdates.forEach((update) => {
      // 只有当状态从null变为true或false时才增加计数
      if (checkingStatus.results[update.index].status === null) {
        checkingStatus.checkedCount++;
      }
      checkingStatus.results[update.index].status = update.status;
    });
  } catch (error) {
    console.error("检测URL时出错:", error);
  }

  // 再次检查是否已取消，避免不必要的UI更新
  if (checkingStatus.shouldCancel) {
    finishChecking(true);
    return;
  }

  // 使用更严格的节流控制UI更新频率
  // 只在完成一定数量的检测后更新UI
  const updateThreshold = Math.max(
    5,
    Math.floor(checkingStatus.totalCount * 0.05)
  ); // 至少5个或总数的5%

  // 使用计数器跟踪自上次UI更新以来检查的URL数量
  window.urlsCheckedSinceLastUpdate =
    (window.urlsCheckedSinceLastUpdate || 0) + statusUpdates.length;

  // 只有当累计检查的URL数量达到阈值或是最后一批时才更新UI
  if (
    window.urlsCheckedSinceLastUpdate >= updateThreshold ||
    pendingUrls.length <= batchSize
  ) {
    if (!window.progressUpdateScheduled) {
      window.progressUpdateScheduled = true;

      // 使用requestAnimationFrame确保在下一帧渲染
      requestAnimationFrame(() => {
        updateCheckingProgress();
        window.progressUpdateScheduled = false;
        window.urlsCheckedSinceLastUpdate = 0; // 重置计数器

        // 保存状态到localStorage
        saveCheckingStatus();
      });
    }
  }

  // 增加批次间隔时间，减轻浏览器渲染压力
  if (!checkingStatus.shouldCancel) {
    // 统一使用较长的延迟，确保浏览器有足够时间完成渲染
    const delayTime = 300; // 增加延迟时间
    await new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  // 使用setTimeout而不是立即调用，给浏览器更多时间进行渲染
  setTimeout(backgroundCheckUrls, 100); // 增加间隔时间
}

// 更新检测进度
function updateCheckingProgress() {
  // 计算进度百分比
  checkingStatus.progress = Math.floor(
    (checkingStatus.checkedCount / checkingStatus.totalCount) * 100
  );

  // 更新进度条
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (progressBar) progressBar.style.width = `${checkingStatus.progress}%`;
  if (progressText)
    progressText.textContent = `${checkingStatus.progress}% (${checkingStatus.checkedCount}/${checkingStatus.totalCount})`;

  // 更新检测结果显示
  updateCheckingResults();
}

// 更新检测结果显示 - 使用虚拟DOM和批量渲染技术
function updateCheckingResults() {
  const resultsContainer = document.getElementById("resultsContainer");
  if (!resultsContainer) return;

  // 防止过于频繁的更新，使用节流控制
  if (window.resultsUpdateThrottled) return;
  window.resultsUpdateThrottled = true;

  // 使用requestAnimationFrame确保在下一帧渲染
  requestAnimationFrame(() => {
    // 如果容器为空，使用虚拟DOM一次性构建
    if (!resultsContainer.children.length) {
      // 创建离线文档片段，减少重排重绘
      const fragment = document.createDocumentFragment();

      // 预先计算所有项，避免渲染过程中的计算
      const items = checkingStatus.results.map((result, index) => {
        return createUrlItem(result, index);
      });

      // 批量添加到文档片段
      items.forEach((item) => fragment.appendChild(item));

      // 一次性添加到DOM
      resultsContainer.appendChild(fragment);
    } else {
      // 使用增量更新策略，只更新状态变化的项
      // 创建更新批次，减少DOM操作次数
      const updates = [];

      checkingStatus.results.forEach((result, index) => {
        const existingItem = resultsContainer.children[index];
        if (!existingItem) return;

        const urlStatus = existingItem.querySelector(".url-status");
        if (!urlStatus) return;

        // 只在状态发生变化时收集更新
        const currentStatus = urlStatus.getAttribute("data-status");
        const newStatus = getStatusString(result.status);

        if (currentStatus !== newStatus) {
          updates.push({ element: urlStatus, status: result.status });
        }
      });

      // 如果有更新，使用一个微任务批量应用
      if (updates.length > 0) {
        // 使用微任务确保在当前帧结束前应用所有更新
        Promise.resolve().then(() => {
          updates.forEach((update) => {
            updateUrlItemStatus(update.element, update.status);
          });
        });
      }
    }

    // 200ms后允许下一次更新，减少更新频率
    setTimeout(() => {
      window.resultsUpdateThrottled = false;
    }, 200);
  });
}

// 修改createUrlItem函数，确保正确返回URL项元素
function createUrlItem(result, index) {
  // 创建URL项元素
  const urlItem = document.createElement("div");
  urlItem.className = "url-item";
  urlItem.setAttribute("data-index", index);
  urlItem.setAttribute("data-url", result.url); // 添加data-url属性

  // 创建标题元素
  const urlTitle = document.createElement("div");
  urlTitle.className = "url-title";
  urlTitle.textContent = result.title || "无标题";

  // 创建状态元素
  const urlStatus = document.createElement("div");
  const statusString = getStatusString(result.status);
  const statusClass = getStatusClass(result.status);
  const statusText = getStatusText(result.status);

  urlStatus.className = "url-status " + statusClass;
  urlStatus.setAttribute("data-status", statusString);
  urlStatus.textContent = statusText;

  // 添加标题和状态到URL项
  urlItem.appendChild(urlTitle);
  urlItem.appendChild(urlStatus);

  // 为不可用的书签添加操作按钮
  if (result.status === false) {
    const actionButtons = document.createElement("div");
    actionButtons.className = "url-actions";

    // 添加新页面打开按钮
    const newTabButton = document.createElement("button");
    newTabButton.className = "action-btn new-tab-btn";
    newTabButton.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';
    newTabButton.title = "在新标签页中打开";
    newTabButton.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.tabs.create({ url: result.url });
    });

    // 添加弹出窗口打开按钮
    const popupButton = document.createElement("button");
    popupButton.className = "action-btn popup-btn";
    popupButton.innerHTML = '<i class="bi bi-window"></i>';
    popupButton.title = "在弹出窗口中打开";
    popupButton.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.windows.create({
        url: result.url,
        type: "popup",
        width: 800,
        height: 600,
      });
    });

    // 添加复制链接按钮
    const copyButton = document.createElement("button");
    copyButton.className = "action-btn copy-btn";
    copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
    copyButton.title = "复制链接";
    copyButton.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(result.url)
        .then(() => {
          // 临时改变按钮图标表示复制成功
          copyButton.innerHTML = '<i class="bi bi-check"></i>';
          setTimeout(() => {
            copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
          }, 1500);
          showMessage("链接已复制到剪贴板");
        })
        .catch((err) => {
          console.error("复制失败:", err);
          showMessage("复制失败", true);
        });
    });

    // 添加删除按钮
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-btn delete-btn";
    deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
    deleteButton.title = "删除书签";
    deleteButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      
      // 确认删除
      if (confirm(`确定要删除书签 "${result.title}" 吗？`)) {
        try {
          console.log("删除前结果数量:", checkingStatus.results.length);
          
          // 先保存结果数组的副本
          const currentResults = [...checkingStatus.results];
          
          // 获取书签ID
          const bookmarkId = await findBookmarkIdByUrl(result.url);
          if (bookmarkId) {
            // 删除书签
            await chrome.bookmarks.remove(bookmarkId);
            
            // 从副本中移除该项
            const index = currentResults.findIndex(r => r.url === result.url);
            if (index !== -1) {
              currentResults.splice(index, 1);
            }
            
            // 重新设置结果数组
            checkingStatus.results = currentResults;
            
            console.log("删除后结果数量:", checkingStatus.results.length);
            
            // 从DOM中直接移除该项
            if (urlItem && urlItem.parentNode) {
              urlItem.parentNode.removeChild(urlItem);
            }
            
            // 更新计数器
            updateCounters();
            
            // 使用延迟保存，确保保存的是修改后的状态
            setTimeout(() => {
              // 使用深拷贝保存
              const stateCopy = JSON.parse(JSON.stringify(checkingStatus));
              chrome.storage.local.set({ bookmarkCheckResults: stateCopy });
              console.log("保存后结果数量:", stateCopy.results.length);
            }, 100);
            
            showMessage('书签已删除');
          } else {
            showMessage('未找到对应的书签', true);
          }
        } catch (error) {
          console.error('删除书签时出错:', error);
          showMessage('删除书签失败: ' + error.message, true);
        }
      }
    });

    // 添加按钮到操作区域
    actionButtons.appendChild(newTabButton);
    actionButtons.appendChild(popupButton);
    actionButtons.appendChild(copyButton);
    actionButtons.appendChild(deleteButton);
    urlItem.appendChild(actionButtons);
  }

  // 返回URL项元素
  return urlItem;
}

// 根据URL查找书签ID
async function findBookmarkIdByUrl(url) {
  return new Promise((resolve, reject) => {
    try {
      chrome.bookmarks.search({ url: url }, (results) => {
        if (results && results.length > 0) {
          resolve(results[0].id);
        } else {
          resolve(null);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 更新URL项状态函数也需要修改，以处理状态变化时添加或移除操作按钮
function updateUrlItemStatus(statusElement, status) {
  // 获取当前状态
  const currentStatus = statusElement.getAttribute("data-status");
  const newStatus = getStatusString(status);

  // 只有状态真正变化时才更新DOM
  if (currentStatus !== newStatus) {
    // 批量更新DOM属性，减少重排次数
    requestAnimationFrame(() => {
      // 预先计算所有值
      const statusClass = "url-status " + getStatusClass(status);
      const statusText = getStatusText(status);

      // 一次性应用所有更改
      statusElement.setAttribute("data-status", newStatus);
      statusElement.className = statusClass;
      statusElement.textContent = statusText;

      // 获取父元素
      const urlItem = statusElement.closest(".url-item");
      if (urlItem) {
        // 获取结果索引
        const index = parseInt(urlItem.getAttribute("data-index"));
        const result = checkingStatus.results[index];

        // 如果状态变为不可用，添加操作按钮
        if (status === false) {
          // 检查是否已有操作按钮
          if (!urlItem.querySelector(".url-actions")) {
            const actionButtons = document.createElement("div");
            actionButtons.className = "url-actions";

            // 添加新页面打开按钮
            const newTabButton = document.createElement("button");
            newTabButton.className = "action-btn new-tab-btn";
            newTabButton.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';
            newTabButton.title = "在新标签页中打开";
            newTabButton.addEventListener("click", (e) => {
              e.stopPropagation();
              chrome.tabs.create({ url: result.url });
            });

            // 添加弹出窗口打开按钮
            const popupButton = document.createElement("button");
            popupButton.className = "action-btn popup-btn";
            popupButton.innerHTML = '<i class="bi bi-window"></i>';
            popupButton.title = "在弹出窗口中打开";
            popupButton.addEventListener("click", (e) => {
              e.stopPropagation();
              chrome.windows.create({
                url: result.url,
                type: "popup",
                width: 800,
                height: 600,
              });
            });

            // 添加复制链接按钮
            const copyButton = document.createElement("button");
            copyButton.className = "action-btn copy-btn";
            copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
            copyButton.title = "复制链接";
            copyButton.addEventListener("click", (e) => {
              e.stopPropagation();
              navigator.clipboard
                .writeText(result.url)
                .then(() => {
                  // 临时改变按钮图标表示复制成功
                  copyButton.innerHTML = '<i class="bi bi-check"></i>';
                  setTimeout(() => {
                    copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
                  }, 1500);
                  showMessage("链接已复制到剪贴板");
                })
                .catch((err) => {
                  console.error("复制失败:", err);
                  showMessage("复制失败", true);
                });
            });
            // 添加删除按钮
            const deleteButton = document.createElement("button");
            deleteButton.className = "action-btn delete-btn";
            deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
            deleteButton.title = "删除书签";
            deleteButton.addEventListener("click", async (e) => {
              e.stopPropagation();
              
              // 确认删除
              if (confirm(`确定要删除书签 "${result.title}" 吗？`)) {
                try {
                  // 获取书签ID
                  const bookmarkId = await findBookmarkIdByUrl(result.url);
                  if (bookmarkId) {
                    // 删除书签
                    await chrome.bookmarks.remove(bookmarkId);
                    
                    // 从结果中移除
                    const index = checkingStatus.results.findIndex(r => r.url === result.url);
                    if (index !== -1) {
                      checkingStatus.results.splice(index, 1);
                    }
                    
                    // 从UI中移除 - 使用安全的方式
                    if (urlItem && urlItem.parentNode) {
                      urlItem.parentNode.removeChild(urlItem);
                    }
                    
                    // 更新UI - 使用安全的方式
                    try {
                      updateResultsUI();
                    } catch (uiError) {
                      console.error('更新UI时出错:', uiError);
                    }
                    
                    // 保存状态
                    saveCheckResults();
                    
                    showMessage('书签已删除');
                  } else {
                    showMessage('未找到对应的书签', true);
                  }
                } catch (error) {
                  console.error('删除书签时出错:', error);
                  showMessage('删除书签失败: ' + error.message, true);
                }
              }
            });

            // 添加按钮到操作区域
            actionButtons.appendChild(newTabButton);
            actionButtons.appendChild(popupButton);
            actionButtons.appendChild(copyButton);
            actionButtons.appendChild(deleteButton);
            urlItem.appendChild(actionButtons);
          }
        } else {
          // 如果状态变为可用或检测中，移除操作按钮
          const actionButtons = urlItem.querySelector(".url-actions");
          if (actionButtons) {
            actionButtons.remove();
          }
        }
      }
    });
  }
}
// 获取状态字符串
function getStatusString(status) {
  return status === null ? "checking" : status ? "available" : "unavailable";
}

// 获取状态类名
function getStatusClass(status) {
  return status === null ? "checking" : status ? "available" : "unavailable";
}

// 获取状态文本
function getStatusText(status) {
  return status === null ? "检测中" : status ? "可用" : "不可用";
}

// 完成检测
function finishChecking(wasCancelled = false) {
  // 确保在UI更新前设置状态，防止其他函数继续更新UI
  checkingStatus.isChecking = false;

  // 隐藏进度条
  const progressContainer = document.getElementById("progressContainer");
  if (progressContainer) progressContainer.style.display = "none";

  // 重置按钮文本和状态
  const checkUrlsBtn = document.getElementById("checkUrlsBtn");
  if (checkUrlsBtn) {
    checkUrlsBtn.innerHTML =
      '<i class="bi bi-check-circle"></i> 检测网址可用性';
    checkUrlsBtn.disabled = false;
    checkUrlsBtn.classList.remove("disabled-btn");
  }

  // 如果没有取消，则显示统计结果
  if (!wasCancelled) {
    const availableCount = checkingStatus.results.filter(
      (r) => r.status === true
    ).length;
    showMessage(
      `检测完成：${availableCount}/${checkingStatus.totalCount} 个网址可用`
    );
  } else {
    // 如果是取消检测，显示取消完成的消息
    showMessage("检测已取消");

    // 清空结果容器，避免显示部分结果
    const resultsContainer = document.getElementById("resultsContainer");
    if (resultsContainer) resultsContainer.innerHTML = "";
  }

  // 取消任何待处理的UI更新
  window.updateResultsPending = false;

  // 重置检测状态
  resetCheckingStatus();
  // 清除localStorage中的状态
  localStorage.removeItem("bookmarkCheckingStatus");
}

// 修改显示结果的函数，使其使用存储的结果
function displayResults() {
  const resultsContainer = document.getElementById("resultsContainer");
  resultsContainer.innerHTML = "";

  // 显示结果区域
  document.getElementById("checkResults").style.display = "block";

  // 创建并添加每个URL项
  checkingStatus.results.forEach((result, index) => {
    const urlItem = createUrlItem(result, index);
    resultsContainer.appendChild(urlItem);
  });

  // 显示失效书签管理区域（如果有失效书签）
  const hasInvalidBookmarks = checkingStatus.results.some(
    (result) => result.status === false
  );
  document.getElementById("invalidBookmarks").style.display =
    hasInvalidBookmarks ? "block" : "none";

  // 如果有失效书签，填充失效书签列表
  if (hasInvalidBookmarks) {
    populateInvalidList();
  }
}

// 填充失效书签列表
function populateInvalidList() {
  try {
    // 获取失效书签列表容器
    const invalidList = document.getElementById('invalidList');
    if (!invalidList) return;
    
    // 清空列表
    invalidList.innerHTML = '';
    
    // 筛选出失效的书签
    const invalidBookmarks = checkingStatus.results.filter(result => result.status === false);
    
    // 为每个失效书签创建列表项
    invalidBookmarks.forEach(async (bookmark) => {
      try {
        // 查找书签ID
        const bookmarkId = await findBookmarkIdByUrl(bookmark.url);
        if (!bookmarkId) return;
        
        const item = document.createElement('div');
        item.className = 'invalid-bookmark-item';
        item.dataset.bookmarkId = bookmarkId;
        item.dataset.url = bookmark.url;
        
        const title = document.createElement('div');
        title.className = 'invalid-title';
        title.textContent = bookmark.title || '无标题';
        
        const actions = document.createElement('div');
        actions.className = 'invalid-actions-item';
        
        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = '删除书签';
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`确定要删除书签 "${bookmark.title}" 吗？`)) {
            try {
              await chrome.bookmarks.remove(bookmarkId);
              
              // 从结果中移除
              const index = checkingStatus.results.findIndex(r => r.url === bookmark.url);
              if (index !== -1) {
                checkingStatus.results.splice(index, 1);
              }
              
              // 从UI中移除 - 使用安全的方式
              if (item && item.parentNode) {
                item.parentNode.removeChild(item);
              }
              
              // 检查是否还有其他失效书签
              const remainingInvalidBookmarks = checkingStatus.results.some(r => r.status === false);
              
              // 如果没有其他失效书签，隐藏失效书签管理区域
              const invalidBookmarks = document.getElementById('invalidBookmarks');
              if (invalidBookmarks && !remainingInvalidBookmarks) {
                invalidBookmarks.style.display = 'none';
              }
              
              // 更新主结果列表中对应的项
              const resultsContainer = document.getElementById('resultsContainer');
              if (resultsContainer) {
                const resultItem = Array.from(resultsContainer.children).find(item => {
                  return item.dataset.url === bookmark.url;
                });
                
                if (resultItem && resultItem.parentNode) {
                  resultItem.parentNode.removeChild(resultItem);
                }
              }
              
              // 保存状态
              saveCheckResults();
              
              showMessage('书签已删除');
            } catch (error) {
              console.error('删除书签时出错:', error);
              showMessage('删除书签失败: ' + error.message, true);
            }
          }
        });
        
        actions.appendChild(deleteBtn);
        item.appendChild(title);
        item.appendChild(actions);
        invalidList.appendChild(item);
      } catch (error) {
        console.error('创建失效书签项时出错:', error);
      }
    });
  } catch (error) {
    console.error('填充失效书签列表时出错:', error);
  }
}

function updateResultsUI() {
  try {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return;
    if (!checkingStatus.results || checkingStatus.results.length === 0) {
      resultsContainer.innerHTML = '<div class="text-center p-3">没有找到书签</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    const urlToElement = new Map();
    Array.from(resultsContainer.children).forEach(item => {
      const url = item.getAttribute('data-url');
      if (url) urlToElement.set(url, item);
    });
    
    checkingStatus.results.forEach((result, index) => {
      let urlItem;
      if (urlToElement.has(result.url)) {
        urlItem = urlToElement.get(result.url);
        urlToElement.delete(result.url);
        
        urlItem.setAttribute('data-index', index);
        const titleElement = urlItem.querySelector('.url-title');
        if (titleElement) titleElement.textContent = result.title || '无标题';
        const statusElement = urlItem.querySelector('.url-status');
        if (statusElement) updateUrlItemStatus(statusElement, result.status);
      } else {
        urlItem = createUrlItem(result, index);
      }
      fragment.appendChild(urlItem);
    });
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(fragment);
  } catch (error) {
    console.error('更新结果UI时出错:', error);
  }
}

// 保存检测结果到存储
function saveCheckResults() {
  // 确保不保存空结果
  if (!checkingStatus.results || checkingStatus.results.length === 0) {
    console.warn("避免保存空结果数组");
    return;
  }
  
  // 创建深拷贝，避免引用问题
  const stateCopy = JSON.parse(JSON.stringify(checkingStatus));
  console.log("保存状态，结果数量:", stateCopy.results.length);
  chrome.storage.local.set({ bookmarkCheckResults: stateCopy });
}

// 打开独立窗口的函数
async function openDetachedWindow() {
  // 获取当前窗口的位置和大小
  const currentWindow = await chrome.windows.getCurrent();

  // 创建新窗口
  const newWindow = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html?detached=true"),
    type: "popup",
    width: 450,
    height: 600,
    left: currentWindow.left + 50,
    top: currentWindow.top + 50,
  });

  // 保存新窗口ID
  await chrome.storage.local.set({ detachedWindowId: newWindow.id });
}

// 在窗口关闭时清除存储的窗口ID
window.addEventListener("beforeunload", function () {
  // 检查是否是独立窗口
  const isDetached =
    new URLSearchParams(window.location.search).get("detached") === "true";

  if (isDetached) {
    chrome.storage.local.remove("detachedWindowId");
  }
});
function addCustomStyles() {
  // 获取用户设置的主题色
  chrome.storage.sync.get(['themeColor'], function(result) {
    const themeColor = result.themeColor || '#4285f4'; // 默认使用蓝色
    
    // 创建样式元素
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :root {
        --theme-color: ${themeColor};
        --theme-color-light: ${themeColor}33;
      }
      
      .btn-primary, .badge-primary {
        background-color: var(--theme-color) !important;
        border-color: var(--theme-color) !important;
      }
      
      .text-primary {
        color: var(--theme-color) !important;
      }
      
      .btn-outline-primary {
        color: var(--theme-color) !important;
        border-color: var(--theme-color) !important;
      }
      
      .btn-outline-primary:hover {
        background-color: var(--theme-color-light) !important;
      }
    `;
    
    // 将样式添加到文档头部
    document.head.appendChild(styleElement);
  });
}

// 显示导出书签弹框
function showExportModal() {
  // 创建模态框HTML
  const modalHTML = `
    <div class="modal-overlay" id="exportModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>导出书签</h3>
          <button class="modal-close-btn" id="modalCloseBtn">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-content">
          <div class="modal-section">
            <label for="modalExportFormat">导出格式：</label>
            <select id="modalExportFormat" class="modal-select">
              <option value="json">JSON格式</option>
              <option value="html">HTML格式</option>
              <option value="csv">CSV格式</option>
              <option value="markdown">Markdown格式</option>
            </select>
          </div>
          <div class="modal-section">
            <label for="modalFolderSelect">选择文件夹：</label>
            <select id="modalFolderSelect" class="modal-select">
              <option value="all">全部文件夹</option>
              <!-- 文件夹选项将通过JavaScript动态添加 -->
            </select>
          </div>
          <div class="modal-buttons">
            <button class="btn secondary-btn" id="modalCancelBtn">取消</button>
            <button class="btn primary-btn" id="modalExportBtn">导出</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 添加模态框到页面
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 获取模态框元素
  const exportModal = document.getElementById('exportModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalExportBtn = document.getElementById('modalExportBtn');
  const modalFolderSelect = document.getElementById('modalFolderSelect');
  
  // 关闭模态框函数
  const closeModal = () => {
    if (exportModal) {
      document.body.removeChild(exportModal);
    }
  };
  
  // 添加事件监听器
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  
  // 导出按钮点击事件
  modalExportBtn.addEventListener('click', async () => {
    const formatSelect = document.getElementById('modalExportFormat');
    const format = formatSelect.value;
    const selectedFolder = modalFolderSelect.value;
    
    // 关闭模态框
    closeModal();
    
    // 根据选择的格式导出书签
    switch (format) {
      case 'json':
        await exportBookmarksAsJSON(selectedFolder);
        break;
      case 'html':
        await exportBookmarksAsHTML(selectedFolder);
        break;
      case 'csv':
        await exportBookmarksAsCSV(selectedFolder);
        break;
      case 'markdown':
        await exportBookmarksAsMarkdown(selectedFolder);
        break;
      default:
        showMessage('不支持的导出格式');
    }
  });
  
  // 获取并添加文件夹选项
  chrome.bookmarks.getTree(async (bookmarks) => {
    const folders = getAllBookmarkFolders(bookmarks);
    folders.sort((a, b) => a.title.localeCompare(b.title));
    
    folders.forEach(folder => {
      if (!folder.title) return;
      
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.title;
      modalFolderSelect.appendChild(option);
    });
  });
}

// 在您的popup.js文件中添加
document.getElementById('importBtn').addEventListener('click', function() {
  document.getElementById('importFile').click();
});