import { badRequest } from '../utils/http-error.js';

export function createLaptopImportController({ importer }) {
  return {
    /** Downloads the Excel template. */
    async template(_req, res) {
      const file = await importer.template();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="laptopy-laptops-template.xlsx"',
      });
      res.send(file);
    },

    /**
     * Imports an .xlsx / .csv sent as the raw request body.
     *   ?dryRun=1   only report what would change (nothing is saved)
     *   ?replace=1  also delete laptops that are not in the file
     */
    async importFile(req, res) {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw badRequest('Choose an Excel (.xlsx) or CSV file first.', 'no_file');
      }
      res.json(
        await importer.run({
          buffer: req.body,
          dryRun: req.query.dryRun === '1',
          replace: req.query.replace === '1',
        }),
      );
    },
  };
}
