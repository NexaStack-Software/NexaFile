/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@nexasign/ui/tailwind.config.cjs');
const path = require('path');

module.exports = {
  presets: [baseConfig],
  content: [
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@nexasign/ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@nexasign/email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
};
