import React from 'react';

export const evaluateAmountExpression = (input: string): number | null => {
  const expression = input.replace(/\s+/g, '');
  if (!expression || !/^[0-9.+*/()\-]+$/.test(expression)) return null;
  let index = 0;
  const parseNumber = (): number | null => {
    const start = index;
    while (index < expression.length && /[0-9.]/.test(expression[index])) index += 1;
    if (start === index) return null;
    const value = Number(expression.slice(start, index));
    return Number.isFinite(value) ? value : null;
  };
  const parseFactor = (): number | null => {
    let sign = 1;
    while (expression[index] === '+' || expression[index] === '-') {
      if (expression[index] === '-') sign *= -1;
      index += 1;
    }
    let value: number | null;
    if (expression[index] === '(') {
      index += 1;
      value = parseExpression();
      if (expression[index] !== ')') return null;
      index += 1;
    } else {
      value = parseNumber();
    }
    return value === null ? null : sign * value;
  };
  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;
    while (expression[index] === '*' || expression[index] === '/') {
      const op = expression[index++];
      const rhs = parseFactor();
      if (rhs === null || (op === '/' && rhs === 0)) return null;
      value = op === '*' ? value * rhs : value / rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  };
  function parseExpression(): number | null {
    let value = parseTerm();
    if (value === null) return null;
    while (expression[index] === '+' || expression[index] === '-') {
      const op = expression[index++];
      const rhs = parseTerm();
      if (rhs === null) return null;
      value = op === '+' ? value + rhs : value - rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  }
  const result = parseExpression();
  return result !== null && index === expression.length && Number.isFinite(result) ? result : null;
};


interface AmountKeypadProps {
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
}

export const AmountKeypad: React.FC<AmountKeypadProps> = ({ value, onChange }) => {
  const handleKey = (key: string) => {
    if (key === 'clear') {
      onChange('');
      return;
    }
    if (key === 'backspace') {
      onChange((current) => current.slice(0, -1));
      return;
    }
    if (key === 'equals') {
      onChange((current) => {
        const result = evaluateAmountExpression(current);
        return result === null ? current : String(Number(result.toFixed(2)));
      });
      return;
    }
    if (key === '.') {
      onChange((current) => {
        const currentNumber = current.split(/[+*/-]/).pop() ?? '';
        return currentNumber.includes('.') ? current : current + '.';
      });
      return;
    }
    onChange((current) => {
      if (['+', '-', '*', '/'].includes(key)) {
        if (!current) return key === '-' ? '-' : current;
        if (/[+*/-]$/.test(current)) return current;
      }
      return current + key;
    });
  };

  return (
    <details className="quick-entry-amount-keypad-shell">
      <summary className="quick-entry-amount-value" aria-label="Amount">
        {value || '0.00'}
      </summary>
      <div className="quick-entry-amount-keypad" role="dialog" aria-label="Amount keypad">
        <div className="quick-entry-amount-keypad-grid">
          {[
            ['C', 'clear', 'quick-entry-amount-keypad-action'],
            ['⌫', 'backspace', 'quick-entry-amount-keypad-action'],
            ['÷', '/', 'quick-entry-amount-keypad-operator'],
            ['×', '*', 'quick-entry-amount-keypad-operator'],
            ['7', '7', ''],
            ['8', '8', ''],
            ['9', '9', ''],
            ['−', '-', 'quick-entry-amount-keypad-operator'],
            ['4', '4', ''],
            ['5', '5', ''],
            ['6', '6', ''],
            ['＋', '+', 'quick-entry-amount-keypad-operator'],
            ['1', '1', ''],
            ['2', '2', ''],
            ['3', '3', ''],
            ['=', 'equals', 'quick-entry-amount-keypad-equals'],
            ['0', '0', 'quick-entry-amount-keypad-zero'],
            ['.', '.', ''],
            ['Done', 'done', 'quick-entry-amount-keypad-done'],
          ].map(([label, key, extraClass]) => (
            <button
              key={label}
              type="button"
              className={extraClass}
              onClick={(event) => {
                if (key === 'done') {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  return;
                }
                handleKey(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
};

