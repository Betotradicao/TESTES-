/**
 * Registry central de todas as tools disponiveis pro Agente IA.
 * Cada tool eh importada aqui e adicionada ao Map.
 * Pra adicionar nova tool: criar o arquivo .tool.ts e registrar aqui.
 */
import type { ToolDefinition } from './types';
import { vendaHojeTool } from './tools/venda-hoje.tool';
import { vendaMesTool } from './tools/venda-mes.tool';
import { topQuedasTool } from './tools/top-quedas.tool';
import { quebrasHojeTool } from './tools/quebras-hoje.tool';
import { bipagensPendentesTool } from './tools/bipagens-pendentes.tool';
import { fornecedoresAtrasadosTool } from './tools/fornecedores-atrasados.tool';
import { rupturaHojeTool } from './tools/ruptura-hoje.tool';
import { consultarPrecoTool } from './tools/consultar-preco.tool';
import { aniversariantesTool } from './tools/aniversariantes.tool';
import { resumoDiaTool } from './tools/resumo-dia.tool';

export const ALL_TOOLS: ToolDefinition[] = [
  vendaHojeTool,
  vendaMesTool,
  topQuedasTool,
  quebrasHojeTool,
  bipagensPendentesTool,
  fornecedoresAtrasadosTool,
  rupturaHojeTool,
  consultarPrecoTool,
  aniversariantesTool,
  resumoDiaTool,
];

const TOOL_MAP = new Map<string, ToolDefinition>();
ALL_TOOLS.forEach(t => TOOL_MAP.set(t.name, t));

/** Recupera tool pelo nome */
export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_MAP.get(name);
}

/** Lista de tools habilitadas (com base no config) - formato OpenAI tools[] */
export function getEnabledToolsForOpenAI(toolsHabilitadas: Record<string, boolean>) {
  return ALL_TOOLS
    .filter(t => toolsHabilitadas[t.name] === true)
    .map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.descricaoGPT,
        parameters: t.parameters,
      },
    }));
}

/** Lista pra exibir na UI (agrupado por categoria) */
export function getToolsForUI() {
  const byCategoria: Record<string, Array<{ name: string; descricao: string }>> = {};
  ALL_TOOLS.forEach(t => {
    if (!byCategoria[t.categoria]) byCategoria[t.categoria] = [];
    byCategoria[t.categoria].push({ name: t.name, descricao: t.descricao });
  });
  return byCategoria;
}
