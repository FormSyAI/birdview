import type { ReviewedConstraintCatalog, ConstraintRule } from '../constraint-types.mjs';

/** Read the fixed catalog without rewriting rule authority or source content. */
export function mountReaderCatalog(rulesPanel: HTMLElement, sourcesPanel: HTMLElement, catalog: ReviewedConstraintCatalog, options: {
  text: (zh: string, en: string) => string;
  moduleName: (id: string) => string;
  showSources: () => void;
}) {
  const { text } = options;
  let query = '', sourceQuery = '', moduleId: string | undefined;
  let moduleOnly = false, selected: string | undefined, sourcePath: string | undefined;
  let range: {line: number; endLine: number} | undefined;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, content = '', className = '') => {
    const node = document.createElement(tag); node.textContent = content; node.className = className; return node;
  };
  const field = (parent: HTMLElement, label: string, value: string) => {
    parent.append(element('h3', label), element('p', value));
  };
  function renderRules() {
    rulesPanel.replaceChildren(element('h2', `${text('约束', 'Constraints')} · ${catalog.rules.length}`));
    rulesPanel.append(element('p', text('规则内容保留生成时的来源与适用性；尚未独立 Review，不能视为实现已通过核验。', 'Rules retain their generated provenance and applicability. Independent review and implementation verification remain unperformed.'), 'constraint-context'));
    const search = element('input'); search.type = 'search'; search.value = query;
    search.ariaLabel = text('搜索约束', 'Search constraints'); search.placeholder = search.ariaLabel;
    const filter = element('select'); filter.ariaLabel = text('约束范围', 'Constraint scope');
    filter.add(new Option(text('全部规则', 'All rules'), 'all'));
    filter.add(new Option(text('关联选中模块', 'Linked to selected module'), 'module'));
    filter.value = moduleOnly ? 'module' : 'all';
    const toolbar = element('div', '', 'reader-catalog-tools'); toolbar.append(search, filter); rulesPanel.append(toolbar);
    const count = element('p', '', 'constraint-context'), list = element('div', '', 'constraint-list');
    rulesPanel.append(count, list);
    const renderList = () => {
      list.replaceChildren();
      const visible = catalog.rules.filter(rule => (!moduleOnly || rule.modules?.includes(moduleId ?? '')) && [rule.name, rule.sourcePath, rule.condition, rule.explanation].join('\n').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      count.textContent = `${text('显示', 'Showing')} ${visible.length}/${catalog.rules.length}`;
      for (const rule of visible) {
        const row = element('button', '', 'constraint-row'); row.type = 'button'; row.dataset.constraint = rule.id;
        row.setAttribute('aria-pressed', String(selected === rule.id));
        row.append(element('strong', rule.name), element('span', `${rule.sourcePath}:${rule.line}–${rule.endLine}`, 'constraint-row-meta'));
        row.onclick = () => { selected = selected === rule.id ? undefined : rule.id; renderList(); [...list.querySelectorAll<HTMLButtonElement>('.constraint-row')].find(button => button.dataset.constraint === rule.id)?.focus({preventScroll:true}); };
        list.append(row);
        if (selected !== rule.id) continue;
        const detail = element('div', '', 'constraint-detail'); detail.dataset.ruleDetail = rule.id;
        const states: Record<ConstraintRule['applicability'], string> = {applicable:text('适用','Applicable'),conditional:text('按条件适用','Conditional'),superseded:text('已被替代','Superseded'),conflict:text('存在冲突','Conflict'),uncertain:text('待确认','Uncertain')};
        field(detail, text('适用性', 'Applicability'), states[rule.applicability]);
        field(detail, text('使用条件', 'Condition'), rule.condition);
        field(detail, text('具体要求', 'Requirement'), rule.explanation);
        field(detail, text('关联模块', 'Linked modules'), rule.modules?.map(options.moduleName).join(' · ') || text('未记录模块关联', 'No module links recorded'));
        field(detail, text('检查方法', 'Verification method'), rule.verification);
        field(detail, text('实现核验', 'Implementation verification'), text('未独立核验', 'Not independently verified'));
        const source = catalog.sources.find(item => item.path === rule.sourcePath);
        if (source) {
          const quote = element('blockquote', source.text.split(/\r?\n/).slice(rule.line - 1, rule.endLine).join('\n'));
          detail.append(element('h3', text('来源摘录（原文）', 'Source excerpt (original)')), quote);
        }
        const open = element('button', `${text('查看来源全文', 'Read full source')} · ${rule.sourcePath}:${rule.line}–${rule.endLine}`, 'constraint-module-link');
        open.type = 'button'; open.onclick = () => { sourcePath = rule.sourcePath; range = {line:rule.line,endLine:rule.endLine}; renderSources(); options.showSources(); sourcesPanel.querySelector<HTMLElement>('.reader-source-title')?.focus({preventScroll:true}); };
        detail.append(open);
        if (rule.history?.status === 'tracked') field(detail, text('原文行段历史', 'Source range history'), `v${rule.history.version} · ${rule.history.lastEdited}\n${rule.history.snapshot}`);
        list.append(detail);
      }
      if (!visible.length) list.append(element('p', text('此范围没有匹配规则；不代表项目没有约束。', 'No matching rules in this scope; this does not mean the project has no constraints.'), 'constraint-empty'));
    };
    search.oninput = () => { query = search.value; renderList(); };
    filter.onchange = () => { moduleOnly = filter.value === 'module'; renderList(); };
    renderList();
  }
  function renderSources() {
    sourcesPanel.replaceChildren(element('h2', `${text('来源', 'Sources')} · ${catalog.sources.length}`));
    sourcesPanel.append(element('p', `${text('固定源码快照', 'Fixed source snapshot')}: ${catalog.project.revision}`, 'constraint-context'));
    const coverage = element('details', '', 'constraint-discovery');
    coverage.append(element('summary', text('查看来源覆盖与缺口', 'Source coverage and gaps')));
    const gaps = catalog.coverage.unresolved ?? [];
    coverage.append(element('p', `${text('未检查路径', 'Uninspected paths')}: ${(catalog.coverage.uninspectedPaths ?? []).length} · ${text('未解析引用', 'Unresolved references')}: ${gaps.length}`));
    for (const gap of gaps) coverage.append(element('p', `${gap.from} → ${gap.target} · ${gap.reason}`));
    for (const path of catalog.coverage.uninspectedPaths ?? []) coverage.append(element('p', path));
    for (const limitation of catalog.coverage.limitations ?? []) coverage.append(element('p', limitation));
    sourcesPanel.append(coverage);
    const search = element('input'); search.type = 'search'; search.value = sourceQuery;
    search.ariaLabel = text('搜索来源路径', 'Search source paths'); search.placeholder = search.ariaLabel;
    sourcesPanel.append(search);
    const list = element('div', '', 'reader-source-list'), detail = element('section', '', 'reader-source-detail');
    sourcesPanel.append(list, detail);
    const renderDetail = () => {
      detail.replaceChildren();
      const source = catalog.sources.find(item => item.path === sourcePath);
      if (!source) { detail.append(element('p', text('选择来源，阅读此快照保存的完整原文。', 'Select a source to read the full text saved in this snapshot.'))); return; }
      const title = element('h3', source.path, 'reader-source-title'); title.tabIndex = -1; detail.append(title);
      const linked = catalog.rules.filter(rule => rule.sourcePath === source.path);
      field(detail, text('来源记录', 'Source record'), `${text('关联候选规则', 'Linked candidate rules')}: ${linked.length}\n${source.kind ?? ''} · ${source.applicability ?? ''}\n${source.scope ?? ''}`);
      if (range) field(detail, text('当前引用行段', 'Current cited range'), `${source.path}:${range.line}–${range.endLine}`);
      const code = element('pre', '', 'reader-source-text');
      for (const [index, line] of source.text.split(/\r?\n/).entries()) {
        const row = element('span', '', 'reader-source-line'); row.dataset.line = String(index + 1);
        row.append(element('span', String(index + 1), 'reader-line-number'), element(range && index + 1 >= range.line && index + 1 <= range.endLine ? 'mark' : 'span', line || ' '));
        code.append(row);
      }
      detail.append(code);
      const references = catalog.references.filter(item => item.from === source.path || item.to === source.path);
      if (references.length) field(detail, text('来源引用', 'Source references'), references.map(item => `${item.from} → ${item.to} · ${item.target}`).join('\n'));
    };
    const renderList = () => {
      list.replaceChildren();
      for (const source of catalog.sources.filter(item => item.path.toLocaleLowerCase().includes(sourceQuery.toLocaleLowerCase()))) {
        const button = element('button', source.path, 'constraint-module-link'); button.type = 'button';
        button.setAttribute('aria-pressed', String(source.path === sourcePath));
        button.onclick = () => { sourcePath = source.path; range = undefined; renderList(); renderDetail(); };
        list.append(button);
      }
      if (!list.childElementCount) list.append(element('p', text('没有匹配的来源路径', 'No matching source paths')));
    };
    search.oninput = () => { sourceQuery = search.value; renderList(); };
    renderList(); renderDetail();
  }
  return {
    refresh(currentModule: string | undefined) { moduleId = currentModule; renderRules(); renderSources(); },
    relatedRules(currentModule: string) { return catalog.rules.filter(rule => rule.modules?.includes(currentModule)); },
    selectRule(id: string) { selected = id; moduleOnly = false; query = ''; renderRules(); },
  };
}
