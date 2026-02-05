import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EquipmentsService } from '../services/equipments.service';
import { validateUpdateEquipment } from '../dtos/update-equipment.dto';

export class EquipmentsController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const equipments = await EquipmentsService.findAll();
      res.json(equipments);
    } catch (error) {
      console.error('Get all equipments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      const equipment = await EquipmentsService.findById(id);
      res.json(equipment);
    } catch (error: any) {
      console.error('Get equipment by ID error:', error);

      if (error.message === 'Equipment not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      console.log(`\n📥 EQUIPMENTS CONTROLLER - update`);
      console.log(`   ID: ${id}`);
      console.log(`   Body recebido:`, JSON.stringify(req.body, null, 2));

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      const validation = validateUpdateEquipment(req.body);
      console.log(`   Validação:`, validation);

      if (!validation.valid) {
        console.log(`   ❌ Validação falhou:`, validation.errors);
        return res.status(400).json({ errors: validation.errors });
      }

      const equipment = await EquipmentsService.update(id, req.body);
      console.log(`   ✅ Equipamento retornado:`, JSON.stringify({ id: equipment.id, cod_loja: equipment.cod_loja }, null, 2));
      res.json(equipment);
    } catch (error: any) {
      console.error('Update equipment error:', error);

      if (error.message === 'Equipment not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async toggle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      const equipment = await EquipmentsService.toggleStatus(id);
      res.json(equipment);
    } catch (error: any) {
      console.error('Toggle equipment error:', error);

      if (error.message === 'Equipment not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      const result = await EquipmentsService.delete(id);
      res.json(result);
    } catch (error: any) {
      console.error('Delete equipment error:', error);

      if (error.message === 'Equipment not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
