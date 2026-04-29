import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
            <Route path="/dashboard/generate/history" element={<ProtectedRoute><ContentHistory /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
