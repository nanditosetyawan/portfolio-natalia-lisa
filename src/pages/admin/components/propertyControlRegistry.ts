import type { Component } from 'vue'
import type { EditorControl } from '../../../types/editor'
import PropertyButtonControl from './property-controls/PropertyButtonControl.vue'
import PropertyCheckboxControl from './property-controls/PropertyCheckboxControl.vue'
import PropertyFileControl from './property-controls/PropertyFileControl.vue'
import PropertyInputControl from './property-controls/PropertyInputControl.vue'
import PropertyReadonlyControl from './property-controls/PropertyReadonlyControl.vue'
import PropertySelectControl from './property-controls/PropertySelectControl.vue'
import PropertyTextareaControl from './property-controls/PropertyTextareaControl.vue'
import PropertyColorControl from './property-controls/PropertyColorControl.vue'
import PropertySegmentedControl from './property-controls/PropertySegmentedControl.vue'
import PropertyThumbnailControl from './property-controls/PropertyThumbnailControl.vue'
import PropertyToggleValueControl from './property-controls/PropertyToggleValueControl.vue'

const renderers = new Map<EditorControl, Component>([
  ['text', PropertyInputControl],
  ['custom', PropertyInputControl],
  ['number', PropertyInputControl],
  ['color', PropertyColorControl],
  ['textarea', PropertyTextareaControl],
  ['select', PropertySelectControl],
  ['checkbox', PropertyCheckboxControl],
  ['file', PropertyFileControl],
  ['button', PropertyButtonControl],
  ['readonly', PropertyReadonlyControl],
  ['toggle-text', PropertyToggleValueControl],
  ['toggle-color', PropertyToggleValueControl],
  ['segmented', PropertySegmentedControl],
  ['thumbnail', PropertyThumbnailControl]
])

export function registerPropertyControlRenderer(control: EditorControl, component: Component): void {
  renderers.set(control, component)
}

export function getPropertyControlRenderer(control: EditorControl): Component {
  const renderer = renderers.get(control)
  if (!renderer) throw new Error(`No Property Control renderer is registered for ${control}.`)
  return renderer
}
