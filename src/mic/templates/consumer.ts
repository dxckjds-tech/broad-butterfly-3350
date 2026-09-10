/**
 * Consumer-goods MIC page template (home appliances).
 */
import { createMICPageSchema } from '../schema/page'
import type { MICPageSchema } from '../schema/page'

export const CONSUMER_TEMPLATE_ID = 'mic-consumer'

export function buildConsumerPage(): MICPageSchema {
  return createMICPageSchema({
    product: {
      id: 'mic-tmpl-consumer',
      productName: 'Cordless Handheld Vacuum Cleaner',
      category: 'Home Appliances',
      keywords: ['vacuum', 'handheld', 'cordless', 'HEPA'],
      images: [
        { id: 'img-c-1', url: 'https://cdn.example.com/vac-main.jpg', type: 'main', order: 0, source: 'PAGE' },
        { id: 'img-c-2', url: 'https://cdn.example.com/vac-feat.jpg', type: 'feature', order: 1, source: 'PAGE' },
        { id: 'img-c-3', url: 'https://cdn.example.com/vac-factory.jpg', type: 'factory', order: 2, source: 'PAGE' },
      ],
      description:
        'Lightweight 1.2 kg body\nComfortable for stairs and car interiors.\n\nHEPA filtration\nTraps fine dust; washable filter included.',
      specifications: [
        { name: 'Battery', value: '22.2V 2000mAh' },
        { name: 'Runtime', value: '30 minutes' },
        { name: 'Weight', value: '1.2 kg' },
      ],
      certifications: ['CE', 'RoHS', 'FCC'],
      packaging:
        'Color box + carton, 6 pcs/carton.\nShipping: FOB Ningbo, 20 days',
      faq: [
        { question: 'Is it cordless?', answer: 'Yes, up to 30 minutes per charge.' },
        { question: 'Private label?', answer: 'Yes, MOQ 500 pcs.' },
      ],
      companyProfile: 'Home appliance OEM in Ningbo.',
      sourceInfo: { url: '', platform: 'MIC', externalId: '' },
    },
    company: {
      name: 'Ningbo Example Co., Ltd.',
      description: 'OEM vacuum manufacturer.',
      factoryImages: ['https://cdn.example.com/vac-plant.jpg'],
      certifications: ['BSCI'],
      capacity: '50,000 pcs/month',
      employees: '200+',
    },
  })
}
