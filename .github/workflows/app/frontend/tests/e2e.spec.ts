import { test, expect } from '@playwright/test';

// Petit CSV de test en mémoire
const csvContent = `region,amount
West,10
East,20
West,5
`;

test('upload → list → load → filter → export CSV', async ({ page, context }) => {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  await page.goto(base);

  // Upload CSV
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  await fileInput.setInputFiles({
    name: 'sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent, 'utf-8'),
  });

  // Attendre que la liste des datasets se mette à jour (option apparaît)
  const dsSelect = page.locator('select'); // 1er select = datasets dans notre App
  await expect(dsSelect).toBeVisible();
  // Attendre qu'une option non vide soit présente
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel) as HTMLSelectElement | null;
    if (!el) return false;
    return Array.from(el.options).some(o => o.value && o.value.trim().length > 0);
  }, dsSelect.selector());

  // Sélectionner le dataset (1ère option non vide)
  const value = await dsSelect.evaluate((el: HTMLSelectElement) => {
    const opt = Array.from(el.options).find(o => o.value);
    return opt?.value || '';
  });
  await dsSelect.selectOption(value);

  // Charger les données sans filtre (rows visibles dans la Table)
  // Notre App charge auto au changement de dataset, on attend que la table apparaisse
  const table = page.locator('table');
  await expect(table).toBeVisible();
  // Au moins 1 ligne (en-tête + 1 data row)
  await expect(table.locator('tbody tr')).toHaveCountGreaterThan(0);

  // Récupérer la 1ère colonne comme "column" (dans App, la liste se remplit après première lecture)
  const columnSelect = page.locator('select').nth(1); // 2e select = colonne
  await expect(columnSelect).toBeVisible();
  const firstCol = await columnSelect.evaluate((el: HTMLSelectElement) => {
    const opt = Array.from(el.options).find(o => o.value);
    return opt?.value || '';
  });
  await columnSelect.selectOption(firstCol);

  // Saisir valeur "West" si la colonne s'appelle 'region', sinon mettre la première valeur de table
  const valueInput = page.getByPlaceholder('égalité');
  await expect(valueInput).toBeVisible();

  let filterValue = 'West';
  if (firstCol.toLowerCase() !== 'region') {
    // Si colonne différente, lire la première cellule de la 1ère ligne
    const firstCell = table.locator('tbody tr').first().locator('td').first();
    filterValue = (await firstCell.textContent())?.trim() || 'West';
  }
  await valueInput.fill(filterValue);

  // Appliquer filtres
  await page.getByRole('button', { name: /Appliquer filtres/i }).click();

  // Table filtrée (≥ 1 ligne attendue)
  await expect(table.locator('tbody tr')).toHaveCountGreaterThan(0);

  // Export CSV (attend le download)
  const [download] = await Promise.all([
    context.waitForEvent('download'),
    page.getByRole('button', { name: /Export CSV/i }).click(),
  ]);
  const suggested = download.suggestedFilename();
  expect(suggested).toMatch(/\.csv$/);

  // (Optionnel) Vérifier le contenu du CSV téléchargé
  const path = await download.path();
  expect(path).toBeTruthy();
});
