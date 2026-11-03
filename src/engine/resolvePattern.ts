import { CompiledPattern, KnitBlueprint, KnitUserConstraints } from '../types/knit';
import { compilePattern } from './compiler';

/** Size, gauge, needle and yarn: everything that changes the knitting. Language only changes words. */
export function sameMeasurements(a: KnitUserConstraints, b: KnitUserConstraints): boolean {
  const withoutLanguage = ({ language: _language, ...rest }: KnitUserConstraints) => JSON.stringify(rest);
  return withoutLanguage(a) === withoutLanguage(b);
}

function sameSteps(a: CompiledPattern, b: CompiledPattern): boolean {
  return (
    a.allRows.length === b.allRows.length &&
    a.allRows.every((row, i) => row.kind === b.allRows[i].kind && row.repeatCount === b.allRows[i].repeatCount)
  );
}

/**
 * Which pattern to show. A saved project keeps the pattern it was started with, so that improving
 * the app never changes the instructions halfway through a piece of knitting. It is only rebuilt
 * when the knitter changes its measurements, or to translate it, as long as the steps still line up
 * with the saved row. A project from an older version whose steps differ stays in its own language.
 */
export function resolvePattern(
  saved: CompiledPattern | null,
  blueprint: KnitBlueprint,
  constraints: KnitUserConstraints,
  language: 'en' | 'es'
): CompiledPattern {
  if (saved && sameMeasurements(saved.constraints, constraints)) {
    if ((saved.constraints.language ?? 'es') === language) return saved;
    const translated = compilePattern(blueprint, { ...constraints, language });
    return sameSteps(saved, translated) ? translated : saved;
  }
  return compilePattern(blueprint, { ...constraints, language });
}
