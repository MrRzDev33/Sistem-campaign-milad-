import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
};

export const getDailyReminder = () => {
  const lastReminder = localStorage.getItem('dmc_milad_last_reminder');
  const today = new Date().toDateString();
  
  if (lastReminder !== today) {
    return true;
  }
  return false;
};

export const setDailyReminderSeen = () => {
  localStorage.setItem('dmc_milad_last_reminder', new Date().toDateString());
};
