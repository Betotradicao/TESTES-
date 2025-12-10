import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SalesService } from '../services/sales.service';

export class SalesController {
  static async getSales(req: AuthRequest, res: Response) {
    try {
      const { from, to } = req.query;

      // Validate required parameters
      if (!from || !to) {
        return res.status(400).json({
          error: 'Parameters from and to are required in format YYYY-MM-DD'
        });
      }

      // Validate date format (YYYY-MM-DD)
      if (!SalesService.validateDateFormat(from as string) || !SalesService.validateDateFormat(to as string)) {
        return res.status(400).json({
          error: 'Dates must be in format YYYY-MM-DD'
        });
      }

      // Convert dates from YYYY-MM-DD to YYYYMMDD for ERP API
      const fromFormatted = SalesService.formatDateToERP(from as string);
      const toFormatted = SalesService.formatDateToERP(to as string);

      // Fetch sales from ERP using service
      const erpSales = await SalesService.fetchSalesFromERP(fromFormatted, toFormatted);

      res.json({
        data: erpSales,
        total: erpSales.length,
        filters: {
          from: from as string,
          to: to as string
        }
      });

    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}