import { http } from '../auth/api.js';

export const resumeApi = {
  metadata: (config) => http.get('/candidates/me/resume/', config).then(({ data }) => data.resume),
  upload: (file, config) => { const data = new FormData(); data.append('file', file); return http.put('/candidates/me/resume/', data, { ...config, headers: { ...config?.headers, 'Content-Type': undefined } }).then(({ data }) => data.resume); },
  remove: (config) => http.delete('/candidates/me/resume/', config),
  download: (config) => download('/candidates/me/resume/download/', config),
  applicantDownload: (jobId, applicationId) => download(`/jobs/${jobId}/applications/${applicationId}/resume/`),
};

async function download(path, config) {
  const { data } = await http.get(path, { ...config, responseType: 'blob' });
  config?._assertAuthority?.();
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'resume.pdf'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resumeError(error) {
  const data = error.response?.data;
  return data?.file?.[0] || (typeof data?.detail === 'string' ? data.detail : 'Resume action failed. Please try again.');
}
