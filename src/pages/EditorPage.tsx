import { EditorShell } from '../editor/layout/EditorShell'

/** Route-level page. Keeps `App` free of editor internals. */
export function EditorPage() {
  return <EditorShell />
}
