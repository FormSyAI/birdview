# FormSy native graph adaptation

[中文](formsy-reader.zh.md)

`presentation: 'reader'` adapts the existing Birdview graph to the FormSy workbench. It uses the same architecture template, viewer, nodes, routed SVG connections, activity controls, zoom, language/theme controls and module inspector. It does not create a separate card or relationship-list interface.

```js
renderArchitecture(architecture, events, {
  presentation: 'reader', readerLanguage: 'zh', readerTheme: 'dark'
});
```

```sh
node scripts/render.mjs architecture.json reader.html activity.jsonl --presentation reader
```

An embedded workbench can send `{type: "birdview:theme", theme: "dark" | "light"}` to synchronize appearance. The viewer accepts this message only from its direct parent and cannot change graph data through it.

The host adaptation uses FormSy typography, charcoal surfaces, compact spacing and restrained emphasis. Groups reflow within the available width at the native node size. Resizing reroutes the original connections; it never changes architecture data. Automatic layout keeps normal scale and expands the entire drawing downward with the host page; the canvas has no fixed viewport height. The native viewer reports its body height with `birdview:resize`, and the host accepts valid measurements only from the current graph window. The existing fit and zoom controls remain available. Hovering a module or opening its inspector reveals its relationship labels; the inspector contains full responsibility text, relationships and source evidence.

The default `explorer` presentation retains its original layout and style. Use explorer for separate constraint catalogs or review navigation. The self-contained output keeps input validation, MIT and third-party notices. The host owns the separate graph page, return navigation and business acceptance details. The embedded graph hides its duplicate brand/project header, follows host appearance and keeps language selection in the toolbar. Target chips appear in activity details with complete wrapping, alongside the activity summary, scope and any existing checks. Full file records remain in the input; module sources remain available through the native inspector. FormSy renders verified retained JSON into `reader_html` without altering retained receipts or source hashes. Rebuild the pinned renderer resources when updating this fork; preserve Server vendor discovery changes.

Browser checks cover width changes at 320, 390, 897 and 1440 pixels, retained nodes and paths, overlap/overflow, native controls and module details. Run `npm run check:pr`; visual inspection and live host integration remain separate checks. A successful local preview does not establish live MCP installation.
