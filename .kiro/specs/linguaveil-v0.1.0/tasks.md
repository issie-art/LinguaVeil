# 实现计划：LinguaVeil v0.1.0

## 概述

基于 WXT + React + TypeScript 从零实现 GitHub 页面英文生词识别与标注浏览器扩展。按模块逐步构建：先搭建共享基础设施（类型定义、存储、消息），再实现 Content Script 核心逻辑（代码保护、扫描、标注、浮窗），然后实现 Popup 面板和 Background 消息中转，最后处理动态内容适配和整体集成。

## Tasks

- [x] 1. 搭建项目基础设施与共享模块
  - [x] 1.1 创建消息类型定义模块 `entrypoints/lib/messages.ts`
    - 定义 `Message` 联合类型（`LEARNING_MODE_CHANGED`、`MARK_MASTERED`、`GET_WORD_DATA`、`WORD_DATA_RESPONSE`）
    - 实现 `sendModeChange` 和 `forwardToActiveTab` 函数
    - _需求: 8.1, 8.2, 8.3_

  - [x] 1.2 创建技术词汇表模块 `entrypoints/lib/tech-words.ts`
    - 定义预定义技术词汇 `Set<string>`，包含常见编程/技术术语（如 API、async、callback、middleware 等）
    - 导出 `TECH_WORDS` 常量
    - _需求: 3.4, 3.5_

  - [x] 1.3 创建 Word_Store 存储模块 `entrypoints/lib/word-store.ts`
    - 定义 `WordEntry` 接口（word、definition、partOfSpeech、type、firstSeen、mastered）
    - 实现 `getMasteredWords()` 返回 `Set<string>`
    - 实现 `markAsMastered(word)` 将单词添加到已掌握列表
    - 实现 `saveWord(entry)` 保存/更新生词条目
    - 实现 `queryWords(filter)` 按掌握状态筛选
    - 所有操作使用 `chrome.storage.local`，失败时 console.error 并保持扩展正常运行
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]\* 1.4 为 Word_Store 编写单元测试
    - 测试 `getMasteredWords` 返回正确的 Set
    - 测试 `markAsMastered` 写入后可查询
    - 测试 `saveWord` 和 `queryWords` 的筛选逻辑
    - 测试 storage 操作失败时的错误处理
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. 实现 Code_Guard 代码保护模块
  - [x] 2.1 创建 `entrypoints/content/code-guard.ts`
    - 定义 `SKIP_TAGS` 集合（CODE、PRE、SCRIPT、STYLE）
    - 实现 `isProtectedNode(node)` 函数，向上遍历祖先节点检查是否在保护区域内
    - 定义 `LATEX_PATTERN` 正则匹配 `$$...$$` 和 `$...$`
    - 实现 `extractScannableText(text)` 函数，移除 LaTeX 公式部分，返回可扫描文本片段及其偏移量
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]\* 2.2 为 Code_Guard 编写属性测试
    - **属性 1: isProtectedNode 对 SKIP_TAGS 内的节点始终返回 true**
    - **验证: 需求 2.1, 2.2, 2.3, 2.4**

  - [ ]\* 2.3 为 Code_Guard 编写单元测试
    - 测试 `isProtectedNode` 对 `<code>`、`<pre>`、`<script>`、`<style>` 及其子节点返回 true
    - 测试 `isProtectedNode` 对普通 `<p>`、`<span>` 节点返回 false
    - 测试 `extractScannableText` 正确移除 `$...$` 和 `$$...$$` 公式
    - 测试混合文本（普通文本 + LaTeX）只保护公式部分
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. 实现 Word_Scanner 生词扫描模块
  - [x] 3.1 创建 `entrypoints/content/scanner.ts`
    - 定义 `WORD_PATTERN` 正则（`/[a-zA-Z]{3,}/g`）和 `HAS_DIGIT` 正则
    - 定义 `ScanResult` 接口
    - 实现 `scanContainer(container, masteredWords, techWords)` 函数：
      - 使用 TreeWalker 遍历文本节点
      - 调用 Code_Guard 过滤受保护节点
      - 提取英文单词，忽略长度 < 3 和含数字的字符串
      - 匹配已掌握词汇列表，排除已掌握单词
      - 对生词进行分级（普通/技术）
    - 实现 `annotateWords(results)` 函数：
      - 将生词包裹在 `<span class="lv-word lv-ordinary|lv-technical" data-word="xxx">` 中
      - 确保不改变原文排版布局
    - 实现 `removeAnnotations(container)` 函数：
      - 移除所有 `.lv-word` span，恢复原始文本节点
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 3.2 为 Word_Scanner 编写属性测试
    - **属性 2: scanContainer 永远不会返回长度 < 3 的单词**
    - **验证: 需求 3.6**
    - **属性 3: scanContainer 永远不会返回已掌握词汇列表中的单词**
    - **验证: 需求 3.2**

  - [ ]\* 3.3 为 Word_Scanner 编写单元测试
    - 测试从文本节点中正确提取英文单词
    - 测试忽略长度 < 3 的单词
    - 测试忽略含数字的字符串
    - 测试已掌握单词被排除
    - 测试技术词汇正确分类为 technical
    - 测试 annotateWords 生成正确的 span 结构和 data-word 属性
    - 测试 removeAnnotations 恢复原始文本
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. 检查点 - 确保核心扫描逻辑正确
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 5. 实现注入样式与 Tooltip 浮窗
  - [x] 5.1 创建注入样式文件 `entrypoints/content/styles.css`
    - 定义 `.lv-ordinary` 样式：`border-bottom: 1px dashed #aaa; cursor: pointer;`
    - 定义 `.lv-technical` 样式：`border-bottom: 1px solid #3b82f6; cursor: pointer;`
    - 确保 span 样式不影响行高、字间距、段落间距（`display: inline; line-height: inherit;`）
    - 定义 `.lv-tooltip` 浮窗样式：背景、圆角、阴影、z-index: 2147483647
    - _需求: 4.1, 4.2, 4.3, 5.6_

  - [x] 5.2 创建 Tooltip_Widget 模块 `entrypoints/content/tooltip.ts`
    - 实现 `initTooltip()` 创建全局浮窗 DOM 元素，绑定事件委托（mouseenter/mouseleave on `.lv-word`）
    - 实现 `showTooltip(target, data)` 计算位置（getBoundingClientRect）、视口边界检测与调整
    - 实现 `hideTooltip()` 200ms 延迟隐藏，鼠标移入浮窗时取消隐藏
    - 实现 `destroyTooltip()` 移除 DOM 和事件监听
    - 浮窗内容包含：生词、中文释义、词性标签
    - 浮窗内添加"已掌握"按钮，点击后调用 Word_Store 标记单词
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.2_

  - [ ]\* 5.3 为 Tooltip_Widget 编写单元测试
    - 测试 initTooltip 创建浮窗 DOM 元素
    - 测试 showTooltip 正确定位浮窗
    - 测试 hideTooltip 的 200ms 延迟逻辑
    - 测试视口边界检测调整位置
    - _需求: 5.1, 5.4, 5.5_

