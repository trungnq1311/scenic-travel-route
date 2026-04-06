import { validateGenerateRequest } from '../input-validation';

describe('validateGenerateRequest', () => {
  test('accepts valid origin and destination', () => {
    const result = validateGenerateRequest({
      origin: 'Ho Chi Minh City',
      destination: 'Vung Tau',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.origin).toBe('Ho Chi Minh City');
      expect(result.value.destination).toBe('Vung Tau');
      expect(result.value.originVi).toBe('Ho Chi Minh City');
      expect(result.value.destinationVi).toBe('Vung Tau');
    }
  });

  test('normalizes whitespace', () => {
    const result = validateGenerateRequest({
      origin: '  Ho   Chi   Minh   City  ',
      destination: '  Vung   Tau ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.origin).toBe('Ho Chi Minh City');
      expect(result.value.destination).toBe('Vung Tau');
    }
  });

  test('rejects invalid payload shape', () => {
    expect(validateGenerateRequest(null).ok).toBe(false);
    expect(validateGenerateRequest('bad').ok).toBe(false);
    expect(validateGenerateRequest({}).ok).toBe(false);
  });

  test('rejects invalid location characters', () => {
    const result = validateGenerateRequest({
      origin: 'HCM<script>',
      destination: 'Vung Tau',
    });
    expect(result.ok).toBe(false);
  });

  test('keeps chillLevel only when valid', () => {
    const valid = validateGenerateRequest({
      origin: 'Saigon',
      destination: 'Da Lat',
      preferences: { chillLevel: 'medium' },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value.preferences?.chillLevel).toBe('medium');
    }

    const invalid = validateGenerateRequest({
      origin: 'Saigon',
      destination: 'Da Lat',
      preferences: { chillLevel: 'extreme' },
    });
    expect(invalid.ok).toBe(true);
    if (invalid.ok) {
      expect(invalid.value.preferences).toBeUndefined();
    }
  });
});
