# 需求文档

## 简介

LinguaVeil v0.1.0 是面向工程师群体的英语/技术学习助手浏览器扩展的 MVP 版本。基于 WXT + React + TypeScript 构建，聚焦于 GitHub 页面上的生词识别与标注功能，帮助用户在阅读英文技术文档时，通过轻量级下划线标注和 hover 释义浮窗实现沉浸式词汇学习，同时保护代码区域不被干扰。

## 术语表

- **Content_Script**: 注入到目标网页中运行的脚本，负责 DOM 操作和生词标注逻辑
- **Popup_Panel**: 点击浏览器扩展图标后弹出的设置面板，用于模式切换和状态展示
- **Background_Service**: 扩展的后台服务脚本，负责消息中转和存储管理
- **Word_Scanner**: 生词扫描模块，负责遍历目标 DOM 区域并识别需要标注的生词
- **Tooltip_Widget**: hover 释义浮窗组件，展示生词的中文释义和词性信息
- **Code_Guard**: 代码保护模块，负责识别并跳过代码相关 DOM 元素
- **Word_Store**: 基于 chrome.storage 的生词存储模块，管理用户的生词数据
- **Learning_Mode**: 学习模式，开启后 Content_Script 自动扫描并标注页面中的生词
- **Ordinary_Word**: 普通生词，使用细灰虚线下划线标注
- **Technical_Word**: 技术生词，使用细蓝实线下划线标注

## 需求

### 需求 1：Content Script 页面匹配与注入

**用户故事：** 作为工程师用户，我希望扩展仅在 GitHub 页面上激活，以避免对其他网站的干扰。

#### 验收标准

1. WHEN 用户访问 `https://github.com/*` 页面时，THE Content_Script SHALL 自动注入并初始化生词扫描逻辑
2. WHEN 用户访问非 GitHub 域名的页面时，THE Content_Script SHALL 不注入任何脚本或修改任何 DOM 元素
3. WHEN GitHub 页面包含 `#readme .markdown-body` 容器时，THE Word_Scanner SHALL 仅在该容器范围内执行生词扫描
4. WHEN GitHub 页面不包含 `#readme .markdown-body` 容器时，THE Word_Scanner SHALL 不执行任何扫描操作

### 需求 2：代码保护协议

**用户故事：** 作为工程师用户，我希望代码块和技术标记不被生词标注干扰，以保持代码的可读性。

#### 验收标准

1. WHEN Word_Scanner 遍历 DOM 节点时，THE Code_Guard SHALL 跳过所有 `<code>` 元素及其子节点
2. WHEN Word_Scanner 遍历 DOM 节点时，THE Code_Guard SHALL 跳过所有 `<pre>` 元素及其子节点
3. WHEN Word_Scanner 遍历 DOM 节点时，THE Code_Guard SHALL 跳过所有 `<script>` 元素及其子节点
4. WHEN Word_Scanner 遍历 DOM 节点时，THE Code_Guard SHALL 跳过所有 `<style>` 元素及其子节点
5. WHEN Word_Scanner 遍历 DOM 节点时，THE Code_Guard SHALL 跳过包含 LaTeX 数学公式（`$...$` 或 `$$...$$`）的文本节点
6. WHEN 一个文本节点同时包含普通文本和 LaTeX 公式时，THE Code_Guard SHALL 仅保护公式部分，允许对普通文本部分进行生词扫描

### 需求 3：生词识别与分级

**用户故事：** 作为工程师用户，我希望扩展能智能识别我不认识的英文单词并区分普通生词和技术生词，以便我有针对性地学习。

#### 验收标准

1. THE Word_Scanner SHALL 从目标 DOM 区域的文本节点中提取所有独立的英文单词（由空格或标点分隔的连续字母序列）
2. WHEN 一个英文单词存在于 Word_Store 的已掌握词汇列表中时，THE Word_Scanner SHALL 不将该单词标记为生词
3. WHEN 一个英文单词不存在于 Word_Store 的已掌握词汇列表中时，THE Word_Scanner SHALL 将该单词标记为生词
4. THE Word_Scanner SHALL 将属于预定义技术词汇表中的生词分类为 Technical_Word
5. THE Word_Scanner SHALL 将不属于预定义技术词汇表中的生词分类为 Ordinary_Word
6. THE Word_Scanner SHALL 忽略长度小于 3 个字符的英文单词（如 "a"、"is"、"to"）
7. THE Word_Scanner SHALL 忽略纯数字和包含数字的混合字符串（如 "v0.1.0"、"123"）

### 需求 4：生词下划线标注

**用户故事：** 作为工程师用户，我希望生词通过不同样式的下划线标注，以便我在阅读时能自然地注意到生词而不被打断。

#### 验收标准

1. WHEN Word_Scanner 识别到一个 Ordinary_Word 时，THE Content_Script SHALL 将该单词包裹在一个 `<span>` 元素中，并应用 CSS 样式 `border-bottom: 1px dashed #aaa`（细灰虚线）
2. WHEN Word_Scanner 识别到一个 Technical_Word 时，THE Content_Script SHALL 将该单词包裹在一个 `<span>` 元素中，并应用 CSS 样式 `border-bottom: 1px solid #3b82f6`（细蓝实线）
3. THE Content_Script SHALL 确保生词标注不改变原文的排版布局（行高、字间距、段落间距保持不变）
4. THE Content_Script SHALL 为每个标注的 `<span>` 元素添加 `data-word` 属性，值为该生词的原始文本
5. WHEN 同一个生词在页面中出现多次时，THE Content_Script SHALL 对每次出现都进行标注

