import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NusharekLogo } from "@/components/NusharekLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", href: "/dashboard" },
  { icon: ClipboardList, label: "التقييم الذاتي", href: "/assessment" },
  { icon: FileText, label: "التقارير", href: "/reports" },
  { icon: Building2, label: "المنظمة", href: "/organization" },
  { icon: Settings, label: "الإعدادات", href: "/settings" },
];

const adminNavItems = [
  { icon: Shield, label: "لوحة الإدارة", href: "/admin" },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 right-0 left-0 h-16 bg-background border-b border-border z-50 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <NusharekLogo size="sm" />
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-40 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-center border-b border-border">
            <Link to="/dashboard">
              <NusharekLogo size="sm" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {allNavItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronLeft className="h-4 w-4 mr-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-border">
            <div className="mb-4 px-4">
              <p className="text-sm text-muted-foreground">مسجّل الدخول كـ</p>
              <p className="font-medium truncate">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:mr-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}