import { Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import Home from "./pages/Home";
import ContractsPage from "./pages/ContractsPage";
import ContractPage from "./pages/ContractPage";
import WalletPage from "./pages/WalletPage";
import EventPage from "./pages/EventPage";
import ProfilePage from "./pages/ProfilePage";
import MarketsPage from "./pages/MarketsPage";
import MarketPage from "./pages/MarketPage";
import BetsPage from "./pages/BetsPage";
import DisputesPage from "./pages/DisputesPage";
import DisputeDetailPage from "./pages/DisputeDetailPage";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();

  return (
    <ToastProvider>
      <div className="app">
        <Nav />
        <ErrorBoundary resetKey={location.pathname}>
          <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/contract/:id" element={<ContractPage />} />
              <Route path="/wallet/:address" element={<WalletPage />} />
              <Route path="/event/:seq" element={<EventPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:address" element={<ProfilePage />} />
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/market/:id" element={<MarketPage />} />
              <Route path="/bets" element={<BetsPage />} />
              <Route path="/disputes" element={<DisputesPage />} />
              <Route path="/disputes/:marketId" element={<DisputeDetailPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </ErrorBoundary>
        <Footer />
      </div>
    </ToastProvider>
  );
}
