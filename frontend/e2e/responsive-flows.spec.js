import { expect, test } from '@playwright/test';

test('dashboard se adapta sem overflow e mantém conteúdo principal visível', async ({ page }) => {
  await page.goto('/dashboard?perfil=medico');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Pacientes Totais')).toBeVisible();
  await expect(page.getByText('Atendimentos por Mês')).toBeVisible();
  await expect(page.getByText('Feed de Atividades')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('tabela clínica oferece controles operacionais e protege o acesso parcial', async ({ page, viewport }) => {
  await page.goto('/patients?perfil=estagiario');
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
  await expect(page.getByText('PARTIAL')).toBeVisible();
  await expect(page.getByText('João da Silva')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Configurar colunas' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Densidade da tabela' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Paciente/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  if (viewport.width < 1200) {
    await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  }
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
});

test('visão de pesquisa preserva a pseudonimização', async ({ page }) => {
  await page.goto('/research/projects/PRJ01?perfil=pesquisador');
  await expect(page.getByRole('heading', { name: 'Fatores de risco em Diabetes Tipo 2' })).toBeVisible();
  await expect(page.getByText('anon-7f3a91c2')).toBeVisible();
  await expect(page.getByText('João da Silva')).toHaveCount(0);
  await expect(page.getByText('111.222.333-44')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
