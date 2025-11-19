# 🔍 书签管理器-Bookmark Inspector 

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/your-extension-id?label=Chrome%20Store)](https://chrome.google.com/webstore/detail/your-extension-id)
[![Firefox Add-on](https://img.shields.io/amo/v/your-extension-id?label=Firefox%20Add-on)](https://addons.mozilla.org/addon/your-extension-id)

一款专注于书签健康管理的浏览器扩展，提供书签导入导出、失效检测、代理重试与多线程配置。

## ✨ 核心功能

### 🛠️ 书签检测
- **失效检测**：逐条校验书签可达性，只在主结果区域展示不可访问的链接。
- **多线程与代理**：可在 `settings.html` 中配置每批并发数量（1~20）与失败后的代理重试。
- **代理恢复**：检测完成或取消后自动清除代理配置，避免影响其它标签页。

### 🔄 导入/导出
- **格式支持**：HTML/JSON/CSV/Markdown 多格式互转 （完成√）
- **智能导入模式**：（新增√）
  - **平铺模式**：将所有书签导入到指定文件夹根目录
  - **保持结构**：完整保持原有文件夹层次结构
- **文件夹选择**：可选择导入到任意书签文件夹 （新增√）
- **直观设置界面**：主面板右上角齿轮会打开独立的 `settings.html`，用于配置代理信息与线程数。
- **云同步**：支持导出到Google Drive/Dropbox（可选）（计划中）
- **跨浏览器迁移**：一键转换Chrome↔Firefox↔Edge格式 （计划中）

### 🧹 智能清理
- 批量删除/归档失效/重复书签 （计划中）
- 自动分类建议（基于链接内容分析）（计划中）

## 🚀 快速开始

### 安装方式
1. **浏览器商店安装**  
  [Chrome Web Store](https://microsoftedge.microsoft.com/addons/detail/%E4%B9%A6%E7%AD%BE%E7%AE%A1%E7%90%86%E5%99%A8/clnomppfflgjbhmpabhknaimdndgjmhd)

2. **手动加载**  
  ```bash
  git clone https://github.com/yourusername/bookmark-inspector.git
  # 浏览器打开扩展页 → 启用"开发者模式" → 加载解压缩的扩展
  ```

### 核心操作
1. **阅读主面板**：顶栏含导出、导入、检测按钮，以及文件夹选择；导入按钮会弹出设置层，用于选择目标文件夹和导入模式。
2. **查看检测结果**：进度条和百分比会在检测过程中实时更新；结果列表仅显示失效书签，同时提供新标签/弹窗/复制/删除等快捷操作。
3. **设置页配置**：点击右上角齿轮后打开 `settings.html`，可将多线程数量调至 1~20，并在直连失败时启用代理（支持 HTTP/HTTPS/SOCKS5）。
4. **恢复与持久化**：检测过程中关闭弹窗后重新打开时会尝试从 `localStorage` 恢复状态，并继续后台检测。

### 测试环境与验证建议
- 浏览器版本：Edge 88+、Chrome 90+，需授权 `bookmarks`、`downloads`、`proxy`、`storage` 与 `windows` 权限。
- 准备测试书签：加入几个失效链接、嵌套文件夹与重复 URL，便于验证检测与删除流程。
- 验证进度条：点击“检测网址可用性”，确认进度条、百分比与“正在检测…”提示实时刷新，完成后展示“检测完成…”消息。
- 验证代理：在设置页开启代理、填写有效信息，运行检测并人为阻断直连，确认自动进入代理阶段并在结束后恢复原始代理设置。
- 验证线程配置：将“并发检测数量”设为 5、15 等不同值，保存后重新检测，确保批次大小符合设置。
- 验证导入导出：导入 JSON/HTML/CSV/Markdown 文件，并确认书签结构、导入模式与导出文件内容一致。

### 其他说明
- 检测结果与配置保存到 `chrome.storage.local`，即使关闭弹窗也能恢复。
- 主结果区域仅展示失效书签，可通过操作按钮复制/打开/删除。
- 导入设置 modal 使用 `.hidden` 控制，只有在点击按钮或背景/关闭按钮时才会出现，防止误弹出。


## 🌰示例
![image](https://github.com/user-attachments/assets/d79aa937-4499-440b-a64b-61c125d3631f)
![image](https://github.com/user-attachments/assets/6ce757e4-7077-46d3-9128-0ae82bf0c68b)
![image](https://github.com/user-attachments/assets/beccadad-c168-4efa-ac72-81f5f84eba8b)
![image](https://github.com/user-attachments/assets/55c790da-c359-4be1-9730-583ef023c0e4)
