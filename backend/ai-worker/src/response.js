export const RESPONSE_CONTRACT_VERSION = 'spectra-pro-ai-response/v1';

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    language: {
      type: 'string',
      description: 'Short prose-language tag; use en when uncertain.'
    },
    summary: {
      type: 'string',
      description: 'One sentence stating the main interpretation without overstating certainty.'
    },
    interpretation: {
      type: 'string',
      description: 'Strongest evidence and any relevant secondary candidate.'
    },
    dataQuality: {
      type: 'string',
      description: 'Only quality information that materially affects interpretation; otherwise empty.'
    },
    caveats: {
      type: 'string',
      description: 'Most important ambiguity or unsupported conclusion; otherwise empty.'
    },
    conclusion: {
      type: 'string',
      description: 'One short final assessment supported by the supplied evidence.'
    }
  },
  required: ['language', 'summary', 'interpretation', 'dataQuality', 'caveats', 'conclusion']
};

export function buildResponseFormat() {
  return {
    type: 'json_schema',
    name: 'spectra_pro_interpretation',
    description: 'Concise interpretation of validated SPECTRA PRO analysis.',
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
