/**
 * ADR-023 strict linear regex subset for adapter-controlled extraction patterns.
 *
 * This parser and matcher deliberately do not delegate matching to the host RegExp
 * engine. The accepted language has no alternation, assertions, backreferences,
 * group quantifiers, or lazy quantifiers. At most one variable quantifier exists,
 * and it must be on the final consuming atom.
 *
 * Security-sensitive broker path (ADR-023 section 5 decision 1). AI drafted;
 * requires human security review before merge (AGENTS.md section 1).
 */
type CharSet = {
    readonly kind: "digit";
} | {
    readonly kind: "word";
} | {
    readonly kind: "space";
} | {
    readonly kind: "class";
    readonly negated: boolean;
    readonly ranges: ReadonlyArray<readonly [number, number]>;
};
interface Atom {
    readonly kind: "literal" | "dot" | "set";
    readonly value?: number;
    readonly set?: CharSet;
    readonly min: number;
    readonly max: number | null;
}
interface CaptureBoundary {
    readonly group: number;
    readonly startAtom: number;
    endAtom: number;
}
export interface LinearRegexPattern {
    readonly source: string;
    readonly anchoredStart: boolean;
    readonly anchoredEnd: boolean;
    readonly atoms: readonly Atom[];
    readonly captures: readonly CaptureBoundary[];
    readonly groupCount: number;
    readonly variableAtom: number | null;
}
export declare class LinearRegexSyntaxError extends Error {
    constructor(message: string);
}
export interface LinearRegexMatch {
    /** Group 0 is the whole match; subsequent entries are ordinary capture groups. */
    readonly groups: readonly string[];
}
/** Parse and validate an adapter pattern without invoking the native RegExp parser. */
export declare function parseLinearRegex(source: string): LinearRegexPattern;
/** Match the first candidate start with deterministic greedy final-atom semantics. */
export declare function matchLinearRegex(pattern: LinearRegexPattern, input: string): LinearRegexMatch | null;
export {};
