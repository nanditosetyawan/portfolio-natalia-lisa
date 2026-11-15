const fs = require('fs');
const filePath = 'src/pages/admin/AdminEdit.vue';
let content = fs.readFileSync(filePath, 'utf8');

const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

function normalize(str) {
  return str.split(/\r?\n/).join('\n');
}

function replaceNormalized(src, search, rep) {
  const normSrc = normalize(src);
  const normSearch = normalize(search);
  if (!normSrc.includes(normSearch)) {
    throw new Error('Pattern not found: ' + normSearch.slice(0, 80));
  }
  const crlfSearch = normSearch.split('\n').join(eol);
  const crlfRep = normalize(rep).split('\n').join(eol);
  return src.replace(crlfSearch, crlfRep);
}

// Update selectedPanelGroups so all groups remain in the Map, but properties inside are filtered when query is present
const target1 = `const selectedPanelGroups = computed<PanelGroup[]>(() => {
  const query = propertySearch.value.trim().toLowerCase()
  const groups = new Map<string, { label: string; order: number; presentation: 'inline' | 'accordion'; properties: InspectorPanelProperty[] }>()
  for (const property of inspectorPanelProperties.value) {
    if (query && !propertyMatchesQuery(property, query)) continue
    const category = property.metadata.category
    const current = groups.get(category) ?? {
      label: property.metadata.categoryLabel ?? category.toUpperCase(),
      order: property.metadata.categoryOrder ?? 100,
      presentation: property.metadata.presentation ?? 'accordion',
      properties: []
    }
    current.properties.push(property)
    groups.set(category, current)
  }
  return [...groups.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([key, group]) => {
      const rows = new Map<string, InspectorPanelProperty[]>()
      for (const property of group.properties.sort((left, right) => left.metadata.order - right.metadata.order)) {
        const rowKey = property.metadata.rowKey ?? property.inspectorKey
        rows.set(rowKey, [...(rows.get(rowKey) ?? []), property])
      }
      return { key, label: group.label, presentation: group.presentation, rows: [...rows.entries()].map(([rowKey, properties]) => ({ key: rowKey, properties })) }
    })
})`;

const replacement1 = `const selectedPanelGroups = computed<PanelGroup[]>(() => {
  const query = propertySearch.value.trim().toLowerCase()
  const groups = new Map<string, { label: string; order: number; presentation: 'inline' | 'accordion'; properties: InspectorPanelProperty[] }>()
  for (const property of inspectorPanelProperties.value) {
    const category = property.metadata.category
    const current = groups.get(category) ?? {
      label: property.metadata.categoryLabel ?? category.toUpperCase(),
      order: property.metadata.categoryOrder ?? 100,
      presentation: property.metadata.presentation ?? 'accordion',
      properties: []
    }
    if (!query || propertyMatchesQuery(property, query)) {
      current.properties.push(property)
    }
    groups.set(category, current)
  }
  return [...groups.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([key, group]) => {
      const rows = new Map<string, InspectorPanelProperty[]>()
      for (const property of group.properties.sort((left, right) => left.metadata.order - right.metadata.order)) {
        const rowKey = property.metadata.rowKey ?? property.inspectorKey
        rows.set(rowKey, [...(rows.get(rowKey) ?? []), property])
      }
      return { key, label: group.label, presentation: group.presentation, rows: [...rows.entries()].map(([rowKey, properties]) => ({ key: rowKey, properties })) }
    })
})`;

content = replaceNormalized(content, target1, replacement1);

// Also in the accordion content, if search query is active and group has 0 matching properties, show a small note:
const target2 = `          <div v-if="group.presentation === 'inline' || editor.activeAccordion === group.key" class="accordion-content">
            <div
              v-for="row in group.rows"`;

const replacement2 = `          <div v-if="group.presentation === 'inline' || editor.activeAccordion === group.key" class="accordion-content">
            <p v-if="propertySearch.trim() && !group.rows.length" class="empty-group-search">Tidak ada pengaturan di kategori ini yang cocok.</p>
            <div
              v-for="row in group.rows"`;

// Add CSS for empty-group-search
const target3 = `.reset-search-btn:hover { background: #fce6e8; }`;
const replacement3 = `.reset-search-btn:hover { background: #fce6e8; }
.empty-group-search { padding: .75rem; color: #92796d; font-size: .68rem; font-style: italic; }`;

content = replaceNormalized(content, target2, replacement2);
content = replaceNormalized(content, target3, replacement3);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated selectedPanelGroups in AdminEdit.vue');
