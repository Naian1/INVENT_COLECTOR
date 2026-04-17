export type Printer = {
  id: string;
  display_name: string | null;
  hostname: string | null;
  sector: string;
  location: string | null;
  asset_tag: string | null;
  serial_number: string | null;
  model: string;
  manufacturer: string | null;
  ip_address: string;
  mac_address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

export type CreatePrinterInput = {
  display_name?: string | null;
  hostname?: string | null;
  sector: string;
  location?: string | null;
  asset_tag?: string | null;
  serial_number?: string | null;
  model: string;
  manufacturer?: string | null;
  ip_address: string;
  mac_address?: string | null;
  is_active?: boolean;
};

export type UpdatePrinterInput = Partial<CreatePrinterInput>;
