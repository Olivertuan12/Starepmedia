/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { VideoDetail } from './pages/VideoDetail';
import { DocumentDetail } from './pages/DocumentDetail';
import { FeaturePlanning } from './pages/FeaturePlanning';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
             <Route path="/projects" element={<Projects />} />
             <Route path="/projects/:projectId" element={<ProjectDetail />} />
             <Route path="/projects/:projectId/documents/:documentId" element={<DocumentDetail />} />
             <Route path="/projects/:projectId/videos/:videoId" element={<VideoDetail />} />
             <Route path="/roadmap" element={<FeaturePlanning />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
