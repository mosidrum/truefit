import Dashboard from "@/components/Dashboard";
import Landing from "@/components/Landing";
import { userLoggedIn } from "@/lib/session";

export default function Home() {
  if (!userLoggedIn) {
    return <Landing />;
  }

  return <Dashboard />;
}
