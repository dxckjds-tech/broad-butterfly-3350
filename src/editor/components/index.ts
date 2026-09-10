/**
 * Registration side-effect module. Import once (see `main.tsx`) before the
 * editor renders. Adding a component means adding a file here — the editor
 * core stays untouched.
 */
import './RootComponent'
import './SectionComponent'
import './ContainerComponent'
import './ColumnsComponent'
import './HeadingComponent'
import './TextComponent'
import './ImageComponent'
import './ButtonComponent'
import './SpacerComponent'
// MIC library (v0.3.0 Step 2). Registers via registerComponent(); registry.ts is unchanged.
import '../../mic/components'
