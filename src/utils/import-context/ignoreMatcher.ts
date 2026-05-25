import { fileToString } from '@/utils/fileEncoding';

const IGNORE_FILE_NAMES = new Set(['.gitignore', '.ignore', '.repomixignore']);

interface IgnoreTestResult {
  ignored: boolean;
  unignored: boolean;
}

interface IgnoreMatcherInstance {
  test(path: string): IgnoreTestResult;
}

export interface IgnoreMatcher {
  basePath: string;
  matcher: IgnoreMatcherInstance;
}

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

const createBasenameMatcher = (pattern: string): ((path: string) => boolean) => {
  return (path: string) => {
    const normalizedPath = normalizePath(path);
    return normalizedPath.split('/').some((segment) => segment === pattern);
  };
};

const createDirectoryMatcher = (pattern: string): ((path: string) => boolean) => {
  return (path: string) => {
    const normalizedPath = normalizePath(path);
    return normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`);
  };
};

const createPathMatcher = (pattern: string): ((path: string) => boolean) => {
  return (path: string) => normalizePath(path) === pattern;
};

const createIgnoreMatcher = (patterns: string[]): IgnoreMatcherInstance => {
  const rules = patterns.map((pattern) => {
    const isNegated = pattern.startsWith('!');
    const rawPattern = normalizePath(isNegated ? pattern.slice(1) : pattern);
    const isDirectory = pattern.endsWith('/');
    const hasSlash = rawPattern.includes('/');

    return {
      isNegated,
      matches: isDirectory
        ? createDirectoryMatcher(rawPattern)
        : hasSlash
          ? createPathMatcher(rawPattern)
          : createBasenameMatcher(rawPattern),
    };
  });

  return {
    test(path: string) {
      let ignored = false;
      let unignored = false;

      for (const rule of rules) {
        if (!rule.matches(path)) {
          continue;
        }

        if (rule.isNegated) {
          ignored = false;
          unignored = true;
        } else {
          ignored = true;
          unignored = false;
        }
      }

      return { ignored, unignored };
    },
  };
};

const parseGitignorePatterns = (content: string): string[] =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

export const buildRootGitignoreMatchers = async (
  files: File[],
  getFilePath: (file: File) => string,
): Promise<IgnoreMatcher[]> => {
  const matchers: IgnoreMatcher[] = [];

  for (const file of files) {
    const path = getFilePath(file);
    const parts = path.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1];

    if (!fileName || !IGNORE_FILE_NAMES.has(fileName)) {
      continue;
    }

    const patterns = parseGitignorePatterns(await fileToString(file));
    if (patterns.length === 0) {
      continue;
    }

    matchers.push({
      basePath: parts.slice(0, -1).join('/'),
      matcher: createIgnoreMatcher(patterns),
    });
  }

  matchers.sort((a, b) => a.basePath.split('/').filter(Boolean).length - b.basePath.split('/').filter(Boolean).length);
  return matchers;
};

const isPathWithinBase = (basePath: string, path: string): boolean => {
  if (!basePath) {
    return true;
  }

  return path === basePath || path.startsWith(`${basePath}/`);
};

const relativeToBase = (path: string, basePath: string, isDirectory: boolean): string => {
  const relative = basePath ? path.slice(basePath.length + 1) : path;
  if (!relative) {
    return relative;
  }

  return isDirectory && !relative.endsWith('/') ? `${relative}/` : relative;
};

export const isIgnoredByGitignore = (path: string, matchers: IgnoreMatcher[], isDirectory = false): boolean => {
  if (path.split('/').filter(Boolean).length < 2) {
    return false;
  }

  let ignored = false;

  for (const matcher of matchers) {
    if (!isPathWithinBase(matcher.basePath, path)) {
      continue;
    }

    const relativePath = relativeToBase(path, matcher.basePath, isDirectory);
    if (!relativePath) {
      continue;
    }

    const result = matcher.matcher.test(relativePath);
    if (result.ignored) {
      ignored = true;
    }
    if (result.unignored) {
      ignored = false;
    }
  }

  return ignored;
};
