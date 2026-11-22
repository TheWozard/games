// CSS lint for mistakes (unknown properties and values, duplicates, wrong specificity order), and
// properties in one order (recess: position, box model, typography, visual, then the rest).
// Formatting is Prettier's job, so the blank-line rules are off: related rules sit together.
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recess-order'],
  rules: {
    'rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    'at-rule-empty-line-before': null,
    // Flags selectors for different elements (`.a span` after `.b .c span`), never the same one.
    'no-descending-specificity': null,
    // iOS Safari still needs -webkit-user-select and -webkit-text-size-adjust.
    'property-no-vendor-prefix': [
      true,
      // Matched against the whole name, prefix included.
      { ignoreProperties: ['-webkit-user-select', '-webkit-text-size-adjust'] },
    ],
    // currentColor, as SVG attributes spell it.
    'value-keyword-case': ['lower', { ignoreKeywords: ['currentColor'] }],
  },
  overrides: [
    {
      files: ['**/*.svelte'],
      customSyntax: 'postcss-html',
      rules: { 'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }] },
    },
  ],
};
