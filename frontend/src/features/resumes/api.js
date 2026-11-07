import { http } from '../auth/api.js';

export const resumeApi = {
  metadata: () => http.get('/candidates/me/resume/').then(({ data }) => data.resume),
  upload: (file) => { const data = new FormData(); data.append('file', file); return http.put('/candidates/me/resume/', data, { headers: { 'Content-Type': undefined } }).then(({ data }) => data.resume); },
  remove: () => http.delete('/candidates/me/resume/'),
  download: () => download('/candidates/me/resume/download/'),
  applicantDownload: (jobId, applicationId) => download(`/jobs/${jobId}/applications/${applicationId}/resume/`),
};

async function download(path) {
  const { data } = await http.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'resume.pdf'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resumeError(error) {
  const data = error.response?.data;
  return data?.file?.[0] || (typeof data?.detail === 'string' ? data.detail : 'Resume action failed. Please try again.');
}
