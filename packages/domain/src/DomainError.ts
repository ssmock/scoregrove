import { NonEmptyString } from './NonEmptyString';
import { alwaysArray, getReadableIdentifier } from './Utils';

export const DomainErrorCode = {
  NotFound: 'NotFound',
  Unauthorized: 'Unauthorized',
  MissingArgument: 'MissingArgument',
  Invalid: 'Invalid',
  TooManyResults: 'TooManyResults',
  RequestAnomaly: 'RequestAnomaly',
  DataReferenceError: 'DataReferenceError',
  DataCheckError: 'DataCheckError',
  DataErrorUnknown: 'DataErrorUnknown',
  ServerError: 'ServerError',
  InvalidLogin: 'InvalidLogin',
  Forbidden: 'Forbidden',
  NoUserProfile: 'NoUserProfile',
  LoginFailed: 'LoginFailed',
  NoCredentials: 'NoCredentials',
  HttpRequestError: 'HttpRequestError',
  UnknownHttpError: 'UnknownHttpError',
  ContextMismatch: 'ContextMismatch',
  VersionMismatch: 'VersionMismatch',
  ProcessPending: 'ProcessPending',
  IntegrationFailed: 'IntegrationFailed',
  TooLarge: 'TooLarge',
  TemplateError: 'TemplateError',
  Test: 'Test',
  ChecklistNotReady: 'ChecklistNotReady',
  Unprocessable: 'Unprocessable',
  RetriesExceeded: 'RetriesExceeded',
  RetriesAbandoned: 'RetriesAbandoned',
  ExceptionThrown: 'ExceptionThrown',
  TimedOut: 'TimedOut',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export type DomainError = {
  code: DomainErrorCode;
  messages: string[];
  expectedVersion?: number;
};

export type LabeledError = {
  label: string;
  error: DomainError;
};

export type LabelFunction = (error: DomainError, index: number) => string;

export const DomainError = {
  invalid(messages: string | string[]): DomainError {
    return {
      code: DomainErrorCode.Invalid,
      messages: Array.isArray(messages) ? messages : [messages],
    };
  },

  integrationFailed(messages: string | string[]): DomainError {
    return {
      code: DomainErrorCode.IntegrationFailed,
      messages: Array.isArray(messages) ? messages : [messages],
    };
  },

  asErrorMaybe(value: unknown): DomainError | null {
    if (typeof value !== 'object' || value === null) return null;

    const candidate = value as Partial<DomainError>;

    if (!candidate.code || !candidate.messages) return null;

    return {
      code: candidate.code,
      messages: candidate.messages,
      expectedVersion: candidate.expectedVersion,
    };
  },

  getReadableCode(e: DomainErrorCode) {
    return getReadableIdentifier(NonEmptyString.of(e));
  },

  aggregate(code: DomainErrorCode, labeledErrors: LabeledError[]): DomainError {
    const messages: string[] = labeledErrors.reduce((agg: string[], err: LabeledError) => {
      const msgs = err.error.messages.map((msg) => `${err.label}: ${msg}`);

      return agg.concat(msgs);
    }, []);

    return {
      code,
      messages,
    };
  },

  summarize(error: DomainError) {
    return `${error.code}: ${error.messages.join('; ') || 'No messages'}`;
  },

  pickMessages(errors: DomainError | DomainError[]): string[] {
    return alwaysArray(errors).reduce((agg, error) => {
      agg.push(...error.messages);
      return agg;
    }, [] as string[]);
  },

  prependMessages(error: DomainError | undefined, messages: string | string[]): DomainError {
    if (!error) return DomainError.invalid(messages);

    return {
      ...error,
      messages: [...alwaysArray(messages), ...error.messages],
    };
  },

  isDomainError(val: unknown): val is DomainError {
    if (!val) return false;

    if (typeof val !== 'object') return false;

    const obj = val as Record<string, unknown>;

    if (!obj.code) {
      return false;
    }

    if (!Object.values(DomainErrorCode).includes(obj.code as DomainErrorCode)) {
      return false;
    }

    if (!obj.messages) {
      return false;
    }

    if (!Array.isArray(obj.messages)) {
      return false;
    }

    if (!obj.messages.every((m) => typeof m === 'string')) {
      return false;
    }

    if (obj.expectedVersion === null) {
      return false;
    }

    if (obj.expectedVersion !== undefined) {
      if (typeof obj.expectedVersion !== 'number') {
        return false;
      }

      const parsed = Number(obj.expectedVersion);
      if (Number.isNaN(parsed)) {
        return false;
      }
    }

    return true;
  },

  hasMessageIncludingText(match: RegExp, error: DomainError): boolean {
    return error.messages.some((m) => match.test(m));
  },
};
