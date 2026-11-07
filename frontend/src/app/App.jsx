import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../components/templates/PublicLayout.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { RouteGuard } from '../features/auth/RouteGuard.jsx';

const ProfilePage = lazy(() => import('../features/profiles/ProfilePage.jsx').then((module) => ({ default: module.ProfilePage })));
const CompanyPage = lazy(() => import('../features/companies/CompanyPage.jsx').then((module) => ({ default: module.CompanyPage })));
const JobSearchPage = lazy(() => import('../features/jobs/pages/JobSearchPage.jsx').then((module) => ({ default: module.JobSearchPage })));
const LoginPage = lazy(() => import('../features/auth/AuthPages.jsx').then((module) => ({ default: module.LoginPage })));
const CandidateRegistrationPage = lazy(() => import('../features/auth/AuthPages.jsx').then((module) => ({ default: module.CandidateRegistrationPage })));
const RecruiterRegistrationPage = lazy(() => import('../features/auth/AuthPages.jsx').then((module) => ({ default: module.RecruiterRegistrationPage })));
const JobDetailPage = lazy(() => import('../features/jobs/pages/JobDetailPage.jsx').then((module) => ({ default: module.JobDetailPage })));
const JobApplicationPage = lazy(() => import('../features/jobs/pages/JobDetailPage.jsx').then((module) => ({ default: module.JobApplicationPage })));
const ApplicationsPage = lazy(() => import('../features/jobs/pages/ApplicationsPage.jsx').then((module) => ({ default: module.ApplicationsPage })));
const ApplicationDetailPage = lazy(() => import('../features/jobs/pages/ApplicationsPage.jsx').then((module) => ({ default: module.ApplicationDetailPage })));
const RecruiterDashboardPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.RecruiterDashboardPage })));
const CompanyJobsPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.CompanyJobsPage })));
const JobEditorPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.JobEditorPage })));
const RecruiterJobDetailPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.RecruiterJobDetailPage })));
const RecruiterApplicantsPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.RecruiterApplicantsPage })));
const RecruiterApplicantDetailPage = lazy(() => import('../features/jobs/pages/RecruiterPages.jsx').then((module) => ({ default: module.RecruiterApplicantDetailPage })));

const ResumePage = lazy(() => import('../features/resumes/ResumePage.jsx').then((module) => ({ default: module.ResumePage })));

const AdminPage = lazy(() => import('../features/moderation/AdminPage.jsx').then((module) => ({ default: module.AdminPage })));

function PageLoading() {
  return <main className="page-loading" role="status" aria-live="polite"><span className="page-loading__indicator" aria-hidden="true" />Loading page…</main>;
}

export default function App() {
  return (
    <AuthProvider><BrowserRouter>
      <Suspense fallback={<PageLoading />}><Routes>
        <Route element={<PublicLayout />}>
          <Route element={<RouteGuard platformAdmin />}><Route path="/admin" element={<AdminPage />} /></Route>
          <Route path="/" element={<JobSearchPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/candidate" element={<CandidateRegistrationPage />} />
          <Route path="/register/recruiter" element={<RecruiterRegistrationPage />} />
          <Route element={<RouteGuard roles={['candidate']} />}>
            <Route path="/candidate/profile" element={<ProfilePage candidate />} />
            <Route path="/candidate" element={<Navigate to="/candidate/applications" replace />} />
            <Route path="/jobs/:id/apply" element={<JobApplicationPage />} />
            <Route path="/candidate/resume" element={<ResumePage />} />
            <Route path="/candidate/applications" element={<ApplicationsPage />} />
            <Route path="/candidate/applications/:applicationId" element={<ApplicationDetailPage />} />
          </Route>
          <Route element={<RouteGuard roles={['recruiter']} />}>
            <Route path="/recruiter/profile" element={<ProfilePage />} />
            <Route path="/recruiter/companies/new" element={<CompanyPage />} />
            <Route path="/recruiter/companies/:id" element={<CompanyPage />} />
            <Route path="/recruiter" element={<RecruiterDashboardPage />} />
            <Route path="/recruiter/jobs" element={<CompanyJobsPage />} />
            <Route path="/recruiter/jobs/new" element={<JobEditorPage />} />
            <Route path="/recruiter/jobs/:id" element={<RecruiterJobDetailPage />} />
            <Route path="/recruiter/jobs/:id/edit" element={<JobEditorPage />} />
            <Route path="/recruiter/jobs/:id/applicants" element={<RecruiterApplicantsPage />} />
            <Route path="/recruiter/jobs/:id/applicants/:applicationId" element={<RecruiterApplicantDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </BrowserRouter></AuthProvider>
  );
}
