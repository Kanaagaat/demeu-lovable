import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { I18nProvider } from '../i18n';
import { AppStateProvider } from '../state/AppState';
import Calendar from './Calendar';
import Progress from './Progress';

function open(page: JSX.Element) {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><AppStateProvider><ToastProvider>{page}</ToastProvider></AppStateProvider></I18nProvider></MemoryRouter>);
}
beforeEach(() => localStorage.clear());

test('calendar adds a weekly session for today and records attendance', async () => {
  const user = userEvent.setup();
  open(<Calendar />);
  expect(screen.getByText('В этот день занятий нет')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Что за занятие'), 'Логопед');
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(screen.getByText('Логопед')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Было' }));
  expect(screen.getByRole('button', { name: 'Было' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('В этом месяце: было 1 из 1')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('demeu.progress.sessions')!)).toHaveLength(1);
});

test('progress records a level per goal and keeps small wins', async () => {
  const user = userEvent.setup();
  open(<Progress />);
  const speech = screen.getByRole('region', { name: 'Речь' });
  expect(speech).toHaveTextContent('Ещё нет отметок');
  await user.click(screen.getAllByRole('button', { name: 'С подсказкой' })[0]);
  expect(speech).toHaveTextContent('С подсказкой');
  await user.type(screen.getByRole('textbox', { name: 'Маленькие победы' }), 'Сам надел куртку');
  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(screen.getByText('Сам надел куртку')).toBeInTheDocument();
  expect(screen.queryByText(/диагноз/)).toBeInTheDocument();
});
