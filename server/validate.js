// Tiny schema validator for request bodies and model outputs (no dependency).
// Schema forms: {type:'string', min, max, enum, pattern, optional, default}
//               {type:'number'|'integer', min, max, optional, default} · {type:'boolean', optional, default}
//               {type:'array', items, min, max, optional, default} · {type:'object', props, optional}
export class ValidationError extends Error {
  constructor(message, path) { super(path ? `${path}: ${message}` : message); this.status = 400; this.path = path; }
}

export function validate(schema, value, path = '') {
  if (value === undefined || value === null) {
    if ('default' in schema) return structuredClone(schema.default);
    if (schema.optional) return schema.type === 'object' ? null : undefined;
    throw new ValidationError('is required', path);
  }
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') throw new ValidationError('must be a string', path);
      const v = schema.trim === false ? value : value.trim();
      if (schema.min !== undefined && v.length < schema.min) throw new ValidationError(`must be at least ${schema.min} characters`, path);
      if (schema.max !== undefined && v.length > schema.max) {
        if (schema.truncate) return v.slice(0, schema.max);
        throw new ValidationError(`must be at most ${schema.max} characters`, path);
      }
      if (schema.enum && !schema.enum.includes(v)) throw new ValidationError(`must be one of ${schema.enum.join(', ')}`, path);
      if (schema.pattern && !schema.pattern.test(v)) throw new ValidationError('has an invalid format', path);
      return v;
    }
    case 'number': case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError('must be a number', path);
      if (schema.type === 'integer' && !Number.isInteger(value)) throw new ValidationError('must be an integer', path);
      if (schema.min !== undefined && value < schema.min) throw new ValidationError(`must be >= ${schema.min}`, path);
      if (schema.max !== undefined && value > schema.max) throw new ValidationError(`must be <= ${schema.max}`, path);
      return value;
    }
    case 'boolean':
      if (typeof value !== 'boolean') throw new ValidationError('must be a boolean', path);
      return value;
    case 'array': {
      if (!Array.isArray(value)) throw new ValidationError('must be an array', path);
      if (schema.min !== undefined && value.length < schema.min) throw new ValidationError(`must have at least ${schema.min} items`, path);
      let arr = value;
      if (schema.max !== undefined && arr.length > schema.max) { if (schema.truncate) arr = arr.slice(0, schema.max); else throw new ValidationError(`must have at most ${schema.max} items`, path); }
      return arr.map((v, i) => validate(schema.items, v, `${path}[${i}]`));
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('must be an object', path);
      const out = {};
      for (const [k, s] of Object.entries(schema.props)) {
        const v = validate(s, value[k], path ? `${path}.${k}` : k);
        if (v !== undefined) out[k] = v;
      }
      return out; // unknown keys are dropped
    }
    default: throw new Error('unknown schema type ' + schema.type);
  }
}

export const S = {
  str: (max, extra = {}) => ({type: 'string', max, ...extra}),
  id: {type: 'string', pattern: /^[A-Za-z0-9_-]{6,64}$/},
  opt: s => ({...s, optional: true}),
};
