import { useState, useEffect } from 'react';
import api from '../services/api';

// Cache global pra evitar flash (carrega 1x, compartilha entre renders)
let _cachedBrand = { name: null, logo: null, loaded: false };

export default function Logo({ size = "medium", collapsed = false }) {
  const [brandName, setBrandName] = useState(_cachedBrand.name);
  const [logoUrl, setLogoUrl] = useState(_cachedBrand.logo);
  const [loaded, setLoaded] = useState(_cachedBrand.loaded);

  useEffect(() => {
    if (_cachedBrand.loaded) return; // Ja carregou, nao busca de novo
    api.get('/config/configurations')
      .then(res => {
        const configs = res.data?.data || res.data || {};
        const name = configs.client_brand_name || null;
        const logo = configs.client_logo_url || null;
        _cachedBrand = { name, logo, loaded: true };
        setBrandName(name);
        setLogoUrl(logo);
        setLoaded(true);
      })
      .catch(() => {
        _cachedBrand.loaded = true;
        setLoaded(true);
      });
  }, []);

  const sizeClasses = {
    small: { icon: "h-8 w-8", nameText: "text-xs" },
    medium: { icon: "h-14 w-14", nameText: "text-sm" },
    large: { icon: "h-28 w-auto max-w-[160px]", nameText: "text-sm" }
  };
  const classes = sizeClasses[size] || sizeClasses.medium;

  // Modo colapsado: so icone/iniciais
  if (collapsed) {
    if (!loaded) return <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />;
    if (logoUrl) return <img src={logoUrl} alt={brandName || 'Logo'} className="w-10 h-10 object-contain rounded-lg" />;
    const initials = brandName ? brandName.substring(0, 2).toUpperCase() : 'R';
    return (
      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">{initials}</span>
      </div>
    );
  }

  // Enquanto carrega, mostra placeholder do mesmo tamanho (sem flash)
  if (!loaded) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className={`${classes.icon} bg-gray-200 rounded-lg animate-pulse`} />
      </div>
    );
  }

  // Se tem logo customizado
  if (logoUrl) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <img src={logoUrl} alt={brandName || 'Logo'} className={`${classes.icon} object-contain`} />
        {brandName && (
          <div className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-1">
            <span className="text-xs font-bold text-orange-600 uppercase text-center block leading-tight" style={{letterSpacing: '0.05em'}}>
              {brandName}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Se tem nome customizado mas sem logo
  if (brandName) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="h-16 w-16 bg-orange-500 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-2xl">{brandName.substring(0, 2).toUpperCase()}</span>
        </div>
        <div className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-1">
          <span className="text-xs font-bold text-orange-600 uppercase text-center block leading-tight" style={{letterSpacing: '0.05em'}}>
            {brandName}
          </span>
        </div>
      </div>
    );
  }

  // Default: logo Radar 360
  return (
    <div className="flex items-center space-x-3">
      <div className="h-12 w-12 bg-orange-500 rounded-lg flex items-center justify-center">
        <svg className="h-5/6 w-5/6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="4"/>
          <path d="M12 12l7-7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="16" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="16" r="1" fill="currentColor"/>
        </svg>
      </div>
      <div className="flex flex-col leading-none text-center">
        <span className="text-xl font-bold text-orange-500 uppercase" style={{letterSpacing: '0.25em'}}>RADAR</span>
        <span className="text-2xl font-bold italic text-gray-600 tracking-widest" style={{marginTop: '-4px'}}>360</span>
      </div>
    </div>
  );
}

// Exporta funcao pra forcar reload do cache (usado no Restaurar Logo)
Logo.clearCache = () => {
  _cachedBrand = { name: null, logo: null, loaded: false };
};
