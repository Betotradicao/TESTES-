import { useState } from 'react';
import Layout from '../components/Layout';

export default function GarimpaFornecedores() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Fornecedores e Concorrentes</h1>
              <p className="text-orange-100 mt-1">Garimpa Facil - Pesquisa e comparacao de fornecedores e concorrentes</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Em construção */}
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2L2 12l10 10 10-10L12 2z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8l-4 4 4 4 4-4-4-4z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Em breve!</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            O modulo Garimpa Facil esta em desenvolvimento. Em breve voce podera pesquisar e comparar fornecedores e concorrentes diretamente pelo sistema.
          </p>
        </div>
      </div>
    </Layout>
  );
}
