export const pageContainer = 'mx-auto max-w-6xl px-6 py-10 space-y-10';

export const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
export const cardPadded = `${card} p-8`;

export const buttonBase =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60';
export const primaryButton = `${buttonBase} bg-blue-600 text-white hover:bg-blue-700`;
export const secondaryButton = `${buttonBase} bg-slate-100 text-slate-900 hover:bg-slate-200`;
export const dangerButton = `${buttonBase} bg-red-500 text-white hover:bg-red-600`;
export const successButton = `${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`;
export const iconButton =
  'inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700';

export const inputBase =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
export const textareaBase = `${inputBase} min-h-[120px] resize-vertical`;
export const selectBase = `${inputBase} pr-10`;

export const sectionTitle = 'text-2xl font-semibold text-slate-900';
export const sectionSubtitle = 'text-sm text-slate-600';

export const tag = 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700';
export const tagPrimary = 'inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white';