- [x] 6. 实现 Content Script 入口与生命周期管理
  - [x] 6.1 重写 `entrypoints/content.ts` 入口文件
    - 导入 styles.css 注入样式
    - 初始化时检查 `#readme .markdown-body` 容器是否存在
    - 容器存在时：从 Word_Store 加载已掌握词汇，执行 scanContainer + annotateWords
    - 初始化 Tooltip 系统
    - 监听来自 Background 的消息（学习模式开/关）
    - 收到关闭消息时调用 removeAnnotations + destroyTooltip
    - 收到开启消息时重新扫描标注
    - 从 chrome.storage 读取学习模式状态，仅在开启时执行扫描
    - _需求: 1.1, 1.3, 1.4, 8.2, 8.3, 6.5, 6.7_

- [x] 7. 实现 MutationObserver 动态内容适配
  - [x] 7.1 创建 `entrypoints/content/observer.ts`
    - 实现 `startObserving(onContentChange)` 函数：
      - 监听 `#readme .markdown-body` 的 childList + subtree 变化
      - 500ms 防抖后触发回调
    - 实现 `stopObserving()` 停止监听并清理
    - _需求: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 在 Content Script 入口中集成 MutationObserver
    - 容器存在时启动 observer，回调中执行 removeAnnotations + scanContainer + annotateWords
    - 监听整个 document 的 DOM 变化以检测 `#readme .markdown-body` 的出现/消失
    - 容器消失时 stopObserving，新容器出现时重新 startObserving
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. 检查点 - 确保 Content Script 完整功能正确
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 9. 实现 Background Service 消息中转
  - [x] 9.1 重写 `entrypoints/background.ts`
    - 监听 `chrome.runtime.onMessage` 接收来自 Popup 的消息
    - 收到 `LEARNING_MODE_CHANGED` 消息时，通过 `chrome.tabs.sendMessage` 转发到当前活动标签页
    - 转发失败时静默处理错误（console.warn），不影响扩展运行
    - _需求: 8.1, 8.4_

- [x] 10. 实现 Popup 设置面板
  - [x] 10.1 重写 `entrypoints/popup/App.tsx`
    - 从 `chrome.storage.local` 读取模式状态初始化组件
    - 渲染三个模式开关：学习模式、写作模式、翻译模式
    - 学习模式默认开启，写作/翻译模式默认关闭且显示为禁用 + "即将推出"标签
    - 学习模式切换时：持久化到 chrome.storage + 调用 sendModeChange 发送消息
    - 使用简洁的 UI 样式，适配 Popup 面板尺寸
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]\* 10.2 为 Popup_Panel 编写单元测试
    - 测试初始渲染三个开关
    - 测试学习模式默认开启
    - 测试写作/翻译模式显示为禁用
    - 测试切换学习模式触发消息发送和存储写入
    - _需求: 6.2, 6.3, 6.4, 6.5_

- [x] 11. 更新 WXT 配置与 Content Script 匹配规则
  - 确认 `wxt.config.ts` 配置正确
  - 确认 content script 的 `matches` 仅匹配 `https://github.com/*`
  - 确认 popup 入口 HTML 和 main.tsx 正确引用 App 组件
  - _需求: 1.1, 1.2_

- [x] 12. 最终检查点 - 全部功能集成验证
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务用于阶段性验证，确保增量开发的正确性
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 所有代码使用 TypeScript 编写，遵循 WXT 框架约定
