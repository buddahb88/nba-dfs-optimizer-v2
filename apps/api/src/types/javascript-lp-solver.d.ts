declare module 'javascript-lp-solver' {
  interface Model {
    optimize: string;
    opType: 'max' | 'min';
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, number>;
  }

  interface Result {
    feasible: boolean;
    result: number;
    bounded: boolean;
    [key: string]: number | boolean;
  }

  function Solve(model: Model): Result;

  export { Model, Result, Solve };
  export default { Solve };
}
