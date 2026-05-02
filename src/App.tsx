import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Extract from "./pages/Extract";
import Projects from "./pages/Projects";
import UserSettings from "./pages/UserSettings";
import Admin from "./pages/Admin";
import Credits from "./pages/Credits";
import GenerateContent from "./pages/GenerateContent";
import Drafts from "./pages/Drafts";
import CreditHistory from "./pages/CreditHistory";
import Addons from "./pages/Addons";
import PdfCustomization from "./pages/PdfCustomization";
import LogoCustomization from "./pages/LogoCustomization";
import ContentHistory from "./pages/ContentHistory";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import Ebooks from "./pages/Ebooks";
import EbookEditor from "./pages/EbookEditor";
import EbookEpubExport from "./pages/EbookEpubExport";
import { usePwaManifest } from "@/hooks/usePwaManifest";

const queryClient = new QueryClient();

const PwaManifestLoader = () => {
  usePwaManifest();
  return null;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <PwaManifestLoader />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/install" element={<Install />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/confirm" element={<ConfirmEmail />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/extract" element={<ProtectedRoute><Extract /></ProtectedRoute>} />
            <Route path="/dashboard/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
            <Route path="/dashboard/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
            <Route path="/dashboard/credits/history" element={<ProtectedRoute><CreditHistory /></ProtectedRoute>} />
            <Route path="/dashboard/generate" element={<ProtectedRoute><GenerateContent /></ProtectedRoute>} />
            <Route path="/dashboard/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/dashboard/addons" element={<ProtectedRoute><Addons /></ProtectedRoute>} />
            <Route path="/dashboard/pdf-customization" element={<ProtectedRoute><PdfCustomization /></ProtectedRoute>} />
            <Route path="/dashboard/logo-customization" element={<ProtectedRoute><LogoCustomization /></ProtectedRoute>} />
            <Route path="/dashboard/generate/history" element={<ProtectedRoute><ContentHistory /></ProtectedRoute>} />
            <Route path="/dashboard/ebooks" element={<ProtectedRoute><Ebooks /></ProtectedRoute>} />
            <Route path="/dashboard/ebooks/:id" element={<ProtectedRoute><EbookEditor /></ProtectedRoute>} />
            <Route path="/dashboard/ebooks/:id/epub" element={<ProtectedRoute><EbookEpubExport /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
