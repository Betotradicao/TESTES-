import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * Componente que verifica se o sistema precisa de setup inicial
 * Redireciona para /first-setup se necessário
 */
export default function SetupCheck({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      console.log('🔍 SetupCheck: Verificando status do setup...');
      const response = await api.get('/setup/status');
      const { needsSetup } = response.data;

      console.log('🔍 SetupCheck: needsSetup =', needsSetup);
      setNeedsSetup(needsSetup);

      // Se precisa de setup E não está já em /first-setup, redireciona
      if (needsSetup && location.pathname !== '/first-setup') {
        console.log('🔧 SetupCheck: Sistema precisa de configuração inicial - Redirecionando para /first-setup');
        navigate('/first-setup', { replace: true });
      } else if (needsSetup) {
        console.log('✅ SetupCheck: Já está em /first-setup, não precisa redirecionar');
      } else {
        console.log('✅ SetupCheck: Sistema já configurado - Permitindo acesso normal');
      }
    } catch (error) {
      console.error('❌ SetupCheck: Erro ao verificar status do setup:', error);
      console.error('❌ SetupCheck: Assumindo que NÃO precisa de setup (para evitar loop)');
      // Em caso de erro, assume que não precisa de setup e continua
      // Isso evita loop infinito se o backend estiver offline
    } finally {
      setIsChecking(false);
    }
  };

  // Enquanto estiver verificando, mostra um loading
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #ea580c',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Verificando configuração do sistema...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Se precisa de setup E não está em /first-setup, não renderiza nada (navegação acontecendo)
  // Se precisa de setup MAS está em /first-setup, renderiza normalmente para mostrar a página
  if (needsSetup && location.pathname !== '/first-setup') {
    return null;
  }

  // Renderiza normalmente (ou está configurado, ou está em /first-setup)
  return children;
}
