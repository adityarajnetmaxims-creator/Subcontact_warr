import React from 'react';
import { Contact } from '../types';
import { Trash2, Star, Plus, Phone, Mail, User } from 'lucide-react';

interface ContactManagerProps {
  contacts: Contact[];
  parentContacts?: Contact[]; // Passed if a parent is selected
  onChange: (contacts: Contact[]) => void;
  errors?: string[];
}

export const ContactManager: React.FC<ContactManagerProps> = ({
  contacts,
  parentContacts = [],
  onChange,
  errors = [],
}) => {

  const handleAddContact = () => {
    const newContact: Contact = {
      id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      email: '',
      phone: '',
      isPrimary: contacts.length === 0,
    };
    onChange([...contacts, newContact]);
  };

  const handleSelectParentContact = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    const parentContact = parentContacts.find(c => c.id === selectedId);
    if (parentContact) {
      const newContact: Contact = {
        ...parentContact,
        id: `copied_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isPrimary: contacts.length === 0, // Auto primary if list empty
      };
      onChange([...contacts, newContact]);
    }
  };

  const handleUpdateContact = (id: string, field: keyof Contact, value: any) => {
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, [field]: value } : c
    );
    onChange(updated);
  };

  const handleSetPrimary = (id: string) => {
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === id,
    }));
    onChange(updated);
  };

  const handleDeleteContact = (id: string) => {
    const contactToDelete = contacts.find(c => c.id === id);
    const updated = contacts.filter((c) => c.id !== id);
    
    if (contactToDelete?.isPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
    }

    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-medium text-gray-900">Contact Persons</h3>
        
        <div className="flex gap-2">
            <button
                type="button"
                onClick={handleAddContact}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none"
            >
                <Plus className="h-4 w-4 mr-1" /> Add New
            </button>
        </div>
      </div>

      {parentContacts.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium whitespace-nowrap">Add from Parent:</span>
            <select 
                className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                onChange={handleSelectParentContact}
                value=""
            >
                <option value="">Select a contact to auto-fill...</option>
                {parentContacts.map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.name} ({pc.email})</option>
                ))}
            </select>
        </div>
      )}

      {errors.length > 0 && (
         <div className="bg-red-50 border-l-4 border-red-400 p-3">
            <div className="flex">
                <div className="ml-3">
                    <p className="text-sm text-red-700">{errors.join(' ')}</p>
                </div>
            </div>
         </div>
      )}

      <div className="space-y-3">
        {contacts.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 text-sm">No contacts added yet. At least one is required.</p>
            </div>
        )}
        {contacts.map((contact, index) => (
          <div
            key={contact.id}
            className={`relative flex flex-col sm:flex-row gap-4 p-4 rounded-lg border ${
              contact.isPrimary ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'
            } transition-all`}
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={contact.name}
                  onChange={(e) => handleUpdateContact(contact.id, 'name', e.target.value)}
                  className="pl-10 focus:ring-blue-500 focus:border-blue-500 block w-full text-sm border-gray-300 rounded-md bg-white text-black"
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="Email Address *"
                  value={contact.email}
                  onChange={(e) => handleUpdateContact(contact.id, 'email', e.target.value)}
                  className="pl-10 focus:ring-blue-500 focus:border-blue-500 block w-full text-sm border-gray-300 rounded-md bg-white text-black"
                  required
                />
              </div>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="tel"
                  placeholder="Phone Number *"
                  value={contact.phone}
                  onChange={(e) => handleUpdateContact(contact.id, 'phone', e.target.value)}
                  className="pl-10 focus:ring-blue-500 focus:border-blue-500 block w-full text-sm border-gray-300 rounded-md bg-white text-black"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:border-l sm:pl-4 border-gray-200">
              <button
                type="button"
                onClick={() => handleSetPrimary(contact.id)}
                title={contact.isPrimary ? "Primary Contact" : "Set as Primary"}
                className={`p-1.5 rounded-md transition-colors ${
                  contact.isPrimary
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <Star className={`h-5 w-5 ${contact.isPrimary ? 'fill-current' : ''}`} />
              </button>
              
              <button
                type="button"
                onClick={() => handleDeleteContact(contact.id)}
                title="Delete Contact"
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};