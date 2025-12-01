import { useState, useEffect, useCallback } from 'react';
import { Customer, CustomerType, CustomerFormData, Contact } from '../types';
import { INITIAL_CUSTOMERS } from '../constants';

export const useCustomerData = () => {
  // Persist to local storage or fall back to initial data
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('customer_db_v2'); // Changed key to force refresh for new schema or handle migration logic manually
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  useEffect(() => {
    localStorage.setItem('customer_db_v2', JSON.stringify(customers));
  }, [customers]);

  const getParents = useCallback(() => {
    return customers.filter((c) => c.type === CustomerType.PARENT);
  }, [customers]);

  const getDirectCustomers = useCallback(() => {
    return customers.filter((c) => c.type === CustomerType.DIRECT);
  }, [customers]);

  const checkAccountNumberUnique = useCallback((accountNumber: string, excludeId?: string) => {
    return !customers.some(
      (c) => c.accountNumber === accountNumber && c.id !== excludeId
    );
  }, [customers]);

  const validateCustomer = (data: CustomerFormData, existingId?: string): string[] => {
    const errors: string[] = [];

    // Basic Fields
    if (!data.name.trim()) errors.push('Customer Name is required.');
    if (!data.accountNumber.trim()) errors.push('Account Number is required.');
    
    if (!checkAccountNumberUnique(data.accountNumber, existingId)) {
      errors.push(`Account Number '${data.accountNumber}' is already in use.`);
    }

    // Address Validation
    if (data.addresses.length === 0) {
      errors.push('At least one address is required.');
    } else {
        const primaryCount = data.addresses.filter(a => a.isPrimary).length;
        if (primaryCount === 0) errors.push('You must designate exactly one Primary Location address.');
        if (primaryCount > 1) errors.push('Only one address can be marked as the Primary Location.');

        const billingCount = data.addresses.filter(a => a.isBilling).length;
        if (billingCount === 0) errors.push('You must designate exactly one Billing Address.');
        if (billingCount > 1) errors.push('Only one address can be marked as the Billing Address.');

        data.addresses.forEach((addr, idx) => {
            const hasStreet = !!addr.street?.trim();
            const hasLatLong = !!addr.latitude?.trim() && !!addr.longitude?.trim();
            
            if (!hasStreet && !hasLatLong) {
                errors.push(`Address #${idx + 1}: Must provide either Street Address OR Latitude + Longitude.`);
            }
            if (!addr.city.trim()) errors.push(`Address #${idx + 1}: City is required.`);
            if (!addr.state.trim()) errors.push(`Address #${idx + 1}: State is required.`);
            if (!addr.zipCode.trim()) errors.push(`Address #${idx + 1}: Zip Code is required.`);
        });
    }

    // Contact Validation
    if (data.contacts.length === 0) {
      errors.push('At least one contact person is required.');
    } else {
        const primaryContacts = data.contacts.filter((c) => c.isPrimary).length;
        if (primaryContacts === 0) errors.push('You must designate exactly one Primary Contact.');
        if (primaryContacts > 1) errors.push('Only one contact can be marked as Primary.');
        
        data.contacts.forEach((c, idx) => {
            if(!c.name.trim()) errors.push(`Contact #${idx + 1}: Name is required.`);
            if(!c.email.trim()) errors.push(`Contact #${idx + 1}: Email is required.`);
            if(!c.phone.trim()) errors.push(`Contact #${idx + 1}: Phone is required.`);
        });
    }

    if (data.type === CustomerType.PARENT && data.parentId) {
       errors.push('A Parent Customer cannot have a Parent.');
    }

    return errors;
  };

  const addCustomer = (data: CustomerFormData, childIdsToLink: string[] = []) => {
    const newCustomer: Customer = {
      ...data,
      id: `cust_${Date.now()}`,
      createdAt: new Date().toISOString(),
      // Ensure undefined is handled for non-direct types
      parentId: data.type === CustomerType.DIRECT ? data.parentId : undefined,
    };

    setCustomers((prev) => {
      let updated = [...prev, newCustomer];
      
      // If creating a parent, we might need to link existing direct customers to this new parent
      if (data.type === CustomerType.PARENT && childIdsToLink.length > 0) {
        updated = updated.map(c => {
          if (childIdsToLink.includes(c.id)) {
            // When linking a child, we must ensure it is marked as DIRECT and assigned the parent
            return { ...c, parentId: newCustomer.id, type: CustomerType.DIRECT };
          }
          return c;
        });
      }
      return updated;
    });
  };

  const batchAddCustomers = (newCustomers: Customer[]) => {
    setCustomers(prev => [...prev, ...newCustomers]);
  };

  const updateCustomer = (id: string, data: CustomerFormData, childIdsToLink: string[] = []) => {
    setCustomers((prev) => {
      let updated = prev.map((c) => (c.id === id ? { ...c, ...data } : c));
      
      // Handle Parent Re-linking logic if this is a parent
      if (data.type === CustomerType.PARENT) {
         // 1. Unassign any children that are NO LONGER in the childIdsToLink list but were previously assigned to this parent
         updated = updated.map(c => {
             if(c.parentId === id && !childIdsToLink.includes(c.id)) {
                 // Unassign: Remove parentId and revert to PARENT (Independent)
                 return { ...c, parentId: null, type: CustomerType.PARENT }; 
             }
             return c;
         });

         // 2. Assign new children
         updated = updated.map(c => {
             if(childIdsToLink.includes(c.id)) {
                 // Assign: Set parentId and force type to DIRECT
                 return { ...c, parentId: id, type: CustomerType.DIRECT };
             }
             return c;
         });
      }

      return updated;
    });
  };

  const deleteCustomer = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;

    if (customer.type === CustomerType.PARENT) {
      // Logic: Auto-convert children to standalone direct customers (which now means Independent Parents)
      setCustomers((prev) => {
        // First, update children to remove parentId and set to Independent (Type PARENT)
        const updatedList = prev.map((c) => {
          if (c.parentId === id) {
            return { ...c, parentId: null, type: CustomerType.PARENT };
          }
          return c;
        });
        // Then remove the parent
        return updatedList.filter((c) => c.id !== id);
      });
    } else {
      // Direct customer - simple delete
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  };

  return {
    customers,
    getParents,
    getDirectCustomers,
    checkAccountNumberUnique,
    validateCustomer,
    addCustomer,
    batchAddCustomers,
    updateCustomer,
    deleteCustomer,
  };
};