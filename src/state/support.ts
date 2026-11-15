import { useState } from 'react';

const prefix = 'demeu.support.';
export function useSupportSetting<T>(key: string, initial: T, valid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(prefix + key) ?? 'null'); return valid(saved) ? saved : initial; }
    catch { return initial; }
  });
  const update = (next: T | ((previous: T) => T)) => {
    setValue(previous => {
      const result = typeof next === 'function' ? (next as (v: T) => T)(previous) : next;
      try { localStorage.setItem(prefix + key, JSON.stringify(result)); } catch { /* Keep the demo usable without storage. */ }
      return result;
    });
  };
  return [value, update] as const;
}
export const stringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isString = (v: unknown): v is string => typeof v === 'string';
export function clearDemeuStorage() {
  try { Object.keys(localStorage).filter(key => key.startsWith('demeu.')).forEach(key => localStorage.removeItem(key)); } catch { /* The app context is also reset. */ }
}
export interface CabinetProfile { name: string; specialty: string; methods: string; price: string; duration: string; address: string }
export const initialCabinet: CabinetProfile = { name: 'Анна Сергеева', specialty: 'Логопед', methods: 'PECS, нейрологопедический массаж, сенсорная интеграция', price: '8000', duration: '45', address: 'ул. Тимирязева, 42, каб. 12' };
export const isCabinet = (v: unknown): v is CabinetProfile => !!v && typeof v === 'object' && Object.keys(initialCabinet).every(key => typeof (v as Record<string, unknown>)[key] === 'string');