### 需求 5：Hover 释义浮窗

**用户故事：** 作为工程师用户，我希望将鼠标悬停在标注的生词上时能看到中文释义，以便我快速理解生词含义。

#### 验收标准

1. WHEN 用户将鼠标悬停在一个已标注的生词 `<span>` 元素上时，THE Tooltip_Widget SHALL 在该元素附近显示一个释义浮窗
2. THE Tooltip_Widget SHALL 在浮窗中显示生词的中文释义文本
3. THE Tooltip_Widget SHALL 在浮窗中显示生词的词性标签（如名词、动词、形容词）
4. WHEN 用户将鼠标移出已标注的生词 `<span>` 元素时，THE Tooltip_Widget SHALL 在 200 毫秒内隐藏释义浮窗
5. THE Tooltip_Widget SHALL 确保浮窗不超出浏览器视口边界（当生词靠近页面边缘时，浮窗自动调整显示位置）
6. THE Tooltip_Widget SHALL 确保浮窗的 z-index 值高于 GitHub 页面的所有元素，避免被遮挡
7. WHEN 用户将鼠标从生词移动到浮窗区域时，THE Tooltip_Widget SHALL 保持浮窗显示状态

### 需求 6：Popup 设置面板

**用户故事：** 作为工程师用户，我希望通过扩展弹出面板控制学习模式的开关，以便我按需启用或禁用生词标注功能。

#### 验收标准

1. WHEN 用户点击浏览器工具栏中的 LinguaVeil 扩展图标时，THE Popup_Panel SHALL 显示一个设置面板
2. THE Popup_Panel SHALL 显示三个模式开关：学习模式、写作模式、翻译模式
3. THE Popup_Panel SHALL 将学习模式的默认状态设置为开启
4. THE Popup_Panel SHALL 将写作模式和翻译模式的默认状态设置为关闭
5. WHEN 用户切换学习模式开关时，THE Popup_Panel SHALL 将新的开关状态持久化到 chrome.storage 中
6. WHEN 用户切换学习模式为关闭状态时，THE Popup_Panel SHALL 通过消息通知 Content_Script 移除当前页面上所有的生词标注
7. WHEN 用户切换学习模式为开启状态时，THE Popup_Panel SHALL 通过消息通知 Content_Script 重新执行生词扫描和标注
8. WHILE 写作模式和翻译模式在 v0.1.0 中未实现时，THE Popup_Panel SHALL 将这两个开关显示为禁用状态并标注"即将推出"

### 需求 7：生词数据存储

**用户故事：** 作为工程师用户，我希望我的生词数据能被持久化保存，以便我在不同会话中保持一致的学习进度。

#### 验收标准

1. THE Word_Store SHALL 使用 chrome.storage.local 作为持久化存储后端
2. WHEN 用户通过 Tooltip_Widget 将一个生词标记为"已掌握"时，THE Word_Store SHALL 将该单词添加到已掌握词汇列表中
3. WHEN 已掌握词汇列表更新时，THE Word_Store SHALL 在 1 秒内完成数据写入 chrome.storage.local
4. THE Word_Store SHALL 存储每个生词的以下字段：单词原文、中文释义、词性、分类（普通/技术）、首次遇到时间、掌握状态
5. WHEN chrome.storage.local 读写操作失败时，THE Word_Store SHALL 在控制台输出错误日志并保持扩展正常运行
6. THE Word_Store SHALL 提供查询接口，支持按掌握状态筛选生词列表

### 需求 8：消息通信机制

**用户故事：** 作为工程师用户，我希望 Popup 面板的操作能实时反映到页面上，以便我获得即时的交互反馈。

#### 验收标准

1. WHEN Popup_Panel 发送学习模式状态变更消息时，THE Background_Service SHALL 将该消息转发给当前活动标签页的 Content_Script
2. WHEN Content_Script 接收到学习模式开启消息时，THE Content_Script SHALL 执行生词扫描和标注流程
3. WHEN Content_Script 接收到学习模式关闭消息时，THE Content_Script SHALL 移除所有已标注的生词 `<span>` 元素并恢复原始文本
4. IF Background_Service 转发消息失败（如目标标签页已关闭），THEN THE Background_Service SHALL 静默处理错误，不影响扩展其他功能的运行

### 需求 9：GitHub 页面动态内容适配

**用户故事：** 作为工程师用户，我希望在 GitHub 页面通过 PJAX/Turbo 导航切换内容后，生词标注能自动更新，以保持持续的学习体验。

#### 验收标准

1. WHEN GitHub 页面通过 PJAX 或 Turbo 导航加载新内容时，THE Content_Script SHALL 检测 DOM 变化并重新执行生词扫描
2. THE Content_Script SHALL 使用 MutationObserver 监听 `#readme .markdown-body` 容器的子树变化
3. WHEN MutationObserver 检测到目标容器内容变化时，THE Content_Script SHALL 在 500 毫秒的防抖延迟后重新执行生词扫描
4. WHEN 页面导航导致 `#readme .markdown-body` 容器被移除时，THE Content_Script SHALL 停止当前的 MutationObserver 监听
5. WHEN 页面导航导致新的 `#readme .markdown-body` 容器出现时，THE Content_Script SHALL 对新容器启动 MutationObserver 监听并执行生词扫描

