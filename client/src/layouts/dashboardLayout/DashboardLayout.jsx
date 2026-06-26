import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./dashboardLayout.css";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import ChatList from "../../components/chatList/ChatList";

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DashboardLayout = () => {
  const { userId, isLoaded } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoaded && !userId) {
      navigate("/sign-in");
    }
  }, [isLoaded, userId, navigate]);

  // Close the mobile drawer whenever the route changes (e.g. picking a chat)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (!isLoaded) return "Loading...";

  return (
    <div className="dashboardLayout">
      <button
        type="button"
        className="menuToggle"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
      >
        {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
      <div className={`menu${isMenuOpen ? " open" : ""}`}>
        <ChatList />
      </div>
      {isMenuOpen && (
        <div className="menuOverlay" onClick={() => setIsMenuOpen(false)} />
      )}
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
