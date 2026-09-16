export const RESPONSE_CONTRACT_VERSION = 'spectra-pro-ai-response/v1';

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    language: {
      type: 'string',
      description: 'Short language tag for the prose fields, normally sv, en, es, de, fr, etc. Use en when the observation language is absent or cannot be identified reliably.'
    },
    summary: {
      type: 'string',
      description: 'One or two concise sentences stating the main interpretation. Do not overstate certainty.'
    },
    interpretation: {
      type: 'string',
      description: 'Concise scientific explanation of the strongest evidence and relevant secondary candidates. Keep measured data, SPECTRA PRO matches and model interpretation conceptually distinct.'
    },
    dataQuality: {
      type: 'string',
      description: 'Important calibration, residual, signal-quality, saturation, QC or analysis-setting information that materially affects interpretation. Use an empty string when there is nothing material to add.'
    },
    caveats: {
      type: 'string',
      description: 'Important ambiguity or limitation, including sparse evidence, overlapping lines or bands, missing calibration, conflicting candidates or unsupported quantitative conclusions. Use an empty string when no material caveat is present.'
    },
    conclusion: {
      type: 'string',
      description: 'A short final assessment that states what the supplied evidence most reasonably supports without presenting Score Share as probability, concentration or abundance.'
    }
  },
  required: ['language', 'summary', 'interpretation', 'dataQuality', 'caveats', 'conclusion']
};

export function buildResponseFormat() {
  return {
    type: 'json_schema',
    name: 'spectra_pro_interpretation',
    description: 'Structured, concise scientific interpretation of a validated SPECTRA PRO spectrum analysis.',
    strict: true,
    schema: RESPONSE_SCHEMA
  };
}

export function validateStructuredResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['Result must be an object.'] };
  }

  const allowed = new Set(['language', 'summary', 'interpretation', 'dataQuality', 'caveats', 'conclusion']);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) errors.push('Unexpected response field: ' + key);
  });

  allowed.forEach((key) => {
    if (typeof value[key] !== 'string') errors.push(key + ' must be a string.');
  });

  if (typeof value.language === 'string' && value.language.length > 16) {
    errors.push('language is too long.');
  }

  return { ok: errors.length === 0, errors: errors.slice(0, 8) };
}

export function flattenStructuredResult(value) {
  const checked = validateStructuredResult(value);
  if (!checked.ok) return '';
  return [value.summary, value.interpretation, value.dataQuality, value.caveats, value.conclusion]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');
}
