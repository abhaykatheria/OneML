/** Packages to eagerly install after Pyodide boots. */
export const PRELOAD_PACKAGES: string[] = [
  'numpy',
  'scipy',
  'scikit-learn',
  'matplotlib',
  'pandas',
];

/**
 * Returns Python code that imports the preloaded packages so they are
 * warm in the interpreter and ready for user code.
 */
export function getPreloadCode(): string {
  return `
import numpy as np
import scipy
import sklearn
import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
`.trim();
}
