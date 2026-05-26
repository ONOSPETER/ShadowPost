import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SuiProviders from "@/providers/SuiProviders";
import { WalletProvider, useWallet } from "@/context/WalletContext";
import WalletConnectModal from "@/components/WalletConnectModal";
import LandingPage from "@/pages/LandingPage";
import DashboardLayout from "@/pages/DashboardLayout";
import InboxPage from "@/pages/InboxPage";
import UploadPage from "@/pages/UploadPage";

const queryClient = new QueryClient();

function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl font-black text-gray-800 mb-4">404</div>
        <p className="text-gray-500 mb-6">This route doesn't exist in the shadows.</p>
        <button
          onClick={() => setLocation("/")}
          className="px-6 py-3 rounded-xl border border-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/10 transition-colors"
        >
          Back to Safety
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { connected, isConnecting } = useWallet();
  const [, setLocation] = useLocation();

  if (isConnecting) return <LoadingScreen />;

  if (!connected) {
    setLocation("/");
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <InboxPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/upload">
        <ProtectedRoute>
          <DashboardLayout>
            <UploadPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  return (
    <>
      <WalletConnectModal />
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiProviders>
        <WalletProvider>
          <AppShell />
        </WalletProvider>
      </SuiProviders>
    </QueryClientProvider>
  );
}

export default App;
