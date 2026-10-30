# FormSy 原生图谱适配

[English](formsy-reader.md)

`presentation: 'reader'` 将现有 Birdview 图谱适配到 FormSy 工作台。它复用同一份架构模板、viewer、节点、SVG 路由连线、活动控制、缩放、语言/主题控制与模块详情。它不另建卡片界面或关系列表界面。

阅读器在顶部提供“完整架构”“更改视图”（存在活动时）和“约束”标签。约束直接替换同一工具栏下方的图谱区域，不再在图谱底部打开详情。切回时保留模块选择、活动记录与缩放。方向键、Home 和 End 可以切换标签。阅读器在两种主题下均使用纯色背景，来源检查保留在“约束”标签的折叠区域内。静态图谱同样提供“约束”标签；规则为空不表示项目不存在约束。

原生阅读器中 1440px 和 390px 的约束视图。

![1440px](images/formsy-reader-constraints-1440.png)

![390px](images/formsy-reader-constraints-390.png)

```js
renderArchitecture(architecture, events, {
  presentation: 'reader', readerLanguage: 'zh', readerTheme: 'dark'
});
```

```sh
node scripts/render.mjs architecture.json reader.html activity.jsonl --presentation reader
```

嵌入工作台可发送 `{type: "birdview:theme", theme: "dark" | "light"}` 同步外观。viewer 只接受直接父窗口发来的这类消息，不能通过该消息修改图谱数据。

宿主适配采用 FormSy 字体、炭黑底色、紧凑间距与克制的高亮。分组在可用宽度内保持正常比例重排。阅读模式节点会增高，以完整展示不带分隔的英文和长中文标题；行间距与连线路由使用实际测量的节点边界。图向下展开，与宿主页共用页面滚动，不限制内部画布视口。调整宽度不修改架构数据，也不移动键盘焦点。密集窄图的关系文字通过模块详情阅读，避免在画布上叠加相互覆盖的标签；完整职责、关系和来源依据继续保留在详情中。原有适配全图和缩放控制继续可用。

原生 viewer 发送 `{type: "birdview:resize", height: number}`。宿主必须核对 `event.source === iframe.contentWindow`、消息类型以及有限且有界的高度，才调整当前 iframe。刷新返回相同文档时保留同一 iframe，调整尺寸不重新挂载。图下不新增来源或调试说明区；业务验收内容由宿主保留在阅读器外部。

独立 explorer 和 reader 页面提供全屏切换。按钮通过 `fullscreenchange` 跟随 `document.fullscreenElement`，包括外部 Escape 退出；请求失败只显示错误，不假称进入全屏。全屏图向下阅读时，工具栏继续可见。嵌入的 reader 隐藏重复的全屏按钮：宿主须将自己的图容器全屏，在该容器内保留退出控制，并监听 `fullscreenchange`。跨窗口消息不请求全屏、不改变版本选择，已有 sandbox 限制继续保留。

显式定位读取 `prefers-reduced-motion`：减少动态效果时使用 `instant`，默认保留 `auto`；导览目标在两种偏好下均即时定位。启用减少动态效果时，关系与导览动画取消；模块选择、折叠及视图反馈继续可用。内容尺寸和全屏状态变化不调用焦点或滚动到选中对象。

默认 `explorer` 保留原有布局与样式。独立约束目录或评审导航使用 explorer。自包含输出保留输入校验、MIT 和第三方声明。宿主负责独立图页、返回导航和业务验收详情。嵌入图隐藏重复品牌/项目头部，主题由宿主同步；语言选择仍在工具栏。目标清单收进活动详情，展开后完整换行，只显示相关活动说明、范围与已有验证记录。完整文件记录仍保留在输入数据中，模块来源可从原生详情打开。FormSy 从已验证的保留 JSON 生成 `reader_html`，不改变保留回执或来源哈希。更新 fork 后需重建固定 renderer 资源；保留 Server vendor 的 discovery 修改。

浏览器检查覆盖 320、390、897、1440 像素的宽度切换、长标题、密集关系、实测边界路由、实际滚动选项、全屏进入/按钮退出/外部退出/失败、焦点、折叠及两种动态效果偏好。运行 `npm run check:pr`；原生 Escape 操作和真实宿主接入仍须分别验证。独立本地预览成功不代表 Web 或 MCP 已安装。消费者须固定 FormSyAI fork 的提交，并从同一源版本重建 renderer 资源；仅有 `0.4.0` 包版本不能识别这些 fork 改动。更新时保留 Server vendor 的 discovery 与依赖安全修复。
