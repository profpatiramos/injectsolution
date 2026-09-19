import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CategoriesPage from "./pages/CategoriesPage";
import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrderFormPage from "./pages/OrderFormPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";

const InLayout = ({ children }: { children: React.ReactNode }) => <DashboardLayout>{children}</DashboardLayout>;
const DashboardRoute = () => <InLayout><DashboardPage /></InLayout>;
const OrdersRoute = () => <InLayout><OrdersPage /></InLayout>;
const NewOrderRoute = () => <InLayout><OrderFormPage /></InLayout>;
const EditOrderRoute = () => <InLayout><OrderFormPage /></InLayout>;
const DetailOrderRoute = () => <InLayout><OrderDetailPage /></InLayout>;
const ProductsRoute = () => <InLayout><ProductsPage /></InLayout>;
const CategoriesRoute = () => <InLayout><CategoriesPage /></InLayout>;
const AdminRoute = () => <InLayout><AdminPage /></InLayout>;

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/app" component={DashboardRoute} />
    <Route path="/orders/new" component={NewOrderRoute} />
    <Route path="/orders/:id/edit" component={EditOrderRoute} />
    <Route path="/orders/:id" component={DetailOrderRoute} />
    <Route path="/orders" component={OrdersRoute} />
    <Route path="/products" component={ProductsRoute} />
    <Route path="/categories" component={CategoriesRoute} />
    <Route path="/admin" component={AdminRoute} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
