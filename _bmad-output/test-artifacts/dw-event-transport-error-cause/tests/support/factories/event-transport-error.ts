/** Fresh diagnostic input per call; deliberately lacks PostgREST's details field. */
export function createEventTransportFailure(
  options: { message?: string; code?: string } = {}
): TypeError & { code: string } {
  return Object.assign(new TypeError(options.message ?? 'socket closed'), {
    code: options.code ?? 'ECONNRESET',
  });
}
