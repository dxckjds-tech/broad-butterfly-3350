/**
 * Machinery (CNC / industrial equipment) MIC page template.
 * Order: Hero → Feature → Specification → Factory → Certification → Packaging → FAQ
 */
import { createMICPageSchema } from '../schema/page'
import type { MICPageSchema } from '../schema/page'

export const MACHINERY_TEMPLATE_ID = 'mic-machinery'

export function buildMachineryPage(): MICPageSchema {
  return createMICPageSchema({
    product: {
      id: 'mic-tmpl-machinery',
      productName: 'CNC Vertical Machining Center VMC-850',
      category: 'Machine Tools',
      keywords: ['CNC', 'VMC', 'machining center', 'BT40'],
      images: [
        { id: 'img-m-1', url: 'https://cdn.example.com/vmc-main.jpg', type: 'main', order: 0, source: 'PAGE' },
        { id: 'img-m-2', url: 'https://cdn.example.com/vmc-feat-1.jpg', type: 'feature', order: 1, source: 'PAGE' },
        { id: 'img-m-3', url: 'https://cdn.example.com/vmc-feat-2.jpg', type: 'feature', order: 2, source: 'PAGE' },
        { id: 'img-m-4', url: 'https://cdn.example.com/vmc-feat-3.jpg', type: 'feature', order: 3, source: 'PAGE' },
        { id: 'img-m-5', url: 'https://cdn.example.com/vmc-plant.jpg', type: 'factory', order: 4, source: 'PAGE' },
        { id: 'img-m-6', url: 'https://cdn.example.com/vmc-line.jpg', type: 'application', order: 5, source: 'PAGE' },
        { id: 'img-m-7', url: 'https://cdn.example.com/vmc-ce.jpg', type: 'certificate', order: 6, source: 'PAGE' },
      ],
      description:
        'High-rigidity Meehanite casting\nBox-way design keeps cutting stable at full load.\n\n24-tool ATC as standard\nShort chip-to-chip time for mixed small batches.\n\nFanuc 0i-MF Plus ready\nOptional Siemens or Mitsubishi CNC on request.',
      specifications: [
        { name: 'X / Y / Z travel', value: '850 / 500 / 550 mm' },
        { name: 'Spindle', value: '8000 rpm, BT40' },
        { name: 'Table size', value: '1000 × 500 mm' },
        { name: 'Positioning accuracy', value: '±0.008 mm' },
      ],
      certifications: ['CE', 'ISO9001'],
      packaging:
        'Wooden case with moisture barrier, one machine per crate.\nShipping: FOB Shanghai, 35 days after deposit',
      faq: [
        { question: 'Do you offer OEM colours?', answer: 'Yes. MOQ 1 set for colour change.' },
        { question: 'What is the warranty?', answer: '12 months after installation, excluding wear parts.' },
      ],
      companyProfile: 'CNC machine builder in Jiangsu since 2003.',
      sourceInfo: { url: '', platform: 'MIC', externalId: '' },
    },
    company: {
      name: 'Jiangsu Precision Machinery Co., Ltd.',
      description: 'Export-oriented VMC and lathe manufacturer.',
      factoryImages: ['https://cdn.example.com/vmc-yard.jpg'],
      certifications: ['ISO14001'],
      capacity: '80 sets/month',
      employees: '320',
    },
  })
}
