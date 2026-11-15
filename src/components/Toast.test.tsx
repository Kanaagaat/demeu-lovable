import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast('Сохранено')}>Показать</button>;
}

afterEach(() => { vi.useRealTimers(); });

test('toast stays visible for 2.4 seconds, restarting the timer on a new message', () => {
  vi.useFakeTimers();
  render(<ToastProvider><Trigger /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Показать' }));
  expect(screen.getByRole('status')).toHaveTextContent('Сохранено');
  act(() => vi.advanceTimersByTime(2000));
  fireEvent.click(screen.getByRole('button', { name: 'Показать' }));
  act(() => vi.advanceTimersByTime(2399));
  expect(screen.getByRole('status')).toHaveTextContent('Сохранено');
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
