import { apiRequest } from '../core/services/apiClient.js';
export { shouldTryAiInterpretationFallback } from './importInterpreterPolicy.js';

export async function requestAiImportInterpretation({ rawText, source, fileName, activeWeekNumber, analysis, parserReview }) {
  return apiRequest('/imports/interpret', {
    method: 'POST',
    body: {
      rawText,
      source,
      fileName,
      activeWeekNumber,
      analysis,
      parserReview,
    },
  });
}
