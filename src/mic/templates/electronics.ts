/**
 * Electronics (LED / power / PCB) MIC page template.
 */
import { createMICPageSchema } from '../schema/page'
import type { MICPageSchema } from '../schema/page'

export const ELECTRONICS_TEMPLATE_ID = 'mic-electronics'

export function buildElectronicsPage(): MICPageSchema {
  return createMICPageSchema({
    product: {
      id: 'mic-tmpl-electronics',
      productName: '100W Constant Current LED Driver',
      category: 'LED Drivers',
      keywords: ['LED driver', '100W', 'IP67', 'constant current'],
      images: [
        { id: 'img-e-1', url: 'https://cdn.example.com/driver-main.jpg', type: 'main', order: 0, source: 'PAGE' },
        { id: 'img-e-2', url: 'https://cdn.example.com/driver-feat.jpg', type: 'feature', order: 1, source: 'PAGE' },
        { id: 'img-e-3', url: 'https://cdn.example.com/driver-smt.jpg', type: 'application', order: 2, source: 'PAGE' },
        { id: 'img-e-4', url: 'https://cdn.example.com/driver-ul.jpg', type: 'certificate', order: 3, source: 'PAGE' },
      ],
      description:
        'IP67 aluminium housing\nPotting compound for outdoor luminaires.\n\n0–10V / PWM dimming\nFlicker-free output for high-end fixtures.',
      specifications: [
        { name: 'Output', value: '100W, 2.1A' },
        { name: 'Input', value: '100–277VAC' },
        { name: 'Efficiency', value: '≥ 92%' },
        { name: 'IP rating', value: 'IP67' },
      ],
      certifications: ['UL', 'CE', 'RoHS'],
      packaging:
        'Neutral white box, 20 pcs/carton.\nShipping: EXW Shenzhen, 12 days',
      faq: [
        { question: 'Can you print our logo?', answer: 'Yes, MOQ 500 pcs.' },
        { question: 'Dimming types?', answer: '0–10V, PWM and resistance dimming on one model.' },
      ],
      companyProfile: 'LED power supply factory in Shenzhen.',
      sourceInfo: { url: '', platform: 'MIC', externalId: '' },
    },
    company: {
      name: 'Shenzhen Bright Power Co., Ltd.',
      description: 'LED drivers for street and industrial lighting.',
      factoryImages: [],
      certifications: ['ISO9001'],
      capacity: '200,000 pcs/month',
      employees: '180',
    },
  })
}
