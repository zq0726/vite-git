export default {
  '*.{js,jsx,ts,tsx,vue}': ['eslint --fix', 'prettier --write'],
  '*.{css,less,scss}': ['stylelint --fix', 'prettier --write'],
  '*.vue': ['stylelint --fix --custom-syntax postcss-html', 'prettier --write'],
  '*.{md,mdx}': ['prettier --write'],
  '*.{json,yml,yaml}': ['prettier --write'],
}
