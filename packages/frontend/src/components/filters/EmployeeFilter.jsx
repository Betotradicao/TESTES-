import { useState, useEffect } from 'react';
import { fetchEmployees } from '../../services/employees.service';

export default function EmployeeFilter({ value, onChange, placeholder = 'Todos os colaboradores', className = '' }) {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchEmployees(1, 1000, true); // Get all active employees
      setEmployees(response.data || []);
    } catch (err) {
      setError('Erro ao carregar colaboradores');
      console.error('Load employees error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value || null;
    onChange(newValue);
  };

  const selectedEmployee = employees.find(emp => emp.id === value);

  return (
    <div className={`relative ${className}`}>
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={isLoading}
        className={`w-full py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed ${selectedEmployee ? 'pl-11 pr-3' : 'px-3'}`}
      >
        <option value="">{placeholder}</option>
        {employees.map(employee => (
          <option key={employee.id} value={employee.id}>
            {employee.name} {employee.username ? `(@${employee.username})` : ''}
          </option>
        ))}
      </select>

      {/* Show selected employee with avatar */}
      {selectedEmployee && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {selectedEmployee.avatar ? (
            <img
              src={selectedEmployee.avatar}
              alt={selectedEmployee.name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xs">
              {selectedEmployee.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-y-0 right-8 flex items-center pr-2 pointer-events-none">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
