# 🔍 Bookmark Inspector 

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/your-extension-id?label=Chrome%20Store)](https://chrome.google.com/webstore/detail/your-extension-id)
[![Firefox Add-on](https://img.shields.io/amo/v/your-extension-id?label=Firefox%20Add-on)](https://addons.mozilla.org/addon/your-extension-id)

一款专注于书签健康管理的浏览器扩展，提供智能检测、批量操作与跨设备同步能力。
![微信截图_20250313112137](https://github.com/user-attachments/assets/03b44429-e2ec-4000-b355-08adaf6616cc)
![微信图片_20250313112226](https://github.com/user-attachments/assets/0ff8023e-0738-4bbb-96a0-6f878cc37d5c)
![微信截图_20250313112215](https://github.com/user-attachments/assets/fa0d4c64-95e5-4d44-a59a-ddcabaf2f2e2)




## ✨ 核心功能

### 🛠️ 书签检测
- **死链扫描**：自动识别失效链接（404/503等）（完成√）
- **重复检测**：通过URL/标题相似度分析重复书签 （计划中）
- **安全检测**：标记潜在恶意链接（需集成外部API）（计划中）

### 🔄 导入/导出
- **格式支持**：HTML/JSON/CSV 多格式互转 （完成√）
- **云同步**：支持导出到Google Drive/Dropbox（可选）（计划中）
- **跨浏览器迁移**：一键转换Chrome↔Firefox↔Edge格式 （计划中）

### 🧹 智能清理
- 批量删除/归档失效/重复书签 （计划中）
- 自动分类建议（基于链接内容分析）（计划中）

## 🚀 快速开始

### 安装方式
1. **浏览器商店安装**  
   [Chrome Web Store](https://...) | [Firefox Add-ons](https://...)

2. **手动加载**  
   ```bash
   git clone https://github.com/yourusername/bookmark-inspector.git
   # 浏览器打开扩展页 → 启用"开发者模式" → 加载解压缩的扩展
