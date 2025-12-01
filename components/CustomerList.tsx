import React, { useState, useMemo, useEffect } from 'react';
import { Customer, CustomerType, SortField, SortDirection } from '../types';
import { Edit2, Trash2, Search, ArrowUpDown, MapPin, Users, CornerDownRight, Upload, Crown, ChevronLeft, ChevronRight, ChevronDown, Building } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  parents: Customer[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  parents,
  onEdit,
  onDelete,
  onImport,
}) => {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'ALL'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'name',
    direction: 'asc',
  });
  
  // Track expanded parent rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Determine if we are in Hierarchy Mode (Tree view) or Flat Mode (Search/Filter view)
  const isHierarchyMode = !filter && typeFilter === 'ALL';

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter, sortConfig]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // 1. Process Data based on Mode
  const { visibleItems, totalItems } = useMemo(() => {
    let roots: Customer[] = [];
    let childrenMap = new Map<string, Customer[]>();

    // Common sorting function
    const sorter = (a: Customer, b: Customer) => {
      const aValue = a[sortConfig.field].toString().toLowerCase();
      const bValue = b[sortConfig.field].toString().toLowerCase();
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    };

    if (isHierarchyMode) {
      // HIERARCHY MODE:
      // Roots = All Parents AND Independent Directs (parentId is null/undefined)
      // Children = Directs with a parentId
      const allRoots = customers.filter(c => !c.parentId);
      const allChildren = customers.filter(c => c.parentId);

      // Group children
      allChildren.forEach(child => {
        if (child.parentId) {
          const list = childrenMap.get(child.parentId) || [];
          list.push(child);
          childrenMap.set(child.parentId, list);
        }
      });

      // Sort roots
      allRoots.sort(sorter);

      // Pagination applies to ROOTS only
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedRoots = allRoots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      // Build the display list (Roots + Expanded Children)
      const displayList: Customer[] = [];
      paginatedRoots.forEach(root => {
        displayList.push(root);
        if (expandedIds.has(root.id)) {
          const kids = childrenMap.get(root.id) || [];
          kids.sort(sorter); // Sort children too
          displayList.push(...kids);
        }
      });

      return { visibleItems: displayList, totalItems: allRoots.length };

    } else {
      // FLAT MODE (Search/Filter active):
      let result = [...customers];

      // Filter by text
      if (filter) {
        const lowerFilter = filter.toLowerCase();
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerFilter) ||
            c.accountNumber.toLowerCase().includes(lowerFilter) ||
            c.addresses.some(a => (a.street || '').toLowerCase().includes(lowerFilter) || a.city.toLowerCase().includes(lowerFilter))
        );
      }

      // Filter by Type
      if (typeFilter !== 'ALL') {
        result = result.filter((c) => c.type === typeFilter);
      }

      // Sort
      result.sort(sorter);

      // Pagination applies to ALL rows
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedResult = result.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      return { visibleItems: paginatedResult, totalItems: result.length };
    }
  }, [customers, filter, typeFilter, sortConfig, currentPage, expandedIds, isHierarchyMode]);


  // Pagination Logic Helpers
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  // Helper to count children for badge
  const getChildCount = (parentId: string) => customers.filter(c => c.parentId === parentId).length;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-5 border-b border-gray-200 bg-gray-50 sm:flex sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 flex items-center space-x-4">
          <div className="relative rounded-md shadow-sm max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-white text-black"
              placeholder="Search customers..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          
          <select
            className="mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white text-black"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="ALL">All Types</option>
            <option value={CustomerType.DIRECT}>Direct Only</option>
            <option value={CustomerType.PARENT}>Parent Only</option>
          </select>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-4 flex gap-2">
            <button
                type="button"
                onClick={onImport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
                <Upload className="h-4 w-4 mr-2" />
                Import
            </button>
            <span className="text-sm text-gray-500 self-center whitespace-nowrap">
                {isHierarchyMode ? `${totalItems} accounts` : `${totalItems} results`}
            </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 w-10"></th> {/* Expand/Collapse Column */}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Name
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('accountNumber')}
              >
                <div className="flex items-center">
                  Account #
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Primary Contact
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleItems.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                        No customers found matching your criteria.
                    </td>
                </tr>
            ) : (
                visibleItems.map((customer) => {
                const primaryContact = customer.contacts.find((c) => c.isPrimary);
                const primaryAddress = customer.addresses.find(a => a.isPrimary) || customer.addresses[0];
                const addrDisplay = primaryAddress 
                    ? (primaryAddress.street || `${primaryAddress.latitude}, ${primaryAddress.longitude}`) + `, ${primaryAddress.city}`
                    : 'No Address';
                
                // Hierarchy Logic
                const isChild = !!customer.parentId && isHierarchyMode;
                const childCount = isHierarchyMode && !isChild ? getChildCount(customer.id) : 0;
                const isExpanded = expandedIds.has(customer.id);
                const hasChildren = childCount > 0;

                return (
                    <tr 
                        key={customer.id} 
                        className={`transition-colors ${isChild ? 'bg-gray-50' : 'hover:bg-gray-50'} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                    >
                    <td className="px-2 py-4 whitespace-nowrap text-right">
                        {!isChild && hasChildren && (
                            <button 
                                onClick={() => toggleExpand(customer.id)}
                                className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                        )}
                         {isChild && (
                             <div className="flex justify-end pr-2">
                                <CornerDownRight className="h-4 w-4 text-gray-300" />
                             </div>
                         )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${customer.type === CustomerType.PARENT ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {customer.type === CustomerType.PARENT ? <Users className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                            </div>
                            <div className="ml-4">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${isChild ? 'text-gray-700' : 'text-gray-900'}`}>
                                        {customer.name}
                                    </span>
                                    {customer.isVip && <Crown className="w-3 h-3 text-yellow-500" />}
                                    
                                    {/* Sub-account Badge */}
                                    {!isChild && hasChildren && (
                                        <span 
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(customer.id); }}
                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                                        >
                                            {childCount} {childCount === 1 ? 'Site' : 'Sites'}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center" title={addrDisplay}>
                                    <MapPin className="h-3 w-3 mr-1" /> 
                                    <span className="truncate max-w-xs">{addrDisplay}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                            {customer.accountNumber}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {primaryContact ? (
                        <div className="text-sm">
                            <div className="font-medium text-gray-900">{primaryContact.name}</div>
                            <div className="text-gray-500">{primaryContact.email}</div>
                        </div>
                        ) : (
                        <span className="text-sm text-red-500 font-medium">Missing Primary</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                        onClick={() => onEdit(customer.id)}
                        className="text-blue-600 hover:text-blue-900 mx-2 p-1 rounded hover:bg-blue-50"
                        title="Edit"
                        >
                        <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                        onClick={() => onDelete(customer.id)}
                        className="text-red-600 hover:text-red-900 mx-2 p-1 rounded hover:bg-red-50"
                        title="Delete"
                        >
                        <Trash2 className="h-5 w-5" />
                        </button>
                    </td>
                    </tr>
                );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> of <span className="font-medium">{totalItems}</span> {isHierarchyMode ? 'accounts' : 'results'}
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        
                        <div className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            Page {currentPage} of {totalPages}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
            
            <div className="flex items-center justify-between sm:hidden w-full">
                 <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                    Previous
                </button>
                 <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                    Next
                </button>
            </div>
        </div>
      )}
    </div>
  );
};