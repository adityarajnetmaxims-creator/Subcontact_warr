import React, { useState, useEffect, useRef } from 'react';
import { Customer, CustomerType, CustomerFormData, Address } from '../types';
import { ContactManager } from './ContactManager';
import { ArrowLeft, Save, AlertTriangle, Building2, Crown, Plus, Trash2, Home, Link as LinkIcon, Unlink, Search, X } from 'lucide-react';

interface CustomerFormProps {
  initialData?: Customer;
  parents: Customer[];
  allCustomers: Customer[];
  onSubmit: (data: CustomerFormData, childIds?: string[]) => void;
  onCancel: () => void;
  validate: (data: CustomerFormData, id?: string) => string[];
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  initialData,
  parents,
  allCustomers,
  onSubmit,
  onCancel,
  validate,
}) => {
  const isEdit = !!initialData;
  
  // Initialize state. 
  // Logic: If parentId exists, it's DIRECT. If not, we treat it as PARENT (Top Level) by default for the form.
  const [formData, setFormData] = useState<CustomerFormData>({
    type: initialData?.parentId ? CustomerType.DIRECT : CustomerType.PARENT,
    name: initialData?.name || '',
    accountNumber: initialData?.accountNumber || '',
    isVip: initialData?.isVip || false,
    addresses: initialData?.addresses || [],
    parentId: initialData?.parentId || null,
    contacts: initialData?.contacts || [],
  });

  const [linkedChildIds, setLinkedChildIds] = useState<string[]>([]);
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData && initialData.type === CustomerType.PARENT) {
      // Find all children (anyone who points to this ID)
      const children = allCustomers.filter(c => c.parentId === initialData.id);
      setLinkedChildIds(children.map(c => c.id));
    }
  }, [initialData, allCustomers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  // Address Helper Functions
  const addAddress = () => {
    const newAddr: Address = {
        id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        street: '',
        city: '',
        state: '',
        zipCode: '',
        isPrimary: formData.addresses.length === 0,
        isBilling: formData.addresses.length === 0,
        isGateProperty: false
    };
    setFormData(prev => ({ ...prev, addresses: [...prev.addresses, newAddr] }));
  };

  const updateAddress = (id: string, field: keyof Address, value: any) => {
    setFormData(prev => ({
        ...prev,
        addresses: prev.addresses.map(a => {
            if (a.id !== id) return a;
            return { ...a, [field]: value };
        })
    }));
  };

  const removeAddress = (id: string) => {
    setFormData(prev => ({
        ...prev,
        addresses: prev.addresses.filter(a => a.id !== id)
    }));
  };

  const setUniqueAddressFlag = (id: string, field: 'isPrimary' | 'isBilling') => {
    setFormData(prev => ({
        ...prev,
        addresses: prev.addresses.map(a => ({
            ...a,
            [field]: a.id === id 
        }))
    }));
  };

  const handleChange = (field: keyof CustomerFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Parent Selection changes
  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParentId = e.target.value || null;
    
    setFormData(prev => ({
        ...prev,
        parentId: newParentId,
        // Auto-switch Type: Has Parent -> Direct, No Parent -> Parent
        type: newParentId ? CustomerType.DIRECT : CustomerType.PARENT
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const validationErrors = validate(formData, initialData?.id);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onSubmit(formData, linkedChildIds);
  };

  const toggleChildLink = (childId: string) => {
    setLinkedChildIds(prev => {
      if (prev.includes(childId)) {
        return prev.filter(id => id !== childId);
      } else {
        return [...prev, childId];
      }
    });
  };

  // Derived state for linked customers to display in the list
  const linkedCustomers = allCustomers.filter(c => linkedChildIds.includes(c.id));

  // Logic for search results
  // Candidates: Not self, and NOT already a parent to someone else (prevent >2 levels)
  // And NOT already linked in the current session (linkedChildIds)
  const isParentRecursive = (id: string) => allCustomers.some(c => c.parentId === id);
  
  const searchResults = allCustomers.filter(c => {
      if (c.id === initialData?.id) return false;
      if (linkedChildIds.includes(c.id)) return false;
      if (isParentRecursive(c.id)) return false;
      
      const term = childSearchTerm.toLowerCase();
      return c.name.toLowerCase().includes(term) || c.accountNumber.toLowerCase().includes(term);
  });

  const selectedParent = parents.find(p => p.id === formData.parentId);
  const parentContacts = selectedParent ? selectedParent.contacts : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Customer' : 'Create New Customer'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
            {isEdit ? `Updating record for ${initialData.accountNumber}` : 'Fill in the details below to create a new customer record.'}
            </p>
        </div>
        <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
        >
            <ArrowLeft className="h-4 w-4 mr-2" /> Cancel
        </button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Please correct the following errors:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Account Setup (Replaces explicit Type selection) */}
      <div className="bg-white shadow rounded-lg p-6">
         <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-gray-400"/>
            Account Setup
        </h2>
        
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-6">
                <label htmlFor="parentId" className="block text-sm font-medium text-gray-700">
                    Parent Account
                </label>
                <div className="mt-1">
                    <select
                        id="parentId"
                        name="parentId"
                        value={formData.parentId || ''}
                        onChange={handleParentChange}
                        disabled={linkedChildIds.length > 0} // Cannot have parent if you are a parent
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black disabled:bg-gray-100 disabled:text-gray-500"
                    >
                        <option value="">-- No Parent (Top Level Account) --</option>
                        {parents
                            .filter(p => p.id !== initialData?.id) // Prevent self-selection
                            .map((parent) => (
                            <option key={parent.id} value={parent.id}>
                                {parent.name} ({parent.accountNumber})
                            </option>
                        ))}
                    </select>
                </div>
                {linkedChildIds.length > 0 ? (
                    <p className="mt-2 text-sm text-amber-600 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1"/>
                        This account has linked child customers, so it cannot be assigned to another parent.
                    </p>
                ) : (
                    <p className="mt-2 text-sm text-gray-500">
                        {formData.parentId 
                            ? `This customer will be a sub-account of ${selectedParent?.name}.`
                            : "Leave empty if this is a standalone or parent company."}
                    </p>
                )}
            </div>
        </div>
      </div>

      {/* Section 2: Customer Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Customer Name *
                </label>
                <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-white text-black"
                />
            </div>

            <div className="sm:col-span-2">
                <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
                Account Number *
                </label>
                <input
                type="text"
                name="accountNumber"
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => handleChange('accountNumber', e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-white text-black"
                />
            </div>

            <div className="sm:col-span-6">
                 <div className="flex items-center">
                    <button
                        type="button"
                        onClick={() => handleChange('isVip', !formData.isVip)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${formData.isVip ? 'bg-yellow-400' : 'bg-gray-200'}`}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${formData.isVip ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <span className="ml-3 flex items-center text-sm font-medium text-gray-900">
                         <Crown className={`w-4 h-4 mr-1 ${formData.isVip ? 'text-yellow-500' : 'text-gray-400'}`} />
                         VIP Account
                    </span>
                 </div>
            </div>
        </div>
      </div>

      {/* Section 3: Addresses */}
      <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Addresses</h2>
            <button
                type="button"
                onClick={addAddress}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none"
            >
                <Plus className="h-4 w-4 mr-1" /> Add Address
            </button>
          </div>

          <div className="space-y-6">
              {formData.addresses.length === 0 && (
                 <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                     No addresses added. Please add at least one address.
                 </div>
              )}
              {formData.addresses.map((addr, idx) => (
                  <div key={addr.id} className="border rounded-lg p-4 bg-gray-50 relative">
                      <div className="absolute top-4 right-4">
                          <button type="button" onClick={() => removeAddress(addr.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Address #{idx + 1}</h4>
                      
                      <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6 mb-4">
                          {/* Location Input Type */}
                          <div className="sm:col-span-6">
                               <div className="flex items-start gap-4 flex-col sm:flex-row">
                                   <div className="flex-1 w-full">
                                       <label className="block text-xs font-medium text-gray-500 mb-1">Street Address</label>
                                       <div className="relative rounded-md shadow-sm">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Home className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={addr.street || ''} 
                                                onChange={(e) => updateAddress(addr.id, 'street', e.target.value)}
                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-white text-black"
                                                placeholder="123 Main St"
                                            />
                                       </div>
                                   </div>
                                   <div className="flex items-center pt-6 text-gray-400 text-sm font-medium">OR</div>
                                   <div className="flex-1 w-full flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                                            <input 
                                                type="text" 
                                                value={addr.latitude || ''} 
                                                onChange={(e) => updateAddress(addr.id, 'latitude', e.target.value)}
                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black"
                                                placeholder="00.0000"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                                            <input 
                                                type="text" 
                                                value={addr.longitude || ''} 
                                                onChange={(e) => updateAddress(addr.id, 'longitude', e.target.value)}
                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black"
                                                placeholder="-00.0000"
                                            />
                                        </div>
                                   </div>
                               </div>
                          </div>

                          <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">City *</label>
                              <input type="text" value={addr.city} onChange={e => updateAddress(addr.id, 'city', e.target.value)} className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black"/>
                          </div>
                          <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">State *</label>
                              <input type="text" value={addr.state} onChange={e => updateAddress(addr.id, 'state', e.target.value)} className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black"/>
                          </div>
                          <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">Zip Code *</label>
                              <input type="text" value={addr.zipCode} onChange={e => updateAddress(addr.id, 'zipCode', e.target.value)} className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md bg-white text-black"/>
                          </div>
                      </div>

                      <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-200">
                          <label className="inline-flex items-center">
                              <input type="radio" name="primaryAddr" checked={addr.isPrimary} onChange={() => setUniqueAddressFlag(addr.id, 'isPrimary')} className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                              <span className="ml-2 text-sm text-gray-700">Primary Location</span>
                          </label>
                          <label className="inline-flex items-center">
                              <input type="radio" name="billingAddr" checked={addr.isBilling} onChange={() => setUniqueAddressFlag(addr.id, 'isBilling')} className="form-radio h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"/>
                              <span className="ml-2 text-sm text-gray-700">Billing Address</span>
                          </label>
                          <label className="inline-flex items-center">
                              <input type="checkbox" checked={addr.isGateProperty} onChange={(e) => updateAddress(addr.id, 'isGateProperty', e.target.checked)} className="form-checkbox h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
                              <span className="ml-2 text-sm text-gray-700">Gate Property</span>
                          </label>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Section 4: Contacts */}
      <div className="bg-white shadow rounded-lg p-6">
        <ContactManager 
            contacts={formData.contacts}
            parentContacts={parentContacts}
            onChange={(newContacts) => handleChange('contacts', newContacts)}
            errors={touched ? errors.filter(e => e.toLowerCase().includes('contact')) : []}
        />
      </div>

      {/* Section 5: Children Linking (Only for Top Level / Parent Accounts) */}
      {!formData.parentId && (
        <div className="bg-white shadow rounded-lg p-6">
             <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-gray-400"/>
                Link Child Customers
             </h2>
             
             {/* List of currently linked */}
             {linkedCustomers.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Currently Linked ({linkedCustomers.length})
                    </h3>
                    <div className="bg-gray-50 rounded-md border border-gray-200 divide-y divide-gray-200">
                        {linkedCustomers.map(child => (
                            <div key={child.id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                        {child.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-900">{child.name}</p>
                                        <p className="text-xs text-gray-500">{child.accountNumber}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleChildLink(child.id)}
                                    className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50"
                                    title="Unlink Customer"
                                >
                                    <Unlink className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
             )}

             {/* Search Dropdown */}
             <div className="relative" ref={searchContainerRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Child Customer</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-10 sm:text-sm border-gray-300 rounded-md py-2 text-black bg-white"
                        placeholder="Search by name or account number..."
                        value={childSearchTerm}
                        onChange={(e) => {
                            setChildSearchTerm(e.target.value);
                            setIsSearchFocused(true);
                        }}
                        onFocus={() => setIsSearchFocused(true)}
                    />
                    {childSearchTerm && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setChildSearchTerm('')}>
                            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </div>
                    )}
                </div>

                {isSearchFocused && (
                     <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                         {searchResults.length === 0 ? (
                             <div className="cursor-default select-none relative py-2 px-4 text-gray-500 text-sm">
                                 {childSearchTerm ? 'No matching customers found.' : 'Start typing to search...'}
                             </div>
                         ) : (
                             searchResults.map(child => {
                                 const currentParent = parents.find(p => p.id === child.parentId);
                                 const isAssigned = !!currentParent && currentParent.id !== initialData?.id;
                                 
                                 return (
                                    <div 
                                        key={child.id}
                                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                        onClick={() => {
                                            toggleChildLink(child.id);
                                            setChildSearchTerm('');
                                            setIsSearchFocused(false);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="block font-medium text-gray-900">{child.name}</span>
                                                <span className="block text-xs text-gray-500">{child.accountNumber}</span>
                                            </div>
                                            {isAssigned && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 mr-2">
                                                    Assigned to: {currentParent.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                 );
                             })
                         )}
                     </div>
                )}
             </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 sticky bottom-6 pt-4 border-t border-gray-200 bg-gray-50/80 backdrop-blur-sm p-4 rounded-b-lg -mx-6 -mb-10">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Save className="h-5 w-5 mr-2" />
          Save Customer
        </button>
      </div>
    </form>
  );
};