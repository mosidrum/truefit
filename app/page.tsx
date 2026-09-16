import Dashboard from "@/components/Dashboard";
import Landing from "@/components/Landing";
import { getAppUser } from "@/lib/session";

export default async function Home() {
  const user = await getAppUser();

  if (!user) {
    return <Landing />;
  }

  return <Dashboard user={user} />;
}
