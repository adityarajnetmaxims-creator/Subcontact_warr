import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { CustomerList } from './components/CustomerList';
import { CustomerForm } from './components/CustomerForm';
import { ImportCustomers } from './components/ImportCustomers';
import { useCustomerData } from './hooks/useCustomerData';
import { CustomerFormData, CustomerType, Customer } from './types';
import { Plus } from 'lucide-react';

type View = 'LIST' | 'CREATE' | 'EDIT' | 'IMPORT';

function App() {
  const {
    customers,
    getParents,
    getDirectCustomers,
    addCustomer,
    batchAddCustomers,
    updateCustomer,
    deleteCustomer,
    validateCustomer,
  } = useCustomerData();

  const [currentView, setCurrentView] = useState<View>('LIST');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const handleEdit = (id: string) => {
    setSelectedCustomerId(id);
    setCurrentView('EDIT');
  };

  const handleDelete = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    
    const isParent = customer.type === CustomerType.PARENT;
    // Count children for warning
    const childCount = customers.filter(c => c.parentId === id).length;
    
    const message = isParent && childCount > 0 
        ? `Are you sure you want to delete "${customer.name}"? \n\nWARNING: This is a Parent Customer with ${childCount} linked Direct Customers. These children will be converted to standalone customers.` 
        : `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`;

    if (window.confirm(message)) {
      deleteCustomer(id);
    }
  };

  const handleSubmit = (data: CustomerFormData, childIds?: string[]) => {
    if (currentView === 'EDIT' && selectedCustomerId) {
      updateCustomer(selectedCustomerId, data, childIds);
    } else {
      addCustomer(data, childIds);
    }
    setCurrentView('LIST');
    setSelectedCustomerId(null);
  };

  const handleImport = (newCustomers: Customer[]) => {
    batchAddCustomers(newCustomers);
    setCurrentView('LIST');
  };

  const selectedCustomer = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)
    : undefined;

  return (
    <Layout onNavigateHome={() => setCurrentView('LIST')}>
      {currentView === 'LIST' && (
        <div className="space-y-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Customers
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage your Direct and Parent customer accounts.
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCurrentView('CREATE');
                }}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Customer
              </button>
            </div>
          </div>

          <CustomerList
            customers={customers}
            parents={getParents()}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onImport={() => setCurrentView('IMPORT')}
          />
        </div>
      )}

      {(currentView === 'CREATE' || currentView === 'EDIT') && (
        <CustomerForm
          initialData={selectedCustomer}
          parents={getParents()}
          allCustomers={customers}
          onSubmit={handleSubmit}
          onCancel={() => setCurrentView('LIST')}
          validate={validateCustomer}
        />
      )}

      {currentView === 'IMPORT' && (
        <ImportCustomers
          onCancel={() => setCurrentView('LIST')}
          onImport={handleImport}
          existingCustomers={customers}
          existingParents={getParents()}
        />
      )}
    </Layout>
  );
}

export default App;