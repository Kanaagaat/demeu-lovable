import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test } from 'vitest';
import App from './App';

// Shell-only tests: screens are implemented separately and have their own tests.
function renderApp(path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
}

describe('application shell', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('demeu.onboarded', 'true'); });

  test('home shows five tabs and navigation changes the active tab', async () => {
    const user = userEvent.setup();
    renderApp();
    const navigation = screen.getByRole('navigation', { name: 'Основная навигация' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(5);
    const home = within(navigation).getByRole('link', { name: 'Главная' });
    expect(home).toHaveAttribute('aria-current', 'page');
    const plan = within(navigation).getByRole('link', { name: 'План' });
    await user.click(plan);
    expect(plan).toHaveAttribute('aria-current', 'page');
    expect(home).not.toHaveAttribute('aria-current');
  });

  test.each(['/consent', '/login', '/quiz', '/quiz/voice', '/book/1'])('hides tabs on %s', (path) => {
    renderApp(path);
    expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument();
  });

  test('not onboarded → redirected away from tabs, SOS stays open', () => {
    localStorage.setItem('demeu.onboarded', 'false');
    renderApp('/plan');
    expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument();
  });

  test('missing icon leaves navigation usable', () => {
    renderApp();
    const icon = screen.getByRole('link', { name: 'Главная' }).querySelector('img')!;
    fireEvent.error(icon);
    expect(icon).toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/');
  });
});
