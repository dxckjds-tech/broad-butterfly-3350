/**
 * MIC component barrel.
 *
 * Importing this module registers the eight MIC types via `registerComponent()`
 * (same pattern as `editor/components`, without editing `registry.ts`).
 */
import './MICProductHero'
import './MICFeatureSection'
import './MICSpecificationTable'
import './MICCertification'
import './MICFactoryGallery'
import './MICPackaging'
import './MICFAQ'
import './MICCompanyProfile'

export { MICProductHero } from './MICProductHero'
export type { ProductHeroProps } from './MICProductHero'
export { MICFeatureSection } from './MICFeatureSection'
export type { FeatureSectionProps } from './MICFeatureSection'
export { MICSpecificationTable } from './MICSpecificationTable'
export type { SpecificationTableProps } from './MICSpecificationTable'
export { MICCertification } from './MICCertification'
export type { CertificationProps } from './MICCertification'
export { MICFactoryGallery } from './MICFactoryGallery'
export type { FactoryGalleryProps } from './MICFactoryGallery'
export { MICPackaging } from './MICPackaging'
export type { PackagingProps } from './MICPackaging'
export { MICFAQ } from './MICFAQ'
export type { FAQProps } from './MICFAQ'
export { MICCompanyProfile } from './MICCompanyProfile'
export type { CompanyProfileProps } from './MICCompanyProfile'
export { MIC_COMPONENT_TYPES, MIC_ALLOWED_PARENTS } from './types'
export type { MicComponentNode, MicComponentType } from './types'
