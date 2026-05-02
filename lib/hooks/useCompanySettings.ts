'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CompanySettings {
  // Basic
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyPincode: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;
  // Bank
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  // Quotation
  quotationTerms: string;
}

const FALLBACK: CompanySettings = {
  companyName: 'aayam communication',
  companyAddress: 'ProPrintPack, Qtr. 92, Udhyog Nagar Colony',
  companyCity: 'Rajkot',
  companyState: 'Gujarat',
  companyPincode: '360002',
  companyPhone: '9537511100',
  companyEmail: 'info@aayam.com',
  companyGstin: '24AAJFA6574G1ZE',
  bankName: 'HDFC Bank',
  bankAccount: '01012560013911',
  bankIfsc: 'HDFC0000101',
  bankBranch: 'Rajkot',
  quotationTerms:
    '30% Payment in Advance & 70% Before Dispatch.\nDelivery Time 15-18 Days F.O.R. Rajkot, Gujarat.\nThis Quote is valid till one month from today\'s date.\nTax will be at the actual.',
};

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

      if (!error && data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setSettings({
            companyName:    parsed.companyName    || FALLBACK.companyName,
            companyAddress: parsed.address        || FALLBACK.companyAddress,
            companyCity:    parsed.city           || FALLBACK.companyCity,
            companyState:   parsed.state          || FALLBACK.companyState,
            companyPincode: parsed.pincode        || FALLBACK.companyPincode,
            companyPhone:   parsed.phone          || FALLBACK.companyPhone,
            companyEmail:   parsed.email          || FALLBACK.companyEmail,
            companyGstin:   parsed.gstNumber      || FALLBACK.companyGstin,
            bankName:       parsed.bankName       || FALLBACK.bankName,
            bankAccount:    parsed.bankAccount    || FALLBACK.bankAccount,
            bankIfsc:       parsed.bankIfsc       || FALLBACK.bankIfsc,
            bankBranch:     parsed.bankBranch     || FALLBACK.bankBranch,
            quotationTerms: parsed.quotationTerms || FALLBACK.quotationTerms,
          });
        } catch { /* ignore parse errors, fallback stays */ }
      }
      setLoading(false);
    };
    load();
  }, []);

  return { settings, loading };
}
