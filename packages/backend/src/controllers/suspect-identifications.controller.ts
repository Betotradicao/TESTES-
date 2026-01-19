import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

// Buscar o próximo número sequencial disponível
export const getNextNumber = async (req: Request, res: Response) => {
  try {
    const result = await AppDataSource.query(`
      SELECT DISTINCT identification_number
      FROM suspect_identifications
      ORDER BY identification_number DESC
      LIMIT 1
    `);

    let nextNumber = '01';

    if (result && result.length > 0) {
      const lastNumber = parseInt(result[0].identification_number);
      nextNumber = String(lastNumber + 1).padStart(2, '0');
    }

    return res.json({ nextNumber });
  } catch (error: any) {
    console.error('Error getting next number:', error);
    return res.status(500).json({
      error: 'Erro ao buscar próximo número',
      details: error.message
    });
  }
};

// Criar nova identificação
export const create = async (req: Request, res: Response) => {
  try {
    const { identification_number, bip_id, notes } = req.body;

    // Validar dados obrigatórios
    if (!identification_number || !bip_id) {
      return res.status(400).json({
        error: 'Número de identificação e ID do bip são obrigatórios'
      });
    }

    // Verificar se já existe identificação para este bip
    const existingBip = await AppDataSource.query(
      'SELECT id FROM suspect_identifications WHERE bip_id = $1',
      [bip_id]
    );

    if (existingBip && existingBip.length > 0) {
      return res.status(400).json({
        error: 'Este cancelamento já possui uma identificação'
      });
    }

    // Criar nova identificação
    const result = await AppDataSource.query(
      `INSERT INTO suspect_identifications
       (identification_number, bip_id, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [identification_number, bip_id, notes || null]
    );

    return res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Error creating identification:', error);
    return res.status(500).json({
      error: 'Erro ao criar identificação',
      details: error.message
    });
  }
};

// Listar todas as identificações
export const list = async (req: Request, res: Response) => {
  try {
    const identifications = await AppDataSource.query(`
      SELECT
        si.id,
        si.identification_number,
        si.bip_id,
        si.notes,
        si.created_at,
        si.updated_at
      FROM suspect_identifications si
      ORDER BY si.identification_number ASC
    `);

    return res.json(identifications);
  } catch (error: any) {
    console.error('Error listing identifications:', error);
    return res.status(500).json({
      error: 'Erro ao listar identificações',
      details: error.message
    });
  }
};
