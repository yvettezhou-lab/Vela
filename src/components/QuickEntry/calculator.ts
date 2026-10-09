export type CalculatorOperator = '+' | '-' | '*' | '/';

type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: CalculatorOperator };

const isOperator = (value: string): value is CalculatorOperator =>
  value === '+' || value === '-' || value === '*' || value === '/';

const tokenize = (input: string): Token[] | null => {
  const expression = input.replace(/\\s+/g, '');
  if (!expression || !/^[0-9.+*/-]+$/.test(expression)) return null;

  const tokens: Token[] = [];
  let index = 0;
  let expectsNumber = true;

  while (index < expression.length) {
    const ch = expression[index];

    if (/[0-9.]/.test(ch) || (expectsNumber && ch === '-')) {
      const start = index;
      if (ch === '-') index += 1;
      let dots = 0;
      let digits = 0;
      while (index < expression.length && /[0-9.]/.test(expression[index])) {
        if (expression[index] === '.') dots += 1;
        else digits += 1;
        if (dots > 1) return null;
        index += 1;
      }
      if (digits === 0) return null;
      const value = Number(expression.slice(start, index));
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'number', value });
      expectsNumber = false;
      continue;
    }

    if (isOperator(ch) && !expectsNumber) {
      tokens.push({ type: 'operator', value: ch });
      index += 1;
      expectsNumber = true;
      continue;
    }

    return null;
  }

  return expectsNumber ? null : tokens;
};

export const evaluateCalculatorExpression = (input: string): number | null => {
  const tokens = tokenize(input);
  if (!tokens?.length || tokens[0].type !== 'number' || tokens.at(-1)?.type !== 'number') {
    return null;
  }

  const values: Token[] = [...tokens];

  for (let index = 1; index < values.length - 1; ) {
    const token = values[index];
    if (token.type !== 'operator' || (token.value !== '*' && token.value !== '/')) {
      index += 1;
      continue;
    }

    const left = values[index - 1];
    const right = values[index + 1];
    if (left.type !== 'number' || right.type !== 'number') return null;
    if (token.value === '/' && right.value === 0) return null;

    const result = token.value === '*' ? left.value * right.value : left.value / right.value;
    if (!Number.isFinite(result)) return null;

    values.splice(index - 1, 3, { type: 'number', value: result });
    index = 1;
  }

  let result = values[0];
  if (result.type !== 'number') return null;

  for (let index = 1; index < values.length; index += 2) {
    const operator = values[index];
    const right = values[index + 1];
    if (operator.type !== 'operator' || right.type !== 'number') return null;
    result = {
      type: 'number',
      value: operator.value === '+' ? result.value + right.value : result.value - right.value,
    };
    if (!Number.isFinite(result.value)) return null;
  }

  return result.value;
};

export const formatCalculatorResult = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  return String(Number(value.toFixed(2)));
};

export const normalizeCalculatorExpression = (input: string): string =>
  input.replace(/[−×÷]/g, (operator) => ({ '−': '-', '×': '*', '÷': '/' })[operator] ?? operator);

export const displayCalculatorExpression = (input: string): string =>
  normalizeCalculatorExpression(input).replace(/\+/g, '＋').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
