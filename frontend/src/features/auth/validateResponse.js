// Implemented JSON reads return objects or legacy arrays. A 200 HTML document
// (for example, a misrouted SPA fallback) is an error, never an empty collection.
// Empty resume metadata is { resume: null }; downloads and 204 have no JSON body.
export function validateReadResponse(response) {
  const { config, data, status } = response;
  if (config.method !== 'get' || status === 204 || ['blob', 'arraybuffer', 'text', 'stream'].includes(config.responseType)) return response;
  // An older API process may ignore opt-in pagination and return a legacy
  // array. Paged consumers require an envelope; reject before render so their
  // existing error/Retry paths handle a frontend/backend version mismatch.
  const paged = ['page', 'cursor'].includes(config.params?.pagination);
  if (data === null || typeof data !== 'object'
    || (paged && !Array.isArray(data.results))
    || (!Array.isArray(data) && ('results' in data || 'count' in data) && !Array.isArray(data.results))) {
    throw new Error('The server returned an invalid response. Please retry.');
  }
  return response;
}
