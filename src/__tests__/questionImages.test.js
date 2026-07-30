import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeQuestionImagePath,
  getQuestionImagePaths,
  normalizeQuestionImageFields,
  getQuestionImageLabel,
  getQuestionImageDomId,
  resiarSetQuestionImagesCacheVersion,
  resiarGetStoredQuestionImagesCacheVersion,
  resiarGetQuestionImagesCacheVersion,
  resiarAppendQuestionImageCacheParam
} from '../utils/questionImages.js';

describe('normalizeQuestionImagePath', () => {
  it('recorta espacios y devuelve string vacío para valores vacíos', () => {
    expect(normalizeQuestionImagePath('  foo/bar.png  ')).toBe('foo/bar.png');
    expect(normalizeQuestionImagePath(null)).toBe('');
    expect(normalizeQuestionImagePath(undefined)).toBe('');
  });
});

describe('getQuestionImagePaths', () => {
  it('devuelve [] si la pregunta no tiene imágenes', () => {
    expect(getQuestionImagePaths({})).toEqual([]);
    expect(getQuestionImagePaths(null)).toEqual([]);
  });

  it('toma imagen_path (legacy) como único path', () => {
    expect(getQuestionImagePaths({ imagen_path: 'a/b.png' })).toEqual(['a/b.png']);
  });

  it('toma imagenes_paths como array', () => {
    expect(getQuestionImagePaths({ imagenes_paths: ['a.png', 'b.png'] })).toEqual(['a.png', 'b.png']);
  });

  it('parsea imagenes_paths como string JSON', () => {
    expect(getQuestionImagePaths({ imagenes_paths: '["a.png","b.png"]' })).toEqual(['a.png', 'b.png']);
  });

  it('parsea imagenes_paths como string separado por | o ;', () => {
    expect(getQuestionImagePaths({ imagenes_paths: 'a.png|b.png' })).toEqual(['a.png', 'b.png']);
  });

  it('prioriza imagen_path legacy al principio, sin duplicar', () => {
    expect(getQuestionImagePaths({
      imagen_path: 'a.png',
      imagenes_paths: ['a.png', 'b.png']
    })).toEqual(['a.png', 'b.png']);
  });

  it('deduplica paths repetidos', () => {
    expect(getQuestionImagePaths({ imagenes_paths: ['a.png', 'a.png', 'b.png'] })).toEqual(['a.png', 'b.png']);
  });
});

describe('normalizeQuestionImageFields', () => {
  it('arma un objeto consistente a partir de campos sueltos', () => {
    const out = normalizeQuestionImageFields({
      imagenes_paths: ['a.png', 'b.png'],
      imagen_alt: '  descripción  ',
      imagen_caption: ' pie de foto '
    });
    expect(out).toEqual({
      imagen_path: 'a.png',
      imagenes_paths: ['a.png', 'b.png'],
      imagen_alt: 'descripción',
      imagen_caption: 'pie de foto'
    });
  });

  it('devuelve imagenes_paths null si no hay imágenes', () => {
    expect(normalizeQuestionImageFields({}).imagenes_paths).toBeNull();
  });
});

describe('getQuestionImageLabel', () => {
  it('extrae el sufijo numérico del nombre de archivo', () => {
    expect(getQuestionImageLabel('carpeta/pregunta_2.png', 0, 2)).toBe('Imagen 2');
    expect(getQuestionImageLabel('pregunta_3b.png', 0, 2)).toBe('Imagen 3b');
  });

  it('usa el índice si no hay sufijo numérico y hay más de una imagen', () => {
    expect(getQuestionImageLabel('foto.png', 2, 3)).toBe('Imagen 3');
  });

  it('devuelve "Imagen" genérico si es la única imagen', () => {
    expect(getQuestionImageLabel('foto.png', 0, 1)).toBe('Imagen');
  });
});

describe('getQuestionImageDomId', () => {
  it('sanitiza el id para usarlo en el DOM', () => {
    expect(getQuestionImageDomId({ id: 'abc-123' })).toBe('abc-123');
    expect(getQuestionImageDomId({ id: 'abc 123!' })).toBe('abc_123_');
  });

  it('usa "actual" si no hay id', () => {
    expect(getQuestionImageDomId({})).toBe('actual');
    expect(getQuestionImageDomId(null)).toBe('actual');
  });
});

describe('cache de versión de imágenes', () => {
  beforeEach(() => {
    // jsdom resetea localStorage entre archivos, pero no entre tests del mismo archivo.
    globalThis.localStorage?.clear?.();
    delete globalThis.window?.__resiarQuestionBankVersion;
  });

  it('guarda y lee la versión de cache en localStorage', () => {
    resiarSetQuestionImagesCacheVersion('v42');
    expect(resiarGetStoredQuestionImagesCacheVersion()).toBe('v42');
  });

  it('combina bankVersion + imageVersion cuando ambos existen', () => {
    resiarSetQuestionImagesCacheVersion('img7');
    expect(resiarGetQuestionImagesCacheVersion({ questionBankVersion: 'bank3' })).toBe('bank3-img7');
  });

  it('usa solo bankVersion si no hay imageVersion guardada', () => {
    globalThis.localStorage?.clear?.();
    expect(resiarGetQuestionImagesCacheVersion({ questionBankVersion: 'bank9' })).toBe('bank9');
  });

  it('appendea el parámetro rv a una URL', () => {
    resiarSetQuestionImagesCacheVersion('v9');
    const url = resiarAppendQuestionImageCacheParam('https://x.com/img.png', { questionBankVersion: 'b1' });
    expect(url).toBe('https://x.com/img.png?rv=b1-v9');
  });

  it('usa & si la URL ya tiene query params', () => {
    resiarSetQuestionImagesCacheVersion('v9');
    const url = resiarAppendQuestionImageCacheParam('https://x.com/img.png?foo=bar', { questionBankVersion: 'b1' });
    expect(url).toBe('https://x.com/img.png?foo=bar&rv=b1-v9');
  });
});
