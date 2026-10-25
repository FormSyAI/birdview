# FormSy 原生图谱适配

[English](formsy-reader.md)

`presentation: 'reader'` 将现有 Birdview 图谱适配到 FormSy 工作台。它复用同一份架构模板、viewer、节点、SVG 路由连线、活动控制、缩放、语言/主题控制与模块详情。它不另建卡片界面或关系列表界面。

```js
renderArchitecture(architecture, events, {
  presentation: 'reader', readerLanguage: 'zh', readerTheme: 'dark'
});
```

```sh
node scripts/render.mjs architecture.json reader.html activity.jsonl --presentation reader
```

嵌入工作台可发送 `{type: "birdview:theme", theme: "dark" | "light"}` 同步外观。viewer 只接受直接父窗口发来的这类消息，不能通过该消息修改图谱数据。

宿主适配采用 FormSy 字体、炭黑底色、紧凑间距与克制的高亮。分组在可用宽度内按原生节点尺寸重排；宽度变化时重新路由原有连线，不修改架构数据。自动布局保持正常比例，图按完整高度向下展开，与宿主页共用页面滚动；不再限制内部画布视口。嵌入时原生 viewer 发送 `birdview:resize` 内容高度，宿主只接受当前图窗口发来的有效高度。原有适配全图和缩放控制继续可用。悬浮模块或打开详情时显示相关关系标签；详情保留完整职责、关系和来源依据。

默认 `explorer` 保留原有布局与样式。独立约束目录或评审导航使用 explorer。自包含输出保留输入校验、MIT 和第三方声明。宿主负责独立图页、返回导航和业务验收详情。嵌入图隐藏重复品牌/项目头部，主题由宿主同步；语言选择仍在工具栏。目标清单收进活动详情，展开后完整换行，只显示相关活动说明、范围与已有验证记录。完整文件记录仍保留在输入数据中，模块来源可从原生详情打开。FormSy 从已验证的保留 JSON 生成 `reader_html`，不改变保留回执或来源哈希。更新 fork 后需重建固定 renderer 资源；保留 Server vendor 的 discovery 修改。

浏览器检查覆盖 320、390、897、1440 像素宽度变化，节点与路径保留、重叠/溢出、原生控制和模块详情。运行 `npm run check:pr`；视觉检查与真实宿主接入仍是独立检查。本地预览成功不代表已安装到真实 MCP。
