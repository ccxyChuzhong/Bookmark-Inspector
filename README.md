# 🔍 Bookmark Inspector 

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/your-extension-id?label=Chrome%20Store)](https://chrome.google.com/webstore/detail/your-extension-id)
[![Firefox Add-on](https://img.shields.io/amo/v/your-extension-id?label=Firefox%20Add-on)](https://addons.mozilla.org/addon/your-extension-id)

一款专注于书签健康管理的浏览器扩展，提供智能检测、批量操作与跨设备同步能力。

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
   
### 详细教程
一、核心功能概述
本扩展为书签管理工具，支持：

书签树形展示与搜索
书签批量导出/导入（JSON 格式）
书签链接有效性验证（自动检测 404 失效链接）
重复书签检测与清理
二、测试环境要求
浏览器版本：Microsoft Edge 88+ 或 Chrome 90+
依赖项：无外部服务依赖，需确保启用 bookmarks 和 downloads 权限。
三、测试账号与数据准备
无需登录或测试账号，但需准备以下测试数据：

书签样本文件（可先进行导出）：
有效文件：包含嵌套结构的 JSON、 csv、html、md文件
无效文件：格式错误或非 JSON、csv、html、md 文件（如 .txt）
失效链接书签：手动添加包含 http://non-existent-domain-12345.com 等无效 URL 的书签。
四、关键测试场景与步骤
1. 基础功能验证
书签展示：
点击下拉框看是否是书签所有的文件夹，点击文件夹之后点击检测，看是否是文件夹下的所有书签。
2. 导入/导出测试
导出书签：
点击“导出”按钮，确认生成 bookmarks_YYYYMMDD.json 文件且内容完整。
导入书签：
选择有效 JSON 文件，确认书签树更新并与文件内容一致。
选择无效文件，检查是否弹出错误提示（如“文件格式不兼容”）。
3. 链接验证与清理
自动检测失效链接：
点击“验证链接”，观察失效书签是否标记为红色，可进行另打开一个窗口手动验证，之后再删除。


## 🌰示例
![image](https://github.com/user-attachments/assets/1cb06ec0-824a-4bc3-bec9-10eabdbf231e)
![image](https://github.com/user-attachments/assets/06dd354d-e57a-42a9-8474-1283a37d1d86)
![image](https://github.com/user-attachments/assets/c1bc648b-dfd8-4788-ab3e-f4430f324d97)
![image](https://github.com/user-attachments/assets/ceb9d9b1-8843-4165-ba33-17042dac12a7)

