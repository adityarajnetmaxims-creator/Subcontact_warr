import React, { useState, useRef } from 'react';
import { Customer, CustomerType, Contact, Address } from '../types';
import { Upload, AlertCircle, CheckCircle, XCircle, FileText, Download, ArrowLeft } from 'lucide-react';

interface ImportCustomersProps {
  onCancel: () => void;
  onImport: (customers: Customer[]) => void;
  existingCustomers: Customer[];
  existingParents: Customer[];
}

interface ImportRow {
  rowNumber: number;
  customerName: string;
  accountNumber: string;
  address: string;
  zipCode: string;
  parentCustomerName: string; // If empty -> Parent, If exists -> Direct
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isPrimary: boolean;
}

interface ProcessedBatch {
  validCustomers: Customer[];
  errors: { rowNumber: number; reason: string }[];
}

export const ImportCustomers: React.FC<ImportCustomersProps> = ({
  onCancel,
  onImport,
  existingCustomers,
  existingParents,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedBatch | null>(null);
  const [activeTab, setActiveTab] = useState<'VALID' | 'ERRORS'>('VALID');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setProcessedData(null);
    }
  };

  // Helper to parse CSV line handling quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        result.push(line.substring(start, i).replace(/^"|"$/g, '').trim());
        start = i + 1;
      }
    }
    result.push(line.substring(start).replace(/^"|"$/g, '').trim());
    return result;
  };

  const processFile = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      
      // Skip header row
      const dataRows = lines.slice(1).filter(line => line.trim() !== '');
      
      const rawRows: ImportRow[] = [];
      
      // 1. Parse Raw Data
      dataRows.forEach((line, index) => {
        const cols = parseCSVLine(line);
        // Assuming CSV structure: 
        // Name, Account#, Address, Zip, ParentName, ContactName, ContactEmail, ContactPhone, IsPrimary
        if (cols.length >= 7) {
            rawRows.push({
                rowNumber: index + 2, // +2 because 0-indexed + 1 for header
                customerName: cols[0],
                accountNumber: cols[1],
                address: cols[2],
                zipCode: cols[3],
                parentCustomerName: cols[4],
                contactName: cols[5],
                contactEmail: cols[6],
                contactPhone: cols[7] || '',
                isPrimary: cols[8]?.toLowerCase() === 'true' || cols[8]?.toLowerCase() === 'yes' || cols[8] === '1'
            });
        }
      });

      analyzeRows(rawRows);
    };
    reader.readAsText(file);
  };

  const analyzeRows = (rows: ImportRow[]) => {
    const validCustomers: Customer[] = [];
    const errors: { rowNumber: number; reason: string }[] = [];
    
    // Group by Account Number to handle multiple contacts for same customer OR detect duplicates
    const groupedByAccount: Record<string, ImportRow[]> = {};
    
    rows.forEach(row => {
        const acc = row.accountNumber;
        if (!groupedByAccount[acc]) {
            groupedByAccount[acc] = [];
        }
        groupedByAccount[acc].push(row);
    });

    // Valid Parent Lookup Map (Name -> ID)
    // Includes existing parents AND parents currently being imported in this batch
    const parentNameMap = new Map<string, string>();
    existingParents.forEach(p => parentNameMap.set(p.name.toLowerCase(), p.id));

    // First Pass: Identify and Create Valid PARENT customers from the batch
    Object.keys(groupedByAccount).forEach(accNum => {
        const groupRows = groupedByAccount[accNum];
        // Check if consistent customer name
        const firstRow = groupRows[0];
        const isParent = !firstRow.parentCustomerName; // Classification Rule

        if (isParent) {
            const customerId = `cust_import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            // Optimistically add to map for second pass (Direct customers)
            if (firstRow.customerName) {
                parentNameMap.set(firstRow.customerName.toLowerCase(), customerId);
            }
        }
    });

    // Second Pass: Validate and Build Objects
    Object.keys(groupedByAccount).forEach(accNum => {
        const groupRows = groupedByAccount[accNum];
        const firstRow = groupRows[0];
        const rowNumbers = groupRows.map(r => r.rowNumber).join(', ');

        // 1. Basic Validation
        if (!firstRow.customerName) {
            groupRows.forEach(r => errors.push({ rowNumber: r.rowNumber, reason: 'Missing Customer Name' }));
            return;
        }

        // 2. Check for Name conflict within group
        const uniqueNames = new Set(groupRows.map(r => r.customerName));
        if (uniqueNames.size > 1) {
             groupRows.forEach(r => errors.push({ 
                 rowNumber: r.rowNumber, 
                 reason: `Duplicate Account Number '${accNum}' used for different customer names.` 
             }));
             return;
        }

        // 3. Check Account Uniqueness against DB
        const isDuplicateInDb = existingCustomers.some(c => c.accountNumber === accNum);
        if (isDuplicateInDb) {
            groupRows.forEach(r => errors.push({ 
                rowNumber: r.rowNumber, 
                reason: `Account Number '${accNum}' already exists in the system.` 
            }));
            return;
        }

        // 4. Contact Validation
        let contacts: Contact[] = groupRows.map((row, idx) => ({
            id: `cont_imp_${accNum}_${idx}`,
            name: row.contactName,
            email: row.contactEmail,
            phone: row.contactPhone,
            isPrimary: row.isPrimary
        }));

        const validContacts = contacts.filter(c => c.name && c.email);
        if (validContacts.length !== contacts.length) {
             groupRows.forEach(r => {
                 if (!r.contactName || !r.contactEmail) {
                     errors.push({ rowNumber: r.rowNumber, reason: 'Missing Contact Name or Email.' });
                 }
             });
             return;
        }

        if (validContacts.length === 1) {
            validContacts[0].isPrimary = true;
        } else if (validContacts.length > 1) {
            const primaryCount = validContacts.filter(c => c.isPrimary).length;
            if (primaryCount === 0) {
                 groupRows.forEach(r => errors.push({ rowNumber: r.rowNumber, reason: 'Multiple contacts found but none marked as Primary.' }));
                 return;
            }
            if (primaryCount > 1) {
                 groupRows.forEach(r => errors.push({ rowNumber: r.rowNumber, reason: 'Multiple contacts marked as Primary. Only one allowed.' }));
                 return;
            }
        } else {
             groupRows.forEach(r => errors.push({ rowNumber: r.rowNumber, reason: 'No valid contacts found.' }));
             return;
        }

        // 5. Hierarchy Classification
        const isParent = !firstRow.parentCustomerName;
        let parentId: string | undefined | null = undefined;

        if (!isParent) {
            const parentNameKey = firstRow.parentCustomerName.toLowerCase();
            parentId = parentNameMap.get(parentNameKey);

            if (!parentId) {
                groupRows.forEach(r => errors.push({ 
                    rowNumber: r.rowNumber, 
                    reason: `Parent Customer '${firstRow.parentCustomerName}' not found (in system or file).` 
                }));
                return;
            }
        }

        // 6. Build Customer Object (Mapping CSV single address to Address[])
        let finalId = isParent 
            ? parentNameMap.get(firstRow.customerName.toLowerCase()) 
            : `cust_import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        if (!finalId) finalId = `cust_err_${Date.now()}`;

        // Create a primary address from CSV data
        const primaryAddress: Address = {
            id: `addr_${Date.now()}_imp`,
            street: firstRow.address,
            city: 'Imported City', // Placeholder as CSV didn't have separate city/state
            state: 'Imported State', // Placeholder
            zipCode: firstRow.zipCode,
            isPrimary: true,
            isBilling: true,
            isGateProperty: false
        };

        const newCustomer: Customer = {
            id: finalId,
            type: isParent ? CustomerType.PARENT : CustomerType.DIRECT,
            name: firstRow.customerName,
            accountNumber: firstRow.accountNumber,
            isVip: false,
            addresses: [primaryAddress],
            parentId: isParent ? undefined : parentId,
            contacts: validContacts,
            createdAt: new Date().toISOString()
        };

        validCustomers.push(newCustomer);
    });

    setProcessedData({
        validCustomers,
        errors: errors.sort((a,b) => a.rowNumber - b.rowNumber)
    });
    
    if (validCustomers.length > 0) setActiveTab('VALID');
    else setActiveTab('ERRORS');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Customer Name',
      'Account Number',
      'Address',
      'Zip Code',
      'Parent Customer Name',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Is Primary Contact'
    ];
    const sampleRow1 = [
        'M2 Plus Construction Co Ltd.', 'ACC-9001', '123 Build St', '50000', '', 'Mike Builder', 'mike@m2plus.com', '555-1234', 'TRUE'
    ];
    const sampleRow2 = [
        'Punyisa Villa 21', 'ACC-9002', '456 Villa Ln', '50000', 'M2 Plus Construction Co Ltd.', 'Sarah Villa', 'sarah@villa.com', '555-5678', 'TRUE'
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + sampleRow1.map(f => `"${f}"`).join(",") + "\n"
        + sampleRow2.map(f => `"${f}"`).join(",");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customer_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Upload a CSV file to bulk import customer records.</p>
        </div>
        <button
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
        </button>
      </div>

      {/* File Upload Section */}
      <div className="bg-white shadow rounded-lg p-6">
        {!processedData ? (
          <div className="text-center border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-400 transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4 flex text-sm justify-center text-gray-600">
              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                <span>Upload a CSV file</span>
                <input id="file-upload" name="file-upload" type="file" accept=".csv" className="sr-only" ref={fileInputRef} onChange={handleFileChange} />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">CSV files up to 10MB</p>
            <div className="mt-6">
                <button 
                    type="button" 
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                >
                    <Download className="h-3 w-3 mr-1" /> Download Sample Template
                </button>
            </div>
          </div>
        ) : (
           <div className="flex items-center justify-between bg-blue-50 p-4 rounded-md border border-blue-200">
               <div className="flex items-center">
                   <FileText className="h-8 w-8 text-blue-500 mr-3" />
                   <div>
                       <p className="text-sm font-medium text-gray-900">{file?.name}</p>
                       <p className="text-xs text-gray-500">{Math.round((file?.size || 0) / 1024)} KB</p>
                   </div>
               </div>
               <button 
                  onClick={() => { setFile(null); setProcessedData(null); }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
               >
                   Remove & Upload New
               </button>
           </div>
        )}

        {file && !processedData && (
             <div className="mt-4 flex justify-end">
                 <button
                    onClick={processFile}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                 >
                     Analyze File
                 </button>
             </div>
        )}
      </div>

      {/* Results Section */}
      {processedData && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex">
                    <button
                        onClick={() => setActiveTab('VALID')}
                        className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center ${
                            activeTab === 'VALID'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Valid Records ({processedData.validCustomers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('ERRORS')}
                        className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center ${
                            activeTab === 'ERRORS'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <XCircle className="h-5 w-5 mr-2" />
                        Errors ({processedData.errors.length})
                    </button>
                </nav>
            </div>

            <div className="p-4">
                {activeTab === 'VALID' && (
                    <div className="space-y-4">
                        {processedData.validCustomers.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No valid records found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {processedData.validCustomers.map((c, i) => {
                                            const primary = c.contacts.find(con => con.isPrimary);
                                            // For display, if it's a new import parent, it has an ID, but we want to show Name.
                                            // The c.parentId is an ID. We need to lookup name.
                                            // We can check validCustomers first, then existingParents.
                                            const parentInBatch = processedData.validCustomers.find(p => p.id === c.parentId);
                                            const parentInDb = existingParents.find(p => p.id === c.parentId);
                                            const parentName = parentInBatch?.name || parentInDb?.name || '-';

                                            return (
                                                <tr key={i}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.type === CustomerType.PARENT ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                            {c.type === CustomerType.PARENT ? 'Parent' : 'Direct'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.type === CustomerType.DIRECT ? parentName : '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {primary ? `${primary.name} (${primary.email})` : 'Missing'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => onImport(processedData.validCustomers)}
                                disabled={processedData.validCustomers.length === 0}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Import {processedData.validCustomers.length} Records
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'ERRORS' && (
                    <div className="space-y-4">
                         {processedData.errors.length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                                <p className="mt-2 text-sm text-gray-500">No errors found! The file is clean.</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row #</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {processedData.errors.map((err, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{err.rowNumber}</td>
                                            <td className="px-6 py-4 text-sm text-red-600">{err.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};