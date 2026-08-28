import { useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { fetchMe } from "./lib/shell-auth.js";
import type { SessionUserLike } from "./lib/shell-auth.js";
import { AppShell } from "./components/AppShell.js";
import { Toaster, Spinner } from "./components/ui.js";
import Login from "./pages/Login.js";
import Dashboard from "./pages/Dashboard.js";
import Kasir from "./pages/Kasir.js";
import Products from "./pages/Products.js";
import Suppliers from "./pages/Suppliers.js";
import Purchases from "./pages/Purchases.js";
import Inventory from "./pages/Inventory.js";
import Opname from "./pages/Opname.js";
import Receivables from "./pages/Receivables.js";
import Finance from "./pages/Finance.js";
import Reports from "./pages/Reports.js";
import Users from "./pages/Users.js";
import Receipt from "./pages/Receipt.js";
import ShiftPage from "./pages/Shift.js";

export default function App() {
  const [user, setUser] = useState<SessionUserLike | null | undefined>(undefined);
  const [location] = useLocation();

  useEffect(() => {
    void fetchMe().then(setUser);
  }, []);

  if (user === undefined) return <Spinner className="min-h-screen" />;

  const isReceipt = location.startsWith("/receipt");
  const isLogin = location === "/login";

  // Receipt page: standalone (print), requires auth but no shell
  if (isReceipt) {
    if (!user) return <Login onLoggedIn={() => window.location.reload()} />;
    return <><Toaster /><Route path="/receipt/:id" component={Receipt} /></>;
  }

  if (!user || isLogin) {
    return <Login onLoggedIn={(u) => { setUser(u); window.location.href = "/"; }} />;
  }

  const isAdmin = user.role === "owner" || user.role === "admin";

  return (
    <>
      <AppShell user={user}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/pos"><Kasir role={user.role} /></Route>
          <Route path="/products"><Products role={user.role} /></Route>
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/purchases" component={Purchases} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/opname" component={Opname} />
          <Route path="/receivables" component={Receivables} />
          <Route path="/finance"><Finance user={user} /></Route>
          <Route path="/shifts"><ShiftPage role={user.role} /></Route>
          <Route path="/reports">{isAdmin ? <Reports /> : <Forbidden />}</Route>
          <Route path="/users">{isAdmin ? <Users /> : <Forbidden />}</Route>
          <Route component={() => <p className="p-8 text-center text-sm text-gray-500">Halaman tidak ditemukan.</p>} />
        </Switch>
      </AppShell>
      <Toaster />
    </>
  );
}

function Forbidden() {
  return <p className="p-8 text-center text-sm text-gray-500">Akses ditolak: halaman ini khusus admin/owner.</p>;
}
