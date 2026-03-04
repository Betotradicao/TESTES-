import { useState } from 'react';
import Layout from '../components/Layout';

export default function MetasParametrizar() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Parametrizar Metas</h1>
            <p className="text-sm text-gray-500">Configuração de metas por operador, setor e período</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Parametrizar Metas</h2>
          <p className="text-gray-500">Em breve: definição de metas e parâmetros.</p>
        </div>
      </div>
    </Layout>
  );
}
