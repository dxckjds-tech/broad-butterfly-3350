import { emptyPageData, type PlatformPageData } from '@trade-ai/shared-types';

function listing(overrides: Partial<PlatformPageData>): PlatformPageData {
  return emptyPageData({
    platform: 'MADE_IN_CHINA',
    pageType: 'MIC_PRODUCT_EDIT',
    url: `https://membercenter.made-in-china.com/product/${overrides.productName ?? 'x'}`,
    ...overrides,
  });
}

export const FIXTURES: Record<string, PlatformPageData> = {
  vacuum: listing({
    productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
    title: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
    category: 'Steam Cleaner',
    keywords: ['Steam Cleaner', 'Wet and Dry Vacuum Cleaner', 'Hospital Vacuum Cleaner', 'Eco-Friendly Vacuum Cleaner'],
    specifications: {
      Type: 'Wet and Dry Vacuum Cleaner',
      Power: '3000W',
      Suction: 'High Suction',
      Material: 'Stainless Steel',
      Application: 'Industrial workshop',
    },
    description: 'High quality industrial cleaner. Best quality factory price. Welcome to inquiry our hot sale product for export.',
    certifications: [],
  }),
  pump: listing({
    productName: 'Stainless Steel Centrifugal Water Pump for Irrigation',
    title: 'Stainless Steel Centrifugal Water Pump for Irrigation',
    category: 'Water Pump',
    keywords: ['ISO 9001 Water Pump', 'Garden Fountain Pump'],
    specifications: { Type: 'Centrifugal Water Pump', Power: '1.5kW', Material: 'Stainless Steel', Application: 'Irrigation' },
    description: 'Centrifugal water pump with stainless steel housing for irrigation systems.',
  }),
  cnc: listing({
    productName: '3 Axis CNC Milling Machine for Metal Parts',
    title: '3 Axis CNC Milling Machine for Metal Parts',
    category: 'CNC Machine',
    keywords: ['Medical Grade CNC Machine'],
    specifications: { Type: 'CNC Milling Machine', Axes: '3', Application: 'Metal parts' },
    description: 'CNC milling machine for metal parts. Travel 400mm. Suitable for metal prototype work.',
  }),
  vest: listing({
    productName: 'High Visibility Reflective Safety Vest for Construction',
    title: 'High Visibility Reflective Safety Vest for Construction',
    category: 'Safety Vest',
    keywords: ['Waterproof Safety Vest'],
    specifications: { Type: 'Reflective Safety Vest', Material: 'Polyester mesh', Size: 'L' },
    description: 'Reflective safety vest for construction sites. Polyester mesh fabric.',
  }),
  auto: listing({
    productName: 'Front Brake Pad Set for Passenger Car',
    title: 'Front Brake Pad Set for Passenger Car',
    category: 'Auto Brake Pad',
    keywords: ['Ceramic Brake Pad', 'Racing Brake Pad'],
    specifications: { Type: 'Brake Pad', Material: 'Ceramic', Application: 'Passenger car' },
    description: 'Front brake pad set for passenger car disc brakes.',
  }),
  aluminum: listing({
    productName: '6063 T5 Aluminum Extrusion Profile for Windows',
    title: '6063 T5 Aluminum Extrusion Profile for Windows',
    category: 'Aluminum Profile',
    keywords: ['Plastic Window Profile'],
    specifications: { Type: 'Aluminum Extrusion Profile', Material: 'Plastic PVC', Temper: 'T5' },
    description: 'Aluminum extrusion profile marketed for window frames.',
  }),
  packaging: listing({
    productName: 'Custom Printed Corrugated Carton Box for Shipping',
    title: 'Custom Printed Corrugated Carton Box for Shipping',
    category: 'Carton Box',
    keywords: ['Luxury Gift Box'],
    specifications: { Type: 'Corrugated Carton Box', Material: 'Kraft paper', Burst: '200PSI' },
    description: 'Corrugated carton box for shipping and export packing.',
  }),
  led: listing({
    productName: 'IP65 Waterproof LED Flood Light 50W',
    title: 'IP65 Waterproof LED Flood Light 50W',
    category: 'LED Flood Light',
    keywords: ['Solar LED Street Light'],
    specifications: {
      Type: 'LED Flood Light',
      Power: '50W',
      Material: 'Aluminum',
      Application: 'Outdoor',
      Waterproof: 'IP65',
    },
    description: 'LED flood light 50W. IP65 housing. Suitable for outdoor area lighting.',
  }),
  valve: listing({
    productName: 'Brass Ball Valve DN25 for Water Supply',
    title: 'Brass Ball Valve DN25 for Water Supply',
    category: 'Ball Valve',
    keywords: ['Food Grade Ball Valve', 'CE Ball Valve'],
    specifications: { Type: 'Ball Valve', Material: 'Brass', Size: 'DN25', Application: 'Water supply' },
    description: 'Brass ball valve DN25 for water supply pipelines.',
  }),
  furniture: listing({
    productName: 'Solid Wood Dining Chair with Fabric Seat',
    title: 'Solid Wood Dining Chair with Fabric Seat',
    category: 'Dining Chair',
    keywords: ['Office Mesh Chair'],
    specifications: { Type: 'Dining Chair', Material: 'Solid wood', Seat: 'Fabric' },
    description: 'Solid wood dining chair with fabric seat for home dining rooms.',
  }),
};
