import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SectorsService } from '../services/sectors.service';
import { validateCreateSector } from '../dtos/create-sector.dto';
import { validateUpdateSector } from '../dtos/update-sector.dto';

export class SectorsController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const onlyActive = req.query.active === 'true';
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const sectors = await SectorsService.findAll(onlyActive, codLoja);

      res.json(sectors);
    } catch (error) {
      console.error('Get all sectors error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid sector ID' });
      }

      const sector = await SectorsService.findById(id);
      res.json(sector);
    } catch (error: any) {
      console.error('Get sector by ID error:', error);

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const validation = validateCreateSector(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const sector = await SectorsService.create(req.body);
      res.status(201).json(sector);
    } catch (error: any) {
      console.error('Create sector error:', error);

      if (error.message === 'Sector name already exists') {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid sector ID' });
      }

      const validation = validateUpdateSector(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const sector = await SectorsService.update(id, req.body);
      res.json(sector);
    } catch (error: any) {
      console.error('Update sector error:', error);

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Sector name already exists') {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async toggle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid sector ID' });
      }

      const sector = await SectorsService.toggleStatus(id);
      res.json(sector);
    } catch (error: any) {
      console.error('Toggle sector error:', error);

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
