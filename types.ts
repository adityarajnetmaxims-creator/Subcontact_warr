export enum CustomerType {
  DIRECT = 'DIRECT',
  PARENT = 'PARENT',
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface Address {
  id: string;
  street?: string;
  latitude?: string;
  longitude?: string;
  city: string;
  state: string;
  zipCode: string;
  isPrimary: boolean;
  isBilling: boolean;
  isGateProperty: boolean;
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  accountNumber: string;
  isVip: boolean;
  addresses: Address[];
  parentId?: string | null; // Only for Direct customers
  contacts: Contact[];
  createdAt: string;
}

export interface CustomerFormData {
  type: CustomerType;
  name: string;
  accountNumber: string;
  isVip: boolean;
  addresses: Address[];
  parentId: string | null;
  contacts: Contact[];
}

export type SortField = 'name' | 'accountNumber' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}