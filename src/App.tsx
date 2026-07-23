import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OrgProtectedRoute } from "@/components/OrgProtectedRoute";
import { OrganizationProvider } from "@/hooks/useOrganization";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import InviteAccept from "./pages/InviteAccept";
import AppHome from "./pages/AppHome";
import SupportPortal from "./pages/SupportPortal";
import TicketSubmitted from "./pages/TicketSubmitted";
import TicketChat from "./pages/TicketChat";
import AdminDashboard from "./pages/AdminDashboard";
import TicketDetails from "./pages/TicketDetails";
import Analytics from "./pages/Analytics";
import Team from "./pages/Team";
import CannedResponses from "./pages/CannedResponses";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const OrgLayout = () => (
  <ProtectedRoute>
    <OrganizationProvider>
      <Outlet />
    </OrganizationProvider>
  </ProtectedRoute>
);

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Marketing + auth */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppHome />
                </ProtectedRoute>
              }
            />

            {/* Public, org-branded support portal */}
            <Route path="/support/:orgSlug" element={<SupportPortal />} />
            <Route path="/support/:orgSlug/ticket-submitted" element={<TicketSubmitted />} />
            <Route path="/t/:token" element={<TicketChat />} />

            {/* Authenticated app, scoped to one organization */}
            <Route path="/app/:orgSlug" element={<OrgLayout />}>
              <Route
                path="dashboard"
                element={
                  <OrgProtectedRoute>
                    <AdminDashboard />
                  </OrgProtectedRoute>
                }
              />
              <Route
                path="ticket/:id"
                element={
                  <OrgProtectedRoute>
                    <TicketDetails />
                  </OrgProtectedRoute>
                }
              />
              <Route
                path="analytics"
                element={
                  <OrgProtectedRoute>
                    <Analytics />
                  </OrgProtectedRoute>
                }
              />
              <Route
                path="canned-responses"
                element={
                  <OrgProtectedRoute allow={["owner", "admin", "agent"]}>
                    <CannedResponses />
                  </OrgProtectedRoute>
                }
              />
              <Route
                path="team"
                element={
                  <OrgProtectedRoute allow={["owner", "admin"]}>
                    <Team />
                  </OrgProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <OrgProtectedRoute allow={["owner", "admin"]}>
                    <Settings />
                  </OrgProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
