// Product Requirement Templates
// Defines the fields needed for each product category in Design + Print orders

export interface RequirementField {
    field: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea';
    options?: string[];
    required?: boolean;
    placeholder?: string;
    unit?: string;
}

export const productRequirementTemplates: Record<string, RequirementField[]> = {
    box: [
        {
            field: 'dimensions',
            label: 'Dimensions (L x W x H)',
            type: 'text',
            required: true,
            placeholder: 'e.g., 10 x 5 x 3 cm',
        },
        {
            field: 'material',
            label: 'Material',
            type: 'select',
            options: ['Cardboard', 'Corrugated', 'Kraft Paper', 'Rigid Box', 'E-Flute'],
            required: true,
        },
        {
            field: 'coating',
            label: 'Coating/Finish',
            type: 'select',
            options: ['Matte Lamination', 'Glossy Lamination', 'Spot UV', 'Embossing', 'None'],
        },
        {
            field: 'printing_sides',
            label: 'Printing Sides',
            type: 'select',
            options: ['Outside Only', 'Inside Only', 'Both Sides'],
            required: true,
        },
        {
            field: 'quantity',
            label: 'Quantity',
            type: 'number',
            required: true,
            placeholder: '1000',
        },
        {
            field: 'special_features',
            label: 'Special Features',
            type: 'textarea',
            placeholder: 'Window cutout, magnetic closure, ribbon, etc.',
        },
    ],

    pouch: [
        {
            field: 'size',
            label: 'Size (W x H)',
            type: 'text',
            required: true,
            placeholder: 'e.g., 15 x 20 cm',
        },
        {
            field: 'material',
            label: 'Material',
            type: 'select',
            options: ['BOPP', 'PET', 'Aluminum Foil', 'Kraft Paper', 'Metalized Film'],
            required: true,
        },
        {
            field: 'pouch_type',
            label: 'Pouch Type',
            type: 'select',
            options: ['Stand-Up', 'Flat', 'Zipper', 'Spout', 'Three-Side Seal', 'Center Seal'],
            required: true,
        },
        {
            field: 'zipper',
            label: 'Zipper Type',
            type: 'select',
            options: ['None', 'Zip Lock', 'Slider Zipper', 'Press-to-Close'],
        },
        {
            field: 'window',
            label: 'Transparent Window',
            type: 'checkbox',
        },
        {
            field: 'quantity',
            label: 'Quantity',
            type: 'number',
            required: true,
        },
        {
            field: 'additional_features',
            label: 'Additional Features',
            type: 'textarea',
            placeholder: 'Tear notch, euro hole, valve, etc.',
        },
    ],

    label: [
        {
            field: 'shape',
            label: 'Label Shape',
            type: 'select',
            options: ['Rectangle', 'Circle', 'Oval', 'Square', 'Die-Cut Custom'],
            required: true,
        },
        {
            field: 'size',
            label: 'Size',
            type: 'text',
            required: true,
            placeholder: 'e.g., 5 x 3 cm',
        },
        {
            field: 'material',
            label: 'Material',
            type: 'select',
            options: ['Paper', 'Vinyl', 'Transparent/Clear', 'Metallic', 'Waterproof'],
            required: true,
        },
        {
            field: 'finish',
            label: 'Finish',
            type: 'select',
            options: ['Matte', 'Glossy', 'Metallic', 'Holographic', 'Uncoated'],
        },
        {
            field: 'adhesive',
            label: 'Adhesive Type',
            type: 'select',
            options: ['Permanent', 'Removable', 'Repositionable'],
            required: true,
        },
        {
            field: 'quantity',
            label: 'Quantity',
            type: 'number',
            required: true,
        },
    ],

    sticker: [
        {
            field: 'shape',
            label: 'Sticker Shape',
            type: 'select',
            options: ['Rectangle', 'Circle', 'Die-Cut', 'Kiss-Cut', 'Square'],
            required: true,
        },
        {
            field: 'size',
            label: 'Size',
            type: 'text',
            required: true,
            placeholder: 'e.g., 5 x 5 cm',
        },
        {
            field: 'material',
            label: 'Material',
            type: 'select',
            options: ['Vinyl', 'Paper', 'Holographic', 'Transparent', 'Metallic'],
            required: true,
        },
        {
            field: 'lamination',
            label: 'Lamination',
            type: 'checkbox',
        },
        {
            field: 'finish',
            label: 'Finish',
            type: 'select',
            options: ['Glossy', 'Matte', 'Holographic', 'None'],
        },
        {
            field: 'quantity',
            label: 'Quantity',
            type: 'number',
            required: true,
        },
        {
            field: 'format',
            label: 'Format',
            type: 'select',
            options: ['Individual Sheets', 'Roll'],
        },
    ],

    other: [
        {
            field: 'product_name',
            label: 'Product Name',
            type: 'text',
            required: true,
        },
        {
            field: 'specifications',
            label: 'Detailed Specifications',
            type: 'textarea',
            required: true,
            placeholder: 'Describe all product requirements in detail...',
        },
        {
            field: 'quantity',
            label: 'Quantity',
            type: 'number',
            required: true,
        },
    ],
};

// Helper to get product category display name
export const productCategoryNames: Record<string, string> = {
    box: 'Box / Packaging',
    pouch: 'Pouch / Bag',
    label: 'Label',
    sticker: 'Sticker / Decal',
    other: 'Other Product',
};
