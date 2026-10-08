import {
  displayCalculatorExpression,
  evaluateCalculatorExpression,
  formatCalculatorResult,
} from './calculator';

describe('calculator', () => {
  it('respects multiplication and division precedence', () => {
    expect(evaluateCalculatorExpression('98+17+5+31')).toBe(151);
    expect(evaluateCalculatorExpression('100+20*3')).toBe(160);
    expect(evaluateCalculatorExpression('120/2-5')).toBe(55);
  });

  it('rejects incomplete and unsafe expressions', () => {
    expect(evaluateCalculatorExpression('98+')).toBeNull();
    expect(evaluateCalculatorExpression('1/0')).toBeNull();
    expect(evaluateCalculatorExpression('foo()')).toBeNull();
  });

  it('formats and displays operators for the Vela keypad', () => {
    expect(formatCalculatorResult(151.004)).toBe('151');
    expect(displayCalculatorExpression('98+17*2')).toBe('98＋17×2');
  });
});
