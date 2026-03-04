import { useState } from 'react';
import Layout from '../components/Layout';

export default function MetasRanking() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <circle cx="12" cy="12" r="6" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ranking de Metas</h1>
            <p className="text-sm text-gray-500">Acompanhamento de metas por operador/setor</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Ranking de Metas</h2>
          <p className="text-gray-500">Em breve: ranking de metas por operador e setor.</p>
        </div>
      </div>
    </Layout>
  );
}
