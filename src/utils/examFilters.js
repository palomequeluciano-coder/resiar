/*
 * ResiAR — utilidades para filtros de bancos/exámenes.
 */

export const PROVINCIA_VALUE = '__PROVINCIA_BA__';
export const EU_VALUE = '__EU__';

export function esProvinciaBsAs(ex) {
  const u = (ex || '').toUpperCase();
  return u.includes('BUENOS AIRES') || u.includes('PROVINCIA') || u.includes('PBA');
}

export function esBancoMIR(ex) {
  return (ex || '').toUpperCase().includes('MIR');
}

export function esExamenUnico(ex) {
  return (ex || '').toUpperCase() === 'EU';
}

export function labelExamen(value) {
  if (value === PROVINCIA_VALUE) return 'Provincia de Buenos Aires';
  if (value === EU_VALUE) return 'Examen Único';
  return value;
}
