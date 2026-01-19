import { useState, useEffect } from 'react';
import { fetchSectors } from '../../services/sectors.service';
import BarcodeDisplay from './BarcodeDisplay';
import PermissionsSelector from '../colaboradores/PermissionsSelector';
import api from '../../services/api';

export default function EmployeeModal({ employee, onSave, onCancel, onUploadAvatar }) {
  const [formData, setFormData] = useState({
    name: '',
    sector_id: '',
    function_description: '',
    username: '',
    password: ''
  });
  const [sectors, setSectors] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    loadSectors();

    if (employee) {
      setFormData({
        name: employee.name,
        sector_id: employee.sector_id,
        function_description: employee.function_description,
        username: employee.username,
        password: '' // Never pre-fill password
      });
      setAvatarPreview(employee.avatar);

      // Carregar permissões se estiver editando
      loadPermissions(employee.id);
    }
  }, [employee]);

  const loadPermissions = async (employeeId) => {
    try {
      const response = await api.get(`/employees/${employeeId}/permissions`);
      console.log('📋 Permissões recebidas do backend:', response.data);

      // Converter do formato backend para formato do componente
      const permissionsArray = Object.keys(response.data).map(moduleId => ({
        moduleId,
        submenus: response.data[moduleId].length === 0 ? null : response.data[moduleId]
      }));

      console.log('📋 Permissões convertidas para componente:', permissionsArray);
      setPermissions(permissionsArray);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const loadSectors = async () => {
    try {
      const data = await fetchSectors(true); // Only active sectors
      setSectors(data || []);
    } catch (error) {
      console.error('Error loading sectors:', error);
      setErrors(['Erro ao carregar setores']);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      // Save employee data
      const savedEmployee = await onSave(formData);

      // Get employee ID (from editing or newly created)
      const employeeId = employee?.id || savedEmployee?.id;

      // If there's a new avatar and we have the employee ID, upload it
      if (avatarFile && employeeId) {
        await onUploadAvatar(employeeId, avatarFile);
      }

      // Save permissions
      if (employeeId && permissions.length > 0) {
        await api.put(`/employees/${employeeId}/permissions`, {
          permissions
        });
      }
    } catch (error) {
      if (error.errors) {
        setErrors(error.errors);
      } else if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else if (error.response?.data?.error) {
        setErrors([error.response.data.error]);
      } else {
        setErrors([error.message || 'Erro ao salvar colaborador']);
      }
      setIsSubmitting(false);
    }
  };

  const handlePrintBarcode = () => {
    const printWindow = window.open('', '_blank');
    const barcodeValue = employee.barcode;
    const employeeName = employee.name;
    const employeeFunction = employee.function_description;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Impressão de Crachá - ${employeeName}</title>
        <style>
          @page {
            size: 10cm 5cm;
            margin: 0;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }

            .no-print {
              display: none !important;
            }
          }

          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
          }

          .badge {
            width: 10cm;
            height: 5cm;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 0.3cm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .badge-header {
            text-align: center;
            margin-bottom: 0.2cm;
          }

          .badge-header h2 {
            margin: 0;
            font-size: 14pt;
            font-weight: bold;
            color: #333;
          }

          .badge-header p {
            margin: 0.1cm 0 0 0;
            font-size: 9pt;
            color: #666;
          }

          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
          }

          .barcode-container svg {
            max-width: 8cm;
            height: auto;
          }

          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #ff6b35;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }

          .print-button:hover {
            background: #ff5722;
          }

          @media print {
            .badge {
              box-shadow: none;
              page-break-after: always;
            }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir Crachá</button>

        <div class="badge">
          <div class="badge-header">
            <h2>${employeeName}</h2>
            <p>${employeeFunction}</p>
          </div>

          <div class="barcode-container">
            <svg id="barcode"></svg>
          </div>
        </div>

        <script>
          JsBarcode("#barcode", "${barcodeValue}", {
            format: "CODE128",
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 16,
            margin: 5
          });
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            {employee ? 'Editar Colaborador' : 'Novo Colaborador'}
          </h3>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 font-semibold mb-1">Erros:</p>
              <ul className="list-disc list-inside text-red-700 text-sm">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} id="employee-form" className="space-y-4">
            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Avatar
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-2xl font-medium">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG ou WebP. Máximo 5MB.
              </p>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: João da Silva"
                required
                minLength={3}
                maxLength={255}
              />
            </div>

            {/* Setor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setor *
              </label>
              <select
                value={formData.sector_id}
                onChange={(e) => setFormData({ ...formData, sector_id: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione um setor</option>
                {sectors.map(sector => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Função */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Função *
              </label>
              <input
                type="text"
                value={formData.function_description}
                onChange={(e) => setFormData({ ...formData, function_description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Gerente de Vendas"
                required
                minLength={3}
                maxLength={255}
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuário *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: joao.silva"
                required
                minLength={3}
                maxLength={100}
                pattern="[a-zA-Z0-9._-]+"
                title="Apenas letras, números, pontos, underscores e hífens"
                autoComplete="off"
                name="employee-username"
              />
            </div>

            {/* Password (only for new employees) */}
            {!employee && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  maxLength={100}
                  autoComplete="new-password"
                  name="employee-password"
                />
              </div>
            )}

            {/* Permissions Section */}
            <div className="border-t pt-6 mt-6">
              <h4 className="text-lg font-semibold mb-2 text-gray-900">
                Permissões de Acesso
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Configure quais módulos e funcionalidades este colaborador poderá acessar no sistema.
                Se nenhuma permissão for selecionada, o colaborador não terá acesso a nenhum módulo.
              </p>

              <PermissionsSelector
                selectedPermissions={permissions}
                onChange={setPermissions}
              />
            </div>

            {/* Barcode Display (only for existing employees) */}
            {employee && employee.barcode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Barras
                </label>
                <BarcodeDisplay value={employee.barcode} />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    O código de barras não pode ser alterado.
                  </p>
                  <button
                    type="button"
                    onClick={handlePrintBarcode}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir Crachá
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer fixo com botões */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              type="submit"
              form="employee-form"
              disabled={isSubmitting}
              className="py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
