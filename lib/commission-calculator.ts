/**
 * Commission Calculator with User-Configurable GST
 * 
 * Since Aayam works with ALL printing materials and GST policies change,
 * this calculator allows users to input GST % for each project.
 */

export interface CommissionInput {
    projectTotalAmount: number; // Total invoice amount (including GST)
    gstPercentage: number; // User inputs this (12%, 18%, 28%, etc.)
    commissionType: 'percentage' | 'fixed';
    commissionValue: number; // Either % or fixed ₹ amount
}

export interface CommissionResult {
    projectTotalAmount: number;
    gstPercentage: number;
    gstAmount: number;
    baseAmount: number;
    commissionType: 'percentage' | 'fixed';
    commissionValue: number;
    commissionAmount: number;
    breakdown: string; // Human-readable calculation breakdown
}

/**
 * Calculate commission with user-provided GST %
 * 
 * Example 1: Pouch (12% GST)
 * - Total: ₹56,000
 * - GST: 12%
 * - Base: ₹50,000
 * - Commission (5%): ₹2,500
 * 
 * Example 2: Box (18% GST)
 * - Total: ₹1,18,000
 * - GST: 18%
 * - Base: ₹1,00,000
 * - Commission (5%): ₹5,000
 */
export function calculateCommission(input: CommissionInput): CommissionResult {
    const { projectTotalAmount, gstPercentage, commissionType, commissionValue } = input;

    // Step 1: Calculate GST Amount
    // Formula: GST Amount = (Total × GST%) / (100 + GST%)
    const gstAmount = (projectTotalAmount * gstPercentage) / (100 + gstPercentage);

    // Step 2: Calculate Base Amount (excluding GST)
    // Formula: Base = Total - GST
    const baseAmount = projectTotalAmount - gstAmount;

    // Step 3: Calculate Commission
    let commissionAmount: number;
    let breakdown: string;

    if (commissionType === 'percentage') {
        // Commission = Base Amount × Commission %
        commissionAmount = (baseAmount * commissionValue) / 100;
        breakdown = `₹${projectTotalAmount.toLocaleString()} (Total) → ` +
            `₹${gstAmount.toFixed(2)} (${gstPercentage}% GST) = ` +
            `₹${baseAmount.toFixed(2)} (Base) × ${commissionValue}% = ` +
            `₹${commissionAmount.toFixed(2)} (Commission)`;
    } else {
        // Fixed commission
        commissionAmount = commissionValue;
        breakdown = `Fixed commission: ₹${commissionAmount.toLocaleString()}`;
    }

    return {
        projectTotalAmount,
        gstPercentage,
        gstAmount: parseFloat(gstAmount.toFixed(2)),
        baseAmount: parseFloat(baseAmount.toFixed(2)),
        commissionType,
        commissionValue,
        commissionAmount: parseFloat(commissionAmount.toFixed(2)),
        breakdown
    };
}

/**
 * Get common GST rates for quick selection
 * User can still input custom % if needed
 */
export const COMMON_GST_RATES = [
    { label: '12% - Pouch & Similar', value: 12 },
    { label: '18% - Box, Label, Sticker, Most Printing', value: 18 },
    { label: '28% - Special Cases', value: 28 },
    { label: '5% - Low Rate Items', value: 5 },
    { label: 'Custom', value: 0 }, // User inputs custom
];

/**
 * Validate commission inputs
 */
export function validateCommissionInput(input: CommissionInput): string[] {
    const errors: string[] = [];

    if (input.projectTotalAmount <= 0) {
        errors.push('Project total amount must be greater than 0');
    }

    if (input.gstPercentage < 0 || input.gstPercentage > 100) {
        errors.push('GST percentage must be between 0 and 100');
    }

    if (input.commissionValue <= 0) {
        errors.push('Commission value must be greater than 0');
    }

    if (input.commissionType === 'percentage' && input.commissionValue > 100) {
        errors.push('Commission percentage cannot exceed 100%');
    }

    return errors;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

/**
 * Example usage:
 * 
 * const result = calculateCommission({
 *   projectTotalAmount: 56000,
 *   gstPercentage: 12,  // User inputs this
 *   commissionType: 'percentage',
 *   commissionValue: 5
 * });
 * 
 * console.log(result.breakdown);
 * // "₹56,000 (Total) → ₹6,000 (12% GST) = ₹50,000 (Base) × 5% = ₹2,500 (Commission)"
 */
