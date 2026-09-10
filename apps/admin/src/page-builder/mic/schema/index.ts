/**
 * Public barrel for the MIC product-detail schema.
 * Page-builder core modules must not import from here in v0.3.0 Step 1 —
 * only the adapter and AI protocol consume these types.
 */
export { asEnum, asNumber, asString, asStringArray, isRecord } from './coerce'
export {
  emptyImageSchema,
  parseImageSchema,
  parseImageSchemaList,
  IMAGE_SOURCES,
  IMAGE_TYPES,
} from './image'
export type { ImageSchema, ImageSource, ImageType } from './image'
export { emptyCompanySchema, parseCompanySchema } from './company'
export type { CompanySchema } from './company'
export {
  emptyProductSchema,
  emptySourceInfo,
  parseProductSchema,
} from './product'
export type { FAQ, ProductSchema, SourceInfo, Specification } from './product'
export {
  createMICPageSchema,
  emptyMICPageSchema,
  MIC_PAGE_VERSION,
  parseMICPageSchema,
} from './page'
export type { MICPageMetadata, MICPageSchema } from './page'
