import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import ArticleDetail from "@/pages/article-detail";
import NotFound from "@/pages/not-found";

function Router() {
  // Use hash-based routing in Electron to support file:// protocol
  const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');

  if (isElectron) {
    return (
      <WouterRouter hook={useHashLocation}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/article/:id" component={ArticleDetail} />
          <Route component={NotFound} />
        </Switch>
      </WouterRouter>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/article/:id" component={ArticleDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
