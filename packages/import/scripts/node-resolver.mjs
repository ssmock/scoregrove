/**
 * Lets Node run the workspace's compiled output.
 *
 * Every package here builds with `moduleResolution: "Bundler"`, so `dist` keeps
 * the extensionless relative specifiers the sources are written with —
 * `./DomainError` rather than `./DomainError.js`. Vite and Vitest resolve those
 * happily; Node's ESM loader, which follows the spec strictly, does not. So a
 * plain `node script.mjs` that imports from `dist` fails on the first internal
 * import of the first domain module it touches.
 *
 * This resolver adds `.js` only where resolution has already failed, so it can
 * never shadow a specifier that Node could resolve on its own. It is confined
 * to this package's scripts on purpose: the fix belongs either in the build
 * output or in a bundling step for the CLI, and papering over it repo-wide
 * would hide a real inconsistency between how the code is compiled and how it
 * is run.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }

    throw error;
  }
}
